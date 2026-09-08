-- =====================================================================
-- APLIKASI TANGGUH - PENDAFTARAN: WILAYAH YANG DIKETIK TIDAK LAGI DIBUANG
--
-- Versi   : 1.8
-- Tanggal : 10 September 2026
--
-- LATAR BELAKANG
--
-- Audit alur pendaftaran dijalankan dengan MENDAFTARKAN akun sungguhan pada
-- PostgreSQL 16, satu per peran, memakai payload metadata yang sama persis
-- dengan yang dikirim `daftar/actions.ts`. Hasilnya:
--
--   nama_lengkap          peran         puskesmas             posyandu
--   --------------------  ------------  --------------------  ---------------
--   UJI Kader             kader         Puskesmas Pilolodaa   Posyandu Uji
--   UJI KaderTanpaPkm     kader         (kosong)              Posyandu Uji
--   UJI Spesialis         dsa           Puskesmas Pilolodaa   (kosong)
--   UJI SpesialisTanpaRS  dsa           Puskesmas Pilolodaa   (kosong)
--
-- "UJI Kader" mengetik "Posyandu Melati Baru" pada formulir. Yang tersimpan
-- "Posyandu Uji" - posyandu pertama yang kebetulan ada di database. Nama yang
-- diketik dibuang tanpa jejak, dan kader itu tidak akan pernah tahu bahwa
-- datanya tertaut ke posyandu orang lain.
--
-- TEMUAN YANG DIPERBAIKI MIGRASI INI
--
-- R-1 `posyandu_manual` dikumpulkan, DIWAJIBKAN untuk kader, dikirim sebagai
--     metadata, lalu tidak dibaca siapa pun. Kader diikat ke posyandu
--     sembarangan lewat `select s.id from posyandu s limit 1`.
-- R-2 `faskes_manual` hanya dibaca untuk jenis rumah sakit. Puskesmas
--     "Lainnya" dan puskesmas luar Gorontalo dibuang dengan cara yang sama.
-- R-3 Kader dapat tersimpan tanpa `puskesmas_id` namun tetap memegang
--     posyandu - dan posyandu itu milik puskesmas lain. `wilayahUntukMenulis`
--     lalu menolak kader tersebut dengan 'wilayah kerja belum lengkap'.
-- R-4 Dokter spesialis anak tetap diberi puskesmas sembarangan, padahal sejak
--     migrasi 20260909000000 peran itu tidak lagi memerlukannya.
-- R-5 Dokter spesialis anak dapat memiliki `faskes_id` yang menunjuk baris
--     PUSKESMAS meski `jenis_faskes = 'rumah_sakit'`. Terbukti pada
--     "UJI SpesialisTanpaRS". Akibatnya `my_faskes_id()` mengembalikan sebuah
--     puskesmas, dan `spesialis_anak_boleh_lihat` yang membandingkannya dengan
--     `rujukan.rs_tujuan_id` tidak akan pernah cocok: spesialis itu hanya
--     melihat balita yang ia catat sendiri, selamanya.
-- R-6 `usulkan_posyandu` RUSAK: menulis ke `posyandu.kabupaten_id`, kolom yang
--     tidak ada. Fungsi itu juga tidak pernah dipanggil dari aplikasi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- BAGIAN 1: PUSKESMAS PUN PERLU PENANDA USULAN
--
-- `faskes` dan `posyandu` sudah memiliki kolom `status` ('master' | 'usulan').
-- `puskesmas` tidak, padahal kolom `profiles.puskesmas_id` berkunci-asing ke
-- sana. Tanpa penanda ini, puskesmas yang diketik pendaftar tidak dapat
-- dibedakan dari 95 puskesmas master, sehingga admin tidak punya cara
-- menormalkannya.
-- ---------------------------------------------------------------------

alter table public.puskesmas
  add column if not exists status public.status_faskes not null default 'master';
alter table public.puskesmas
  add column if not exists diusulkan_oleh uuid references public.profiles(id);

comment on column public.puskesmas.status is
  'master = data resmi Dinkes. usulan = nama yang diketik pendaftar, menunggu dinormalkan admin saat verifikasi.';

