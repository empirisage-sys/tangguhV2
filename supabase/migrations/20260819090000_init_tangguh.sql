-- =====================================================================
-- APLIKASI TANGGUH - MIGRASI AWAL SKEMA SUPABASE (PostgreSQL)
-- Versi        : 1.0
-- Tanggal      : 19 Agustus 2026
-- Cara pakai   : simpan sebagai supabase/migrations/20260819090000_init_tangguh.sql
--                lalu jalankan `supabase db push`
--
-- Catatan penting:
-- 1. Semua tabel WAJIB mengaktifkan RLS. Tidak ada pengecualian.
-- 2. Perhitungan Z-Score dilakukan di Server Action (TypeScript), bukan di
--    database. Database menyimpan hasil + versi engine untuk audit.
-- 3. Data medis tidak boleh dihapus keras (hard delete). Gunakan deleted_at.
-- =====================================================================

-- ---------------------------------------------------------------------
-- BAGIAN 1: EXTENSION & ENUM
-- ---------------------------------------------------------------------

create extension if not exists "pgcrypto";        -- gen_random_uuid()
create extension if not exists "pg_trgm";         -- pencarian nama balita

create type public.user_role as enum ('kader', 'dokter', 'dietisien', 'admin');

create type public.jenis_kelamin as enum ('L', 'P');

create type public.posisi_ukur as enum ('recumbent', 'standing', 'auto');

create type public.status_akun as enum ('menunggu', 'disetujui', 'ditolak');

create type public.status_tbu as enum ('sangat_pendek', 'pendek', 'normal', 'tinggi');

create type public.status_bbtb as enum ('gizi_buruk', 'gizi_kurang', 'gizi_baik', 'risiko_gizi_lebih', 'gizi_lebih', 'obesitas');

create type public.status_bbu as enum ('berat_badan_sangat_kurang', 'berat_badan_kurang', 'berat_badan_normal', 'risiko_berat_badan_lebih');

create type public.status_velocity as enum ('naik', 'tidak_naik', 'growth_faltering', 'tidak_dapat_dinilai');

create type public.indikator_who as enum ('WFA', 'HFA', 'WFL', 'WFH');

create type public.status_rujukan as enum ('diajukan', 'diterima', 'selesai', 'batal');

-- ---------------------------------------------------------------------
-- BAGIAN 2: MASTER WILAYAH
-- ---------------------------------------------------------------------

create table public.kabupaten (
  id          uuid primary key default gen_random_uuid(),
  kode        text unique not null,
  nama        text not null,
  created_at  timestamptz not null default now()
);

create table public.puskesmas (
  id            uuid primary key default gen_random_uuid(),
  kabupaten_id  uuid not null references public.kabupaten(id) on delete restrict,
  kode          text unique,
  nama          text not null,
  alamat        text,
  created_at    timestamptz not null default now()
);
create index idx_puskesmas_kabupaten on public.puskesmas(kabupaten_id);

create table public.posyandu (
  id            uuid primary key default gen_random_uuid(),
  puskesmas_id  uuid not null references public.puskesmas(id) on delete restrict,
  nama          text not null,
  desa          text,
  kecamatan     text,
  created_at    timestamptz not null default now()
);
create index idx_posyandu_puskesmas on public.posyandu(puskesmas_id);

-- ---------------------------------------------------------------------
-- BAGIAN 3: PROFIL PENGGUNA
-- ---------------------------------------------------------------------

create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  nama_lengkap   text not null,
  role           public.user_role not null default 'kader',
  no_str         text,                       -- wajib untuk dokter & dietisien
  no_hp          text,
  kabupaten_id   uuid references public.kabupaten(id),
  puskesmas_id   uuid references public.puskesmas(id),
  posyandu_id    uuid references public.posyandu(id),
  status_akun    public.status_akun not null default 'menunggu',
  alasan_tolak   text,
  disetujui_oleh uuid references public.profiles(id),
  disetujui_pada timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Nakes wajib mencantumkan STR
  constraint chk_str_nakes check (
    role not in ('dokter', 'dietisien') or (no_str is not null and length(no_str) >= 5)
  )
);
create index idx_profiles_role on public.profiles(role);
create index idx_profiles_puskesmas on public.profiles(puskesmas_id);
create index idx_profiles_status on public.profiles(status_akun);

