-- =====================================================================
-- APLIKASI TANGGUH - MIGRASI KEENAM (BAGIAN 3 DARI 3)
-- TRIGGER PEMBUATAN PROFIL: MENGENALI DOKTER SPESIALIS ANAK
--
-- Versi     : 1.6
-- Tanggal   : 26 Agustus 2026
-- Prasyarat : 20260826100100_peran_dsa_aturan.sql
--
-- Trigger ini menggantikan versi pada 20260825090000_pendaftaran_tahan_galat.sql.
-- Sifat dasarnya tidak berubah: pendaftaran tidak boleh gagal hanya karena satu
-- rujukan wilayah tidak ditemukan. Yang bertambah adalah penanganan peran
-- dokter spesialis anak, yang bertugas di rumah sakit dan karena itu perlu
-- baris faskes bertipe 'rumah_sakit' agar rujukan dapat diarahkan kepadanya.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_role        public.user_role;
  v_kabupaten   uuid;
  v_puskesmas   uuid;
  v_posyandu    uuid;
  v_faskes      uuid;
  v_jenis       public.jenis_faskes;
  v_str         text;
  v_nama_rs     text;
begin
  -- ---------------- Peran ----------------
  begin
    v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'kader');
  exception when others then
    v_role := 'kader';
  end;

  -- Peran admin tidak boleh diperoleh lewat pendaftaran mandiri.
  if v_role = 'admin' then
    v_role := 'kader';
  end if;

  -- ---------------- STR ----------------
  -- chk_str_nakes mewajibkan STR minimal 5 karakter untuk seluruh nakes.
  -- Bila tidak terpenuhi, peran diturunkan ke kader agar pendaftaran tetap
  -- masuk antrean verifikasi dan admin dapat membetulkannya.
  v_str := nullif(new.raw_user_meta_data ->> 'no_str', '');
  if v_role in ('dokter', 'dietisien', 'dokter_spesialis_anak')
     and (v_str is null or length(v_str) < 5) then
    v_role := 'kader';
  end if;

  -- ---------------- Jenis fasilitas ----------------
  begin
    v_jenis := coalesce(
      (new.raw_user_meta_data ->> 'jenis_faskes')::public.jenis_faskes,
      'puskesmas'
    );
  exception when others then
    v_jenis := 'puskesmas';
  end;

  -- chk_spesialis_anak_di_rs: spesialis anak selalu tercatat di rumah sakit.
  if v_role = 'dokter_spesialis_anak' then
    v_jenis := 'rumah_sakit';
  end if;

  -- ---------------- Kabupaten ----------------
  begin
    v_kabupaten := nullif(new.raw_user_meta_data ->> 'kabupaten_id', '')::uuid;
  exception when others then
    v_kabupaten := null;
  end;
  if v_kabupaten is not null
     and not exists (select 1 from public.kabupaten k where k.id = v_kabupaten) then
    v_kabupaten := null;
  end if;

  -- ---------------- Puskesmas ----------------
  -- Wajib untuk seluruh nakes (chk_nakes_wajib_puskesmas). Untuk spesialis
  -- anak, puskesmas berfungsi sebagai penanda wilayah pembina, bukan tempat
  -- bertugas; tempat bertugas ada di faskes_id.
  begin
    v_puskesmas := nullif(new.raw_user_meta_data ->> 'puskesmas_id', '')::uuid;
  exception when others then
    v_puskesmas := null;
  end;
  if v_puskesmas is not null
     and not exists (select 1 from public.puskesmas p where p.id = v_puskesmas) then
    v_puskesmas := null;
  end if;
  if v_puskesmas is null and v_role in ('dokter', 'dietisien', 'dokter_spesialis_anak') then
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

  -- ---------------- Posyandu ----------------
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

  -- ---------------- Fasilitas tempat bertugas ----------------
  begin
    v_faskes := nullif(new.raw_user_meta_data ->> 'faskes_id', '')::uuid;
  exception when others then
    v_faskes := null;
  end;
  if v_faskes is not null
     and not exists (select 1 from public.faskes f where f.id = v_faskes) then
    v_faskes := null;
  end if;

  -- Untuk peran yang bertugas di rumah sakit, faskes_id harus benar-benar
  -- menunjuk baris bertipe 'rumah_sakit'. Nama yang diketik pendaftar
  -- didaftarkan sebagai usulan agar rujukan punya tujuan yang bisa dipilih,
  -- lalu admin menormalkannya ke fasilitas master saat verifikasi.
  if v_jenis = 'rumah_sakit' then
    v_nama_rs := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'faskes_manual', '')), '');

    if v_faskes is not null
       and not exists (
         select 1 from public.faskes f
         where f.id = v_faskes and f.jenis = 'rumah_sakit'
       ) then
      v_faskes := null;
    end if;

    if v_faskes is null and v_nama_rs is not null then
      select f.id into v_faskes
      from public.faskes f
      where f.jenis = 'rumah_sakit'
        and lower(btrim(f.nama)) = lower(v_nama_rs)
        and (v_kabupaten is null or f.kabupaten_id is not distinct from v_kabupaten)
      limit 1;

      if v_faskes is null then
        insert into public.faskes (nama, jenis, status, kabupaten_id, sumber_data, perlu_verifikasi)
        values (v_nama_rs, 'rumah_sakit', 'usulan', v_kabupaten, 'usulan_pendaftaran', true)
        returning id into v_faskes;
      end if;
    end if;
  end if;

  -- Peran non-rumah-sakit tetap memakai puskesmas sebagai fasilitasnya.
  if v_faskes is null then
    select f.id into v_faskes from public.faskes f where f.id = v_puskesmas;
  end if;

  -- ---------------- Pembuatan profil ----------------
  insert into public.profiles (
    id, nama_lengkap, role, no_str, no_hp,
    kabupaten_id, puskesmas_id, posyandu_id,
    faskes_id, jenis_faskes, status_akun
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
    v_faskes,
    v_jenis,
    'menunggu'::public.status_akun
  );

  return new;
end;
$fn$;

comment on function public.handle_new_user() is
  'Membuat profil otomatis setelah pendaftaran. Tahan galat: rujukan wilayah yang tidak sah diganti rujukan sah, dan rumah sakit yang diketik pendaftar didaftarkan sebagai usulan faskes.';
