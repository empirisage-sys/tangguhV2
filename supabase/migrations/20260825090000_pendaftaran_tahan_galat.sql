-- =====================================================================
-- Membuat pendaftaran tahan terhadap rujukan wilayah yang tidak lagi ada.
--
-- Masalah yang diatasi:
-- Trigger `handle_new_user` memasukkan `kabupaten_id`, `puskesmas_id`, dan
-- `posyandu_id` apa adanya dari metadata pendaftaran. Bila UUID tersebut sudah
-- tidak ada di tabel master (misalnya setelah basis data dimigrasikan ulang,
-- karena UUID master dibuat dengan gen_random_uuid()), pemasukan gagal karena
-- pelanggaran foreign key. Kegagalan trigger membatalkan seluruh pendaftaran,
-- dan pengguna hanya menerima pesan galat umum.
--
-- Perbaikan: setiap rujukan diperiksa dulu. Rujukan yang tidak sah dikosongkan,
-- bukan menggagalkan pendaftaran. Akun tetap berstatus 'menunggu' sehingga admin
-- melengkapi wilayahnya saat verifikasi.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role        public.user_role;
  v_kabupaten   uuid;
  v_puskesmas   uuid;
  v_posyandu    uuid;
  v_str         text;
begin
  begin
    v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'kader');
  exception when others then
    v_role := 'kader';
  end;

  -- Peran `admin` tidak boleh dibuat lewat pendaftaran mandiri.
  if v_role = 'admin' then
    v_role := 'kader';
  end if;

  -- Rujukan wilayah divalidasi, bukan dipercaya begitu saja.
  begin
    v_kabupaten := nullif(new.raw_user_meta_data ->> 'kabupaten_id', '')::uuid;
  exception when others then
    v_kabupaten := null;
  end;
  if v_kabupaten is not null
     and not exists (select 1 from public.kabupaten k where k.id = v_kabupaten) then
    v_kabupaten := null;
  end if;

  begin
    v_puskesmas := nullif(new.raw_user_meta_data ->> 'puskesmas_id', '')::uuid;
  exception when others then
    v_puskesmas := null;
  end;
  if v_puskesmas is not null
     and not exists (select 1 from public.puskesmas p where p.id = v_puskesmas) then
    v_puskesmas := null;
  end if;

  begin
    v_posyandu := nullif(new.raw_user_meta_data ->> 'posyandu_id', '')::uuid;
  exception when others then
    v_posyandu := null;
  end;
  if v_posyandu is not null
     and not exists (select 1 from public.posyandu s where s.id = v_posyandu) then
    v_posyandu := null;
  end if;

  -- Batasan chk_str_nakes mewajibkan STR minimal 5 karakter untuk dokter dan
  -- dietisien. Bila metadata tidak memenuhinya, peran diturunkan ke kader agar
  -- pendaftaran tidak gagal total; admin dapat menaikkannya saat verifikasi.
  v_str := nullif(new.raw_user_meta_data ->> 'no_str', '');
  if v_role in ('dokter', 'dietisien') and (v_str is null or length(v_str) < 5) then
    v_role := 'kader';
  end if;

  insert into public.profiles (
    id, nama_lengkap, role, no_str, no_hp,
    kabupaten_id, puskesmas_id, posyandu_id, status_akun
  )
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'nama_lengkap', ''),
      split_part(coalesce(new.email, 'pengguna@tangguh'), '@', 1)
    ),
    v_role,
    v_str,
    nullif(new.raw_user_meta_data ->> 'no_hp', ''),
    v_kabupaten,
    v_puskesmas,
    v_posyandu,
    'menunggu'::public.status_akun
  );

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Membuat profil saat pendaftaran. Rujukan wilayah yang tidak sah dikosongkan, bukan menggagalkan pendaftaran. Seluruh peran berstatus menunggu sampai admin menyetujui.';