-- ---------------------------------------------------------------------
-- BAGIAN 4: FUNGSI PEMBANTU OTORISASI (SECURITY DEFINER)
-- Fungsi ini dipakai di dalam policy RLS. Wajib SECURITY DEFINER agar
-- tidak terjadi rekursi ketika policy tabel profiles memanggilnya.
-- ---------------------------------------------------------------------

create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status_akun = 'disetujui'
  );
$$;

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
      and (p.status_akun = 'disetujui' or p.role = 'kader')
  );
$$;

create or replace function public.my_posyandu_id()
returns uuid
language sql stable security definer set search_path = ''
as $$ select p.posyandu_id from public.profiles p where p.id = auth.uid(); $$;

create or replace function public.my_puskesmas_id()
returns uuid
language sql stable security definer set search_path = ''
as $$ select p.puskesmas_id from public.profiles p where p.id = auth.uid(); $$;

create or replace function public.my_kabupaten_id()
returns uuid
language sql stable security definer set search_path = ''
as $$ select p.kabupaten_id from public.profiles p where p.id = auth.uid(); $$;

-- Cakupan baca data: kader = posyandu sendiri, nakes = seluruh puskesmas,
-- admin = seluruh provinsi.
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
  select case public.my_role()
    when 'admin'     then true
    when 'kader'     then p_posyandu_id = public.my_posyandu_id()
    when 'dokter'    then p_puskesmas_id = public.my_puskesmas_id()
    when 'dietisien' then p_puskesmas_id = public.my_puskesmas_id()
    else false
  end;
$$;

-- ---------------------------------------------------------------------
-- BAGIAN 5: TRIGGER PEMBUATAN PROFIL OTOMATIS
-- Data tambahan dikirim lewat options.data saat signUp() dan masuk ke
-- raw_user_meta_data.
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
    case when v_role = 'kader' then 'disetujui'::public.status_akun
         else 'menunggu'::public.status_akun end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger updated_at generik
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- BAGIAN 6: DATA BALITA
-- ---------------------------------------------------------------------

create table public.balita (
  id             uuid primary key default gen_random_uuid(),
  nik            text,
  nama           text not null,
  tanggal_lahir  date not null,
  jenis_kelamin  public.jenis_kelamin not null,
  nama_ibu       text,
  nama_ayah      text,
  no_hp_ortu     text,
  alamat         text,
  posyandu_id    uuid not null references public.posyandu(id) on delete restrict,
  puskesmas_id   uuid not null references public.puskesmas(id) on delete restrict,
  kabupaten_id   uuid not null references public.kabupaten(id) on delete restrict,
  bb_lahir_gram  integer,
  pb_lahir_cm    numeric(4,1),
  usia_gestasi_minggu smallint,
  created_by     uuid not null references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,

  constraint chk_tgl_lahir check (tanggal_lahir <= current_date),
  constraint chk_bb_lahir  check (bb_lahir_gram is null or bb_lahir_gram between 300 and 7000)
);

-- Cegah duplikasi entri balita yang sama di satu posyandu
create unique index uq_balita_identitas
  on public.balita (posyandu_id, lower(nama), tanggal_lahir)
  where deleted_at is null;

create index idx_balita_posyandu on public.balita(posyandu_id) where deleted_at is null;
create index idx_balita_puskesmas on public.balita(puskesmas_id) where deleted_at is null;
create index idx_balita_nama_trgm on public.balita using gin (nama gin_trgm_ops);
create index idx_balita_nik on public.balita(nik) where nik is not null;

create trigger trg_balita_updated
  before update on public.balita
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- BAGIAN 7: SKRINING ANTROPOMETRI
-- ---------------------------------------------------------------------