-- ---------------------------------------------------------------------
-- BAGIAN 2: usulkan_posyandu DIBETULKAN
--
-- Bentuk lamanya menulis ke `posyandu.kabupaten_id`. Kolom itu tidak pernah
-- ada: `posyandu` hanya punya id, puskesmas_id, nama, desa, kecamatan,
-- created_at, status, diusulkan_oleh. Setiap pemanggilan akan gagal dengan
-- galat 42703 "column does not exist". Fungsi itu memang belum pernah
-- dipanggil dari mana pun, sehingga kerusakannya tidak pernah terlihat.
-- ---------------------------------------------------------------------

drop function if exists public.usulkan_posyandu(text, uuid, uuid);

create or replace function public.usulkan_posyandu(
  p_nama text,
  p_puskesmas_id uuid,
  p_diusulkan_oleh uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_puskesmas_id is null then
    raise exception 'Posyandu wajib bernaung pada satu puskesmas.';
  end if;

  -- Pakai yang sudah ada bila namanya sama di puskesmas yang sama, agar
  -- pendaftaran berulang tidak menumpuk duplikat.
  select s.id into v_id
  from public.posyandu s
  where s.puskesmas_id = p_puskesmas_id
    and lower(btrim(s.nama)) = lower(btrim(p_nama))
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.posyandu (nama, puskesmas_id, status, diusulkan_oleh)
  values (btrim(p_nama), p_puskesmas_id, 'usulan'::public.status_faskes, p_diusulkan_oleh)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.usulkan_posyandu(text, uuid, uuid) is
  'Mendaftarkan posyandu yang diketik kader sebagai usulan di bawah puskesmasnya. Memakai baris yang sudah ada bila namanya sama.';

-- ---------------------------------------------------------------------
-- BAGIAN 3: PUSKESMAS YANG DIKETIK PENDAFTAR
-- ---------------------------------------------------------------------

create or replace function public.usulkan_puskesmas(
  p_nama text,
  p_kabupaten_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_kabupaten_id is null then
    return null;
  end if;

  select p.id into v_id
  from public.puskesmas p
  where p.kabupaten_id = p_kabupaten_id
    and lower(btrim(p.nama)) = lower(btrim(p_nama))
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.puskesmas (nama, kabupaten_id, status)
  values (btrim(p_nama), p_kabupaten_id, 'usulan'::public.status_faskes)
  returning id into v_id;

  -- Pasangan di `faskes` dibuat dengan id yang SAMA, mengikuti kesepakatan
  -- yang sudah berlaku sejak migrasi 20260819160000.
  insert into public.faskes (id, nama, jenis, status, kabupaten_id, sumber_data, perlu_verifikasi)
  values (v_id, btrim(p_nama), 'puskesmas'::public.jenis_faskes,
          'usulan'::public.status_faskes, p_kabupaten_id, 'usulan_pendaftaran', true)
  on conflict (id) do nothing;

  return v_id;
end;
$$;

comment on function public.usulkan_puskesmas(text, uuid) is
  'Mendaftarkan puskesmas yang diketik pendaftar sebagai usulan, beserta pasangannya di tabel faskes dengan id yang sama.';

-- ---------------------------------------------------------------------
-- BAGIAN 4: KESELARASAN WILAYAH DITEGAKKAN DATABASE
--
-- Tiga aturan berikut melibatkan tabel lain, sehingga TIDAK dapat ditulis
-- sebagai batasan CHECK - CHECK tidak boleh memuat subkueri. Karena itu
-- dipakai trigger, yang berjalan pada setiap INSERT dan UPDATE profiles.
--
-- Aturan 3 adalah yang menutup R-5, temuan paling merugikan dalam audit ini.
-- ---------------------------------------------------------------------

create or replace function public.periksa_keselarasan_wilayah_profil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jenis_faskes public.jenis_faskes;
  v_pkm_posyandu uuid;
begin
  -- Aturan 1: kader yang memegang posyandu wajib berpuskesmas, dan posyandu
  -- itu harus berada di bawah puskesmas yang sama. Tanpa ini seorang kader
  -- dapat tertaut ke posyandu milik wilayah lain.
  if new.posyandu_id is not null then
    if new.puskesmas_id is null then
      raise exception
        'Profil yang memegang posyandu wajib mencantumkan puskesmas induknya.'
        using errcode = 'check_violation';
    end if;

    select s.puskesmas_id into v_pkm_posyandu
    from public.posyandu s where s.id = new.posyandu_id;

    if v_pkm_posyandu is distinct from new.puskesmas_id then
      raise exception
        'Posyandu yang dipilih tidak berada di bawah puskesmas pada profil ini.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Aturan 2 & 3: jenis fasilitas pada profil harus sesuai dengan JENIS BARIS
  -- faskes yang ditunjuknya.
  if new.faskes_id is not null and new.jenis_faskes is not null then
    select f.jenis into v_jenis_faskes
    from public.faskes f where f.id = new.faskes_id;

    if v_jenis_faskes is null then
      raise exception 'Fasilitas yang dirujuk profil tidak ditemukan.'
        using errcode = 'check_violation';
    end if;

    if v_jenis_faskes <> new.jenis_faskes then
      raise exception
        'Jenis fasilitas pada profil (%) tidak sesuai dengan jenis fasilitas yang dirujuk (%).',
        new.jenis_faskes, v_jenis_faskes
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.periksa_keselarasan_wilayah_profil() is
  'Menegakkan tiga aturan wilayah yang melibatkan tabel lain sehingga tidak dapat ditulis sebagai CHECK: posyandu wajib berpuskesmas, posyandu harus di bawah puskesmas profil, dan jenis_faskes harus sesuai jenis baris faskes yang dirujuk.';

drop trigger if exists trg_keselarasan_wilayah_profil on public.profiles;
create trigger trg_keselarasan_wilayah_profil
  before insert or update of posyandu_id, puskesmas_id, faskes_id, jenis_faskes
  on public.profiles
  for each row execute function public.periksa_keselarasan_wilayah_profil();

-- ---------------------------------------------------------------------
-- BAGIAN 5: handle_new_user MEMAKAI NAMA YANG DIKETIK PENDAFTAR
--
-- Sifat dasarnya dipertahankan: pendaftaran tidak boleh gagal hanya karena
-- satu rujukan wilayah tidak ditemukan. Yang berubah, urutan penyelesaian
-- wilayah kini MENDAHULUKAN nama yang diketik pendaftar di atas nilai
-- cadangan sembarang.
-- ---------------------------------------------------------------------

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
  v_nama_pkm    text;
  v_nama_posy   text;
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

  if v_role = 'dokter_spesialis_anak' then
    v_jenis := 'rumah_sakit';
  end if;
  -- Peran lapangan selalu bernaung pada puskesmas. Tanpa penegasan ini,
  -- seorang kader yang mengirim jenis_faskes 'rumah_sakit' akan melanggar
  -- keselarasan pada Bagian 4.
  if v_role in ('kader', 'dokter', 'dietisien') then
    v_jenis := 'puskesmas';
  end if;

  -- ---------------- Nama yang diketik pendaftar ----------------
  v_nama_rs   := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'faskes_manual', '')), '');
  v_nama_pkm  := v_nama_rs;  -- medan yang sama dipakai untuk kedua jenis
  v_nama_posy := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'posyandu_manual', '')), '');

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
  begin
    v_puskesmas := nullif(new.raw_user_meta_data ->> 'puskesmas_id', '')::uuid;
  exception when others then
    v_puskesmas := null;
  end;
  if v_puskesmas is not null
     and not exists (select 1 from public.puskesmas p where p.id = v_puskesmas) then
    v_puskesmas := null;
  end if;

  -- BARU: nama puskesmas yang diketik dipakai, bukan dibuang. Hanya berlaku
  -- untuk peran yang memang bernaung pada puskesmas.
  if v_puskesmas is null
     and v_nama_pkm is not null
     and v_role in ('kader', 'dokter', 'dietisien') then
    v_puskesmas := public.usulkan_puskesmas(v_nama_pkm, v_kabupaten);
  end if;

  -- Cadangan terakhir hanya untuk dokter dan dietisien, yang cakupan datanya
  -- memang ditentukan puskesmas (chk_nakes_wajib_puskesmas). Spesialis anak
  -- SENGAJA dikeluarkan: sejak migrasi 20260909000000 peran itu tidak lagi
  -- memerlukan puskesmas, dan memberinya puskesmas sembarangan hanya menanam
  -- wilayah yang tidak benar. Lihat temuan R-4.
  if v_puskesmas is null and v_role in ('dokter', 'dietisien') then
    select p.id into v_puskesmas
    from public.puskesmas p
    where v_kabupaten is not null and p.kabupaten_id = v_kabupaten
      and p.status = 'master'
    order by p.nama
    limit 1;
    if v_puskesmas is null then
      raise exception
        'Puskesmas tempat bertugas tidak dapat ditentukan. Pilih puskesmas dari daftar, atau tuliskan namanya.';
    end if;
  end if;

  -- ---------------- Posyandu ----------------
  begin
    v_posyandu := nullif(new.raw_user_meta_data ->> 'posyandu_id', '')::uuid;
  exception when others then
    v_posyandu := null;
  end;
  -- Posyandu hanya sah bila berada di bawah puskesmas profil (Bagian 4).
  if v_posyandu is not null and not exists (
       select 1 from public.posyandu s
       where s.id = v_posyandu and s.puskesmas_id = v_puskesmas
     ) then
    v_posyandu := null;
  end if;

  if v_role = 'kader' then
    -- BARU: nama posyandu yang diketik kader DIPAKAI. Inilah temuan R-1.
    if v_posyandu is null and v_nama_posy is not null and v_puskesmas is not null then
      v_posyandu := public.usulkan_posyandu(v_nama_posy, v_puskesmas, null);
    end if;

    -- Kader tanpa puskesmas tidak boleh dilanjutkan: posyandu tidak punya
    -- induk, dan `wilayahUntukMenulis` akan menolaknya. Lihat temuan R-3.
    if v_puskesmas is null then
      raise exception
        'Puskesmas induk posyandu tidak dapat ditentukan. Pilih puskesmas dari daftar, atau tuliskan namanya.';
    end if;

    if v_posyandu is null then
      raise exception
        'Nama posyandu wajib diisi agar cakupan data kader dapat ditentukan.';
    end if;
  else
    -- Posyandu tidak bermakna bagi peran selain kader.
    v_posyandu := null;
  end if;

  -- ---------------- Fasilitas tempat bertugas ----------------
  begin
    v_faskes := nullif(new.raw_user_meta_data ->> 'faskes_id', '')::uuid;
  exception when others then
    v_faskes := null;
  end;

  if v_jenis = 'rumah_sakit' then
    -- Metadata `faskes_id` yang dikirim aplikasi berisi id PUSKESMAS, sehingga
    -- untuk rumah sakit nilainya harus dibuang. Inilah pangkal temuan R-5.
    if v_faskes is not null and not exists (
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

    -- TIDAK ADA cadangan ke puskesmas di sini. Sebelumnya baris terakhir
    -- fungsi ini menyetel `v_faskes := v_puskesmas` bila masih kosong,
    -- sehingga seorang spesialis anak berakhir dengan faskes bertipe
    -- puskesmas dan cakupan datanya mustahil dinilai.
    if v_faskes is null then
      raise exception
        'Nama rumah sakit tempat bertugas wajib diisi untuk peran ini.';
    end if;
  else
    -- Peran puskesmas: fasilitasnya adalah puskesmasnya sendiri, dengan id
    -- yang sama di kedua tabel.
    if v_puskesmas is not null then
      select f.id into v_faskes from public.faskes f
      where f.id = v_puskesmas and f.jenis = 'puskesmas';
    else
      v_faskes := null;
    end if;
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
  'Membuat profil otomatis setelah pendaftaran. Nama puskesmas, posyandu, dan rumah sakit yang diketik pendaftar didaftarkan sebagai USULAN dan dipakai, tidak lagi dibuang dan diganti nilai sembarang. Spesialis anak tidak diberi puskesmas, dan fasilitasnya wajib bertipe rumah sakit.';
