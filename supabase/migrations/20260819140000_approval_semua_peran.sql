-- =====================================================================
-- APLIKASI TANGGUH - MIGRASI KETIGA
-- SELURUH PERAN WAJIB MELALUI PERSETUJUAN ADMIN
--
-- Versi     : 1.2
-- Tanggal   : 19 Agustus 2026
-- Prasyarat : 20260819090000_init_tangguh.sql
--             20260819120000_patch_temuan_telaah.sql
--
-- Perubahan pokok terhadap migrasi pertama:
--   Semula peran `kader` disetujui otomatis saat mendaftar. Sekarang seluruh
--   peran, termasuk kader, berstatus `menunggu` sampai admin menyetujui.
--
-- KONSEKUENSI OPERASIONAL YANG PERLU DISIAPKAN
-- Kader yang mendaftar pada hari posyandu tidak dapat mencatat apa pun hari itu
-- sampai admin menyetujui. Sebelum aplikasi dipakai, siapkan tiga hal:
--   1. Pendaftaran kader dilakukan beberapa hari sebelum jadwal posyandu.
--   2. Ada petugas admin yang memeriksa antrean verifikasi setiap hari kerja.
--   3. Ada jalur mendesak, misalnya nomor telepon puskesmas pembina.
-- Bila ketiganya belum siap, pertimbangkan pendelegasian yang dijelaskan pada
-- Bagian 6 di bawah, yang tidak diaktifkan pada migrasi ini.
-- =====================================================================

-- ---------------------------------------------------------------------
-- BAGIAN 1: PENDAFTARAN BARU SELALU BERSTATUS MENUNGGU
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'kader');

  -- Peran `admin` tidak boleh dibuat lewat pendaftaran mandiri. Bila ada yang
  -- mencoba, perannya diturunkan menjadi kader dan tetap menunggu persetujuan.
  if v_role = 'admin' then
    v_role := 'kader';
  end if;

  insert into public.profiles (
    id, nama_lengkap, role, no_str, no_hp,
    kabupaten_id, puskesmas_id, posyandu_id, status_akun
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nama_lengkap', split_part(new.email, '@', 1)),
    v_role,
    nullif(new.raw_user_meta_data ->> 'no_str', ''),
    nullif(new.raw_user_meta_data ->> 'no_hp', ''),
    nullif(new.raw_user_meta_data ->> 'kabupaten_id', '')::uuid,
    nullif(new.raw_user_meta_data ->> 'puskesmas_id', '')::uuid,
    nullif(new.raw_user_meta_data ->> 'posyandu_id', '')::uuid,
    'menunggu'::public.status_akun   -- berlaku untuk SELURUH peran
  );
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Membuat profil saat pendaftaran. Seluruh peran berstatus menunggu sampai admin menyetujui. Peran admin tidak dapat dibuat lewat pendaftaran mandiri.';

-- ---------------------------------------------------------------------
-- BAGIAN 2: KEAKTIFAN TIDAK LAGI MENGECUALIKAN KADER
-- ---------------------------------------------------------------------

create or replace function public.is_aktif()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status_akun = 'disetujui'
  );
$$;

comment on function public.is_aktif() is
  'true hanya bila akun sudah disetujui admin. Tidak ada pengecualian peran.';

-- ---------------------------------------------------------------------
-- BAGIAN 3: CAKUPAN BACA JUGA MENUNTUT PERSETUJUAN
--
-- Ini bagian terpenting dari migrasi ini. Pada migrasi pertama, fungsi
-- boleh_lihat hanya memeriksa wilayah, sehingga akun berstatus menunggu masih
-- dapat MEMBACA data balita meskipun tidak dapat menambah. Sekarang persetujuan
-- diperiksa lebih dahulu, sebelum wilayah.
-- ---------------------------------------------------------------------