create table public.skrining (
  id                    uuid primary key default gen_random_uuid(),
  client_uuid           uuid not null unique,   -- kunci idempoten untuk sinkronisasi offline
  balita_id             uuid not null references public.balita(id) on delete restrict,

  tanggal_periksa       date not null,
  umur_hari             integer not null,
  umur_bulan            numeric(5,2) not null,

  berat_kg              numeric(5,2) not null,
  panjang_cm            numeric(5,1) not null,
  posisi_ukur           public.posisi_ukur not null default 'auto',
  panjang_terkoreksi_cm numeric(5,1) not null,
  lila_cm               numeric(4,1),
  lingkar_kepala_cm     numeric(4,1),
  edema                 boolean not null default false,

  z_bbu                 numeric(6,3),
  z_tbu                 numeric(6,3),
  z_bbtb                numeric(6,3),
  status_bbu            public.status_bbu,
  status_tbu            public.status_tbu,
  status_bbtb           public.status_bbtb,
  is_red_flag           boolean not null default false,

  bb_ideal_kg           numeric(5,2),
  kalori_target_kkal    integer,
  protein_min_gram      numeric(5,1),
  protein_max_gram      numeric(5,1),
  rekomendasi_pkmk      jsonb,

  engine_version        text not null,   -- contoh: 'zscore-1.2.0'
  dihitung_di           text not null default 'server',  -- 'server' | 'client-offline'
  catatan               text,

  posyandu_id           uuid not null references public.posyandu(id),
  puskesmas_id          uuid not null references public.puskesmas(id),
  kabupaten_id          uuid not null references public.kabupaten(id),

  created_by            uuid not null references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,

  constraint chk_berat   check (berat_kg between 0.5 and 40),
  constraint chk_panjang check (panjang_cm between 30 and 140),
  constraint chk_umur    check (umur_hari between 0 and 2100),
  constraint chk_tanggal check (tanggal_periksa <= current_date)
);

create index idx_skrining_balita on public.skrining(balita_id, tanggal_periksa desc) where deleted_at is null;
create index idx_skrining_posyandu_tgl on public.skrining(posyandu_id, tanggal_periksa desc);
create index idx_skrining_puskesmas_tgl on public.skrining(puskesmas_id, tanggal_periksa desc);
create index idx_skrining_redflag on public.skrining(puskesmas_id) where is_red_flag = true and deleted_at is null;

create trigger trg_skrining_updated
  before update on public.skrining
  for each row execute function public.set_updated_at();

-- Cegah dua skrining pada balita yang sama di tanggal yang sama
create unique index uq_skrining_harian
  on public.skrining (balita_id, tanggal_periksa)
  where deleted_at is null;

-- ---------------------------------------------------------------------
-- BAGIAN 8: EVALUASI KENAIKAN BERAT (WEIGHT VELOCITY)
-- ---------------------------------------------------------------------

create table public.evaluasi_velocity (
  id                 uuid primary key default gen_random_uuid(),
  skrining_id        uuid not null references public.skrining(id) on delete cascade,
  skrining_awal_id   uuid not null references public.skrining(id) on delete restrict,
  selisih_hari       integer not null,
  kenaikan_aktual_g  integer not null,
  kenaikan_minimal_g integer not null,
  metode             text not null,   -- 'WHO_P5' | 'KBM_Kemenkes'
  status             public.status_velocity not null,
  created_at         timestamptz not null default now(),
  unique (skrining_id)
);

-- ---------------------------------------------------------------------
-- BAGIAN 9: PRODUK PKMK & ASUHAN GIZI
-- ---------------------------------------------------------------------

create table public.produk_pkmk (
  id                   uuid primary key default gen_random_uuid(),
  nama                 text not null,
  merek                text,
  kkal_per_ml          numeric(4,2) not null,
  protein_g_per_100ml  numeric(4,2),
  gram_per_sendok_takar numeric(5,2),
  ml_per_saji          integer,
  min_usia_bulan       smallint not null default 0,
  maks_usia_bulan      smallint,
  anjuran_klinis       text,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now()
);

