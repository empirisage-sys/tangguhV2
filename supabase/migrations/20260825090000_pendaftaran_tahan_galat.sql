-- =====================================================================
-- Membuat pendaftaran tahan terhadap rujukan wilayah yang tidak sah.
--
-- Bukti dari Auth Logs (25 Agustus 2026, 16:51-17:00 WITA):
--
--   new row for relation "profiles" violates check constraint
--   "chk_nakes_wajib_puskesmas" (SQLSTATE 23514)
--
-- Trigger `handle_new_user` memasukkan `kabupaten_id`, `puskesmas_id`, dan
-- `posyandu_id` apa adanya dari metadata pendaftaran. Bila metadata itu kosong
-- atau menunjuk UUID yang sudah tidak ada di tabel master, pemasukan gagal:
-- bukan hanya karena foreign key, tetapi juga karena dua batasan berikut yang
-- mewajibkan rujukan tersebut terisi.
--
--   chk_nakes_wajib_puskesmas : dokter & dietisien wajib punya puskesmas_id
--   chk_kader_wajib_posyandu  : kader wajib punya posyandu_id
--
-- Karena itu rujukan yang tidak sah TIDAK boleh dikosongkan begitu saja.
-- Perbaikan di sini menggantinya dengan rujukan sah yang benar-benar ada di
-- tabel master, sedekat mungkin dengan wilayah yang dipilih pendaftar. Akun
-- tetap berstatus 'menunggu' sehingga admin membetulkan wilayahnya saat
-- verifikasi.
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

  -- Batasan chk_str_nakes mewajibkan STR minimal 5 karakter untuk dokter dan
  -- dietisien. Bila metadata tidak memenuhinya, peran diturunkan ke kader agar
  -- pendaftaran tidak gagal total; admin dapat menaikkannya saat verifikasi.
  v_str := nullif(new.raw_user_meta_data ->> 'no_str', '');
  if v_role in ('dokter', 'dietisien') and (v_str is null or length(v_str) < 5) then
    v_role := 'kader';
  end if;

  -- Kabupaten: boleh kosong, hanya perlu sah bila diisi.
  begin
    v_kabupaten := nullif(new.raw_user_meta_data ->> 'kabupaten_id', '')::uuid;
  exception when others then
    v_kabupaten := null;
  end;
  if v_kabupaten is not null
     and not exists (select 1 from public.kabupaten k where k.id = v_kabupaten) then
    v_kabupaten := null;
  end if;

  -- Puskesmas: wajib terisi untuk dokter & dietisien (chk_nakes_wajib_puskesmas).
  begin
    v_puskesmas := nullif(new.raw_user_meta_data ->> 'puskesmas_id', '')::uuid;
  exception when others then
    v_puskesmas := null;
  end;
  if v_puskesmas is not null
     and not exists (select 1 from public.puskesmas p where p.id = v_puskesmas) then
    v_puskesmas := null;
  end if;
  if v_puskesmas is null and v_role in ('dokter', 'dietisien') then
    -- Utamakan puskesmas di kabupaten yang dipilih pendaftar.
    select p.id into v_puskesmas
    from public.puskesmas p
    where v_kabupaten is not null and p.kabupaten_id = v_kabupaten
    limit 1;
    if v_puskesmas is null then
      select p.id into v_puskesmas from public.puskesmas p limit 1;
    end if;
    if v_puskesmas is null then
      raise exception
        'Tabel puskesmas kosong sehingga profil tenaga kesehatan tidak dapat dibuat. Isi data master puskesmas terlebih dahulu.';
    end if;
  end if;

  -- Posyandu: wajib terisi untuk kader (chk_kader_wajib_posyandu).
  begin
    v_posyandu := nullif(new.raw_user_meta_data ->> 'posyandu_id', '')::uuid;
  exception when others then
    v_posyandu := null;
  end;
  if v_posyandu is not null
     and not exists (select 1 from public.posyandu s where s.id = v_posyandu) then
    v_posyandu := null;
  end if;
  if v_posyandu is null and v_role = 'kader' then
    -- Utamakan posyandu di bawah puskesmas yang dipilih pendaftar.
    select s.id into v_posyandu
    from public.posyandu s
    where v_puskesmas is not null and s.puskesmas_id = v_puskesmas
    limit 1;
    if v_posyandu is null then
      select s.id into v_posyandu from public.posyandu s limit 1;
    end if;
    if v_posyandu is null then
      raise exception
        'Tabel posyandu kosong sehingga profil kader tidak dapat dibuat. Isi data master posyandu terlebih dahulu.';
    end if;
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
  'Membuat profil saat pendaftaran. Rujukan wilayah yang tidak sah diganti rujukan sah terdekat, bukan menggagalkan pendaftaran, agar chk_nakes_wajib_puskesmas dan chk_kader_wajib_posyandu tetap terpenuhi. Seluruh peran berstatus menunggu sampai admin menyetujui.';