create or replace function public.boleh_lihat(
  p_posyandu_id uuid,
  p_puskesmas_id uuid,
  p_kabupaten_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_aktif()
    and case public.my_role()
      when 'admin'     then true
      when 'kader'     then p_posyandu_id = public.my_posyandu_id()
      when 'dokter'    then p_puskesmas_id = public.my_puskesmas_id()
      when 'dietisien' then p_puskesmas_id = public.my_puskesmas_id()
      else false
    end;
$$;

comment on function public.boleh_lihat(uuid, uuid, uuid) is
  'Cakupan baca data balita. Menuntut akun sudah disetujui, lalu memeriksa wilayah sesuai peran.';

-- Fungsi is_admin sudah menuntut status disetujui pada migrasi pertama.
-- Dicatat di sini agar terlacak bahwa hal itu sudah diperiksa.

-- ---------------------------------------------------------------------
-- BAGIAN 4: BATASAN KELENGKAPAN DATA PENDAFTARAN
--
-- Sebelumnya hanya STR yang diwajibkan untuk tenaga kesehatan. Karena kini
-- admin yang memverifikasi seluruh peran, data yang diperlukan untuk
-- memverifikasi juga harus ada.
-- ---------------------------------------------------------------------

-- Kader wajib mencantumkan posyandu, karena itulah yang diverifikasi admin
-- dan sekaligus menentukan cakupan datanya.
alter table public.profiles add constraint chk_kader_wajib_posyandu
  check (role <> 'kader' or posyandu_id is not null);

-- Tenaga kesehatan wajib mencantumkan puskesmas, karena itu cakupan kerjanya.
alter table public.profiles add constraint chk_nakes_wajib_puskesmas
  check (role not in ('dokter', 'dietisien') or puskesmas_id is not null);

-- Penolakan wajib disertai alasan, agar pendaftar tahu apa yang harus diperbaiki.
alter table public.profiles add constraint chk_tolak_wajib_beralasan
  check (
    status_akun <> 'ditolak'
    or (alasan_tolak is not null and length(btrim(alasan_tolak)) >= 10)
  );

-- Keputusan verifikasi wajib mencatat siapa dan kapan.
alter table public.profiles add constraint chk_keputusan_tercatat
  check (
    status_akun = 'menunggu'
    or (disetujui_oleh is not null and disetujui_pada is not null)
  );

-- ---------------------------------------------------------------------
-- BAGIAN 5: FUNGSI VERIFIKASI
--
-- Verifikasi dilakukan lewat fungsi ini, bukan lewat UPDATE langsung. Alasannya:
-- fungsi dapat menjamin beberapa hal sekaligus dalam satu langkah, yang tidak
-- dapat dijamin oleh policy RLS sendirian.
-- ---------------------------------------------------------------------

create or replace function public.verifikasi_pengguna(
  p_pengguna_id uuid,
  p_setujui boolean,
  p_alasan text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hasil public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin Dinas Kesehatan yang dapat memverifikasi pendaftaran';
  end if;

  -- Admin tidak boleh menyetujui akunnya sendiri.
  if p_pengguna_id = auth.uid() then
    raise exception 'Tidak dapat memverifikasi akun sendiri';
  end if;

  if not p_setujui and (p_alasan is null or length(btrim(p_alasan)) < 10) then
    raise exception 'Penolakan harus disertai alasan minimal 10 karakter, agar pendaftar tahu apa yang perlu diperbaiki';
  end if;

  update public.profiles
  set status_akun    = case when p_setujui then 'disetujui'::public.status_akun
                            else 'ditolak'::public.status_akun end,
      alasan_tolak   = case when p_setujui then null else btrim(p_alasan) end,
      disetujui_oleh = auth.uid(),
      disetujui_pada = now(),
      updated_at     = now()
  where id = p_pengguna_id
  returning * into v_hasil;

  if v_hasil.id is null then
    raise exception 'Pengguna tidak ditemukan';
  end if;

  return v_hasil;
end;
$$;

revoke execute on function public.verifikasi_pengguna(uuid, boolean, text) from public, anon;
grant execute on function public.verifikasi_pengguna(uuid, boolean, text) to authenticated;

comment on function public.verifikasi_pengguna(uuid, boolean, text) is
  'Menyetujui atau menolak pendaftaran. Hanya admin. Tidak dapat dipakai untuk akun sendiri. Penolakan wajib beralasan.';

-- Antrean verifikasi untuk panel admin, lengkap dengan nama wilayah.
create view public.v_antrean_verifikasi
with (security_invoker = on) as
select
  p.id,
  p.nama_lengkap,
  p.role,
  p.no_str,
  p.no_hp,
  p.status_akun,
  p.created_at              as diajukan_pada,
  now() - p.created_at      as lama_menunggu,
  kab.nama                  as nama_kabupaten,
  pkm.nama                  as nama_puskesmas,
  psy.nama                  as nama_posyandu,
  psy.desa                  as desa
from public.profiles p
left join public.kabupaten kab on kab.id = p.kabupaten_id
left join public.puskesmas pkm on pkm.id = p.puskesmas_id
left join public.posyandu  psy on psy.id = p.posyandu_id
where p.status_akun = 'menunggu'
order by p.created_at;

comment on view public.v_antrean_verifikasi is
  'Antrean pendaftaran yang menunggu persetujuan, diurutkan dari yang paling lama menunggu. Kolom lama_menunggu dipakai untuk memantau agar tidak ada pendaftaran yang terlantar.';

-- ---------------------------------------------------------------------
-- BAGIAN 6: PENDELEGASIAN PERSETUJUAN KADER (TIDAK DIAKTIFKAN)
--
-- Menempatkan seluruh persetujuan di tangan admin provinsi berarti kader di
-- enam kabupaten menunggu satu meja. Bila di kemudian hari antreannya terbukti
-- menghambat, pertimbangkan mendelegasikan persetujuan kader kepada dokter di
-- puskesmas pembinanya, sementara persetujuan dokter dan dietisien tetap di
-- tangan admin karena menyangkut pemeriksaan STR.
--
-- Fungsi di bawah sudah disiapkan tetapi SENGAJA TIDAK DIBERI HAK EKSEKUSI.
-- Untuk mengaktifkannya, jalankan perintah grant pada komentar di bawah, dan
-- catat keputusan itu di dokumen tata kelola.
-- ---------------------------------------------------------------------

create or replace function public.verifikasi_kader_oleh_puskesmas(
  p_pengguna_id uuid,
  p_setujui boolean,
  p_alasan text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles;
  v_hasil  public.profiles;
begin
  if public.my_role() <> 'dokter' or not public.is_aktif() then
    raise exception 'Hanya dokter yang sudah disetujui dapat memverifikasi kader di puskesmasnya';
  end if;

  select * into v_target from public.profiles where id = p_pengguna_id;

  if v_target.id is null then
    raise exception 'Pengguna tidak ditemukan';
  end if;

  if v_target.role <> 'kader' then
    raise exception 'Pendelegasian ini hanya berlaku untuk peran kader';
  end if;

  if v_target.puskesmas_id is distinct from public.my_puskesmas_id() then
    raise exception 'Kader tersebut bukan berada di puskesmas Anda';
  end if;

  if not p_setujui and (p_alasan is null or length(btrim(p_alasan)) < 10) then
    raise exception 'Penolakan harus disertai alasan minimal 10 karakter';
  end if;

  update public.profiles
  set status_akun    = case when p_setujui then 'disetujui'::public.status_akun
                            else 'ditolak'::public.status_akun end,
      alasan_tolak   = case when p_setujui then null else btrim(p_alasan) end,
      disetujui_oleh = auth.uid(),
      disetujui_pada = now(),
      updated_at     = now()
  where id = p_pengguna_id
  returning * into v_hasil;

  return v_hasil;
end;
$$;

revoke execute on function public.verifikasi_kader_oleh_puskesmas(uuid, boolean, text)
  from public, anon, authenticated;

comment on function public.verifikasi_kader_oleh_puskesmas(uuid, boolean, text) is
  'BELUM AKTIF. Pendelegasian persetujuan kader kepada dokter di puskesmas pembinanya. Untuk mengaktifkan: grant execute on function public.verifikasi_kader_oleh_puskesmas(uuid, boolean, text) to authenticated;';

-- ---------------------------------------------------------------------
-- BAGIAN 7: MENERTIBKAN DATA YANG SUDAH ADA
--
-- Bila migrasi pertama sudah dijalankan dan sudah ada kader yang disetujui
-- otomatis, keputusan berikut perlu diambil secara sadar. Blok di bawah
-- SENGAJA DIKOMENTARI agar tidak berjalan tanpa keputusan Bapak.
--
-- Pilihan A: pertahankan kader yang sudah aktif, tetapi catat bahwa
--            persetujuannya berasal dari kebijakan lama.
--
-- update public.profiles
-- set disetujui_oleh = id,
--     disetujui_pada = created_at
-- where role = 'kader'
--   and status_akun = 'disetujui'
--   and disetujui_oleh is null;
--
-- Pilihan B: kembalikan seluruh kader ke antrean verifikasi. Pilihan ini lebih
--            tertib tetapi menghentikan pencatatan sampai admin selesai
--            memverifikasi. Jangan dijalankan pada hari posyandu.
--
-- update public.profiles
-- set status_akun = 'menunggu', disetujui_oleh = null, disetujui_pada = null
-- where role = 'kader' and status_akun = 'disetujui';
--
-- Bila belum ada data sama sekali, kedua blok tidak diperlukan.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- BAGIAN 8: ADMIN PERTAMA
--
-- Peran admin tidak dapat dibuat lewat pendaftaran mandiri. Setelah akun
-- didaftarkan seperti biasa, naikkan perannya sekali lewat SQL Editor:
--
-- update public.profiles
-- set role = 'admin',
--     status_akun = 'disetujui',
--     disetujui_oleh = id,
--     disetujui_pada = now()
-- where id = '<uuid-pengguna>';
--
-- Sediakan minimal dua akun admin institusional, bukan akun pribadi, agar tidak
-- ada satu titik kegagalan. Catat pemegangnya di dokumen tata kelola.
-- ---------------------------------------------------------------------

-- =====================================================================
-- SELESAI.
--
-- Setelah migrasi ini, jalankan ulang uji RLS. Tambahkan skenario berikut:
--   - kader berstatus menunggu membaca daftar balita  -> harus kosong
--   - kader berstatus menunggu menambah skrining      -> harus ditolak
--   - admin memverifikasi akunnya sendiri             -> harus gagal
--   - admin menolak tanpa alasan                      -> harus gagal
--   - dokter memanggil verifikasi_pengguna            -> harus gagal
-- =====================================================================