create table public.asuhan_gizi (
  id                uuid primary key default gen_random_uuid(),
  balita_id         uuid not null references public.balita(id) on delete restrict,
  skrining_id       uuid references public.skrining(id) on delete set null,
  dietisien_id      uuid not null references public.profiles(id),
  diagnosis_gizi    text not null,
  produk_pkmk_id    uuid references public.produk_pkmk(id),
  dosis_ml_per_hari integer,
  frekuensi_per_hari smallint,
  kalori_target     integer,
  protein_target_g  numeric(5,1),
  meal_plan         jsonb,
  tanggal_mulai     date not null default current_date,
  tanggal_evaluasi  date,
  catatan           text,
  puskesmas_id      uuid not null references public.puskesmas(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_asuhan_balita on public.asuhan_gizi(balita_id, tanggal_mulai desc);

create trigger trg_asuhan_updated
  before update on public.asuhan_gizi
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- BAGIAN 10: RUJUKAN
-- ---------------------------------------------------------------------

create table public.rujukan (
  id            uuid primary key default gen_random_uuid(),
  balita_id     uuid not null references public.balita(id) on delete restrict,
  skrining_id   uuid references public.skrining(id) on delete set null,
  tujuan        text not null,
  alasan        text not null,
  status        public.status_rujukan not null default 'diajukan',
  diajukan_oleh uuid not null references public.profiles(id),
  puskesmas_id  uuid not null references public.puskesmas(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_rujukan_status on public.rujukan(puskesmas_id, status);

create trigger trg_rujukan_updated
  before update on public.rujukan
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- BAGIAN 11: REFERENSI WHO (LMS & VELOCITY)
-- Tabel ini adalah salinan kanonik untuk audit. Aplikasi tetap memakai
-- salinan statis TypeScript agar bisa menghitung saat offline.
-- ---------------------------------------------------------------------

create table public.who_lms (
  indikator public.indikator_who not null,
  seks      public.jenis_kelamin not null,
  x         numeric(6,2) not null,   -- umur (bulan) atau panjang/tinggi (cm)
  l         numeric(12,8) not null,
  m         numeric(12,8) not null,
  s         numeric(12,8) not null,
  primary key (indikator, seks, x)
);

create table public.who_velocity (
  seks             public.jenis_kelamin not null,
  interval_bulan   smallint not null check (interval_bulan in (1,2,3)),
  umur_awal_bulan  smallint not null,
  p5_gram          integer not null,
  p50_gram         integer not null,
  primary key (seks, interval_bulan, umur_awal_bulan)
);

-- ---------------------------------------------------------------------
-- BAGIAN 12: AUDIT LOG
-- ---------------------------------------------------------------------

create table public.audit_log (
  id         bigserial primary key,
  actor_id   uuid,
  aksi       text not null,
  tabel      text not null,
  row_id     text,
  data_lama  jsonb,
  data_baru  jsonb,
  at         timestamptz not null default now()
);
create index idx_audit_at on public.audit_log(at desc);

create or replace function public.tulis_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, aksi, tabel, row_id, data_lama, data_baru)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(new.id::text, old.id::text),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_skrining
  after insert or update or delete on public.skrining
  for each row execute function public.tulis_audit();

create trigger trg_audit_profiles
  after update on public.profiles
  for each row execute function public.tulis_audit();

-- ---------------------------------------------------------------------
-- BAGIAN 13: AKTIFKAN RLS DI SEMUA TABEL
-- ---------------------------------------------------------------------

alter table public.kabupaten        enable row level security;
alter table public.puskesmas        enable row level security;
alter table public.posyandu         enable row level security;
alter table public.profiles         enable row level security;
alter table public.balita           enable row level security;
alter table public.skrining         enable row level security;
alter table public.evaluasi_velocity enable row level security;
alter table public.produk_pkmk      enable row level security;
alter table public.asuhan_gizi      enable row level security;
alter table public.rujukan          enable row level security;
alter table public.who_lms          enable row level security;
alter table public.who_velocity     enable row level security;
alter table public.audit_log        enable row level security;

-- ---- Master wilayah: semua pengguna terautentikasi boleh membaca -----
create policy "wilayah dibaca semua" on public.kabupaten
  for select to authenticated using (true);
create policy "wilayah dibaca semua" on public.puskesmas
  for select to authenticated using (true);
create policy "wilayah dibaca semua" on public.posyandu
  for select to authenticated using (true);

create policy "wilayah dikelola admin" on public.kabupaten
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "wilayah dikelola admin" on public.puskesmas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "wilayah dikelola admin" on public.posyandu
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- Referensi WHO & PKMK -------------------------------------------
create policy "referensi dibaca semua" on public.who_lms
  for select to authenticated using (true);
create policy "referensi dibaca semua" on public.who_velocity
  for select to authenticated using (true);
create policy "referensi dibaca semua" on public.produk_pkmk
  for select to authenticated using (is_active or public.is_admin());

create policy "referensi dikelola admin" on public.who_lms
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "referensi dikelola admin" on public.who_velocity
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "referensi dikelola admin" on public.produk_pkmk
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- Profiles --------------------------------------------------------
create policy "baca profil sendiri" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "admin baca semua profil" on public.profiles
  for select to authenticated
  using (public.is_admin());

create policy "nakes baca profil satu puskesmas" on public.profiles
  for select to authenticated
  using (
    public.my_role() in ('dokter','dietisien')
    and puskesmas_id = public.my_puskesmas_id()
  );

-- Pengguna boleh memperbarui datanya sendiri, TAPI tidak boleh mengubah
-- role atau status akun sendiri.
create policy "ubah profil sendiri" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and status_akun = (select p.status_akun from public.profiles p where p.id = auth.uid())
  );

create policy "admin kelola profil" on public.profiles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- Balita ----------------------------------------------------------
create policy "baca balita sesuai cakupan" on public.balita
  for select to authenticated
  using (deleted_at is null and public.boleh_lihat(posyandu_id, puskesmas_id, kabupaten_id));

create policy "tambah balita sesuai cakupan" on public.balita
  for insert to authenticated
  with check (
    public.is_aktif()
    and created_by = auth.uid()
    and public.boleh_lihat(posyandu_id, puskesmas_id, kabupaten_id)
  );

create policy "ubah balita sesuai cakupan" on public.balita
  for update to authenticated
  using (public.is_aktif() and public.boleh_lihat(posyandu_id, puskesmas_id, kabupaten_id))
  with check (public.boleh_lihat(posyandu_id, puskesmas_id, kabupaten_id));

-- Tidak ada policy DELETE: penghapusan hanya via kolom deleted_at.

-- ---- Skrining --------------------------------------------------------
create policy "baca skrining sesuai cakupan" on public.skrining
  for select to authenticated
  using (deleted_at is null and public.boleh_lihat(posyandu_id, puskesmas_id, kabupaten_id));

create policy "tambah skrining sesuai cakupan" on public.skrining
  for insert to authenticated
  with check (
    public.is_aktif()
    and created_by = auth.uid()
    and public.boleh_lihat(posyandu_id, puskesmas_id, kabupaten_id)
  );

-- Koreksi data hanya oleh pembuatnya dalam 24 jam, atau oleh admin.
create policy "koreksi skrining terbatas" on public.skrining
  for update to authenticated
  using (
    public.is_admin()
    or (created_by = auth.uid() and created_at > now() - interval '24 hours')
  )
  with check (public.boleh_lihat(posyandu_id, puskesmas_id, kabupaten_id));

-- ---- Evaluasi velocity ----------------------------------------------
create policy "baca evaluasi via skrining" on public.evaluasi_velocity
  for select to authenticated
  using (exists (
    select 1 from public.skrining s
    where s.id = skrining_id
      and public.boleh_lihat(s.posyandu_id, s.puskesmas_id, s.kabupaten_id)
  ));

create policy "tambah evaluasi via skrining" on public.evaluasi_velocity
  for insert to authenticated
  with check (exists (
    select 1 from public.skrining s
    where s.id = skrining_id
      and public.boleh_lihat(s.posyandu_id, s.puskesmas_id, s.kabupaten_id)
  ));

-- ---- Asuhan gizi: khusus dietisien & dokter -------------------------
create policy "baca asuhan gizi" on public.asuhan_gizi
  for select to authenticated
  using (
    public.is_admin()
    or (public.my_role() in ('dokter','dietisien') and puskesmas_id = public.my_puskesmas_id())
  );

create policy "dietisien kelola asuhan gizi" on public.asuhan_gizi
  for insert to authenticated
  with check (
    public.my_role() = 'dietisien'
    and public.is_aktif()
    and dietisien_id = auth.uid()
    and puskesmas_id = public.my_puskesmas_id()
  );

create policy "dietisien ubah asuhan gizi" on public.asuhan_gizi
  for update to authenticated
  using (dietisien_id = auth.uid() or public.is_admin())
  with check (puskesmas_id = public.my_puskesmas_id() or public.is_admin());

-- ---- Rujukan ---------------------------------------------------------
create policy "baca rujukan" on public.rujukan
  for select to authenticated
  using (public.is_admin() or puskesmas_id = public.my_puskesmas_id());

create policy "ajukan rujukan" on public.rujukan
  for insert to authenticated
  with check (public.is_aktif() and diajukan_oleh = auth.uid());

create policy "perbarui status rujukan" on public.rujukan
  for update to authenticated
  using (
    public.is_admin()
    or (public.my_role() in ('dokter','dietisien') and puskesmas_id = public.my_puskesmas_id())
  )
  with check (true);

-- ---- Audit log: hanya admin -----------------------------------------
create policy "audit hanya admin" on public.audit_log
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- BAGIAN 14: VIEW REKAPITULASI
-- security_invoker = on WAJIB, agar RLS pemanggil tetap berlaku.
-- ---------------------------------------------------------------------

create view public.v_skrining_terakhir
with (security_invoker = on) as
select distinct on (s.balita_id)
  s.*,
  b.nama          as nama_balita,
  b.tanggal_lahir,
  b.jenis_kelamin
from public.skrining s
join public.balita b on b.id = s.balita_id
where s.deleted_at is null and b.deleted_at is null
order by s.balita_id, s.tanggal_periksa desc, s.created_at desc;

create view public.v_rekap_bulanan
with (security_invoker = on) as
select
  s.kabupaten_id,
  s.puskesmas_id,
  s.posyandu_id,
  date_trunc('month', s.tanggal_periksa)::date as bulan,
  count(*)                                                      as total_skrining,
  count(distinct s.balita_id)                                   as total_balita,
  count(*) filter (where s.status_tbu in ('pendek','sangat_pendek'))   as jumlah_stunting,
  count(*) filter (where s.status_tbu = 'sangat_pendek')               as jumlah_sangat_pendek,
  count(*) filter (where s.status_bbtb = 'gizi_buruk')                 as jumlah_gizi_buruk,
  count(*) filter (where s.status_bbtb = 'gizi_kurang')                as jumlah_gizi_kurang,
  count(*) filter (where s.is_red_flag)                                as jumlah_red_flag,
  round(avg(s.z_tbu)::numeric, 3)                                      as rerata_z_tbu
from public.skrining s
where s.deleted_at is null
group by 1,2,3,4;

-- ---------------------------------------------------------------------
-- BAGIAN 15: SEED MASTER WILAYAH (6 kabupaten/kota Gorontalo)
-- Puskesmas & posyandu diisi menyusul lewat panel admin atau seed CSV.
-- ---------------------------------------------------------------------

insert into public.kabupaten (kode, nama) values
  ('7501', 'Kabupaten Boalemo'),
  ('7502', 'Kabupaten Gorontalo'),
  ('7503', 'Kabupaten Pohuwato'),
  ('7504', 'Kabupaten Bone Bolango'),
  ('7505', 'Kabupaten Gorontalo Utara'),
  ('7571', 'Kota Gorontalo')
on conflict (kode) do nothing;

-- =====================================================================
-- SELESAI. Setelah push, jalankan uji RLS (lihat panduan Bagian 11).
-- =====================================================================
