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
  using (
    deleted_at is null
    and (
      public.is_admin()
      or (public.my_role() = 'kader' and posyandu_id = public.my_posyandu_id())
      or (public.my_role() = 'dietisien' and puskesmas_id = public.my_puskesmas_id())
      or (
        public.my_role() = 'dokter'
        and (
          created_by = auth.uid()
          or exists (
            select 1 from public.rujukan r
            where r.balita_id = public.balita.id
            and (
              r.puskesmas_id = public.my_puskesmas_id()
              or r.rs_tujuan_id = public.my_puskesmas_id()
            )
          )
        )
      )
    )
  );

create policy "tambah balita sesuai cakupan" on public.balita
  for insert to authenticated
  with check (
    public.is_aktif()
    and created_by = auth.uid()
  );

create policy "ubah balita sesuai cakupan" on public.balita
  for update to authenticated
  using (
    public.is_aktif()
    and (
      public.is_admin()
      or (public.my_role() = 'kader' and posyandu_id = public.my_posyandu_id())
      or (public.my_role() = 'dietisien' and puskesmas_id = public.my_puskesmas_id())
      or (public.my_role() = 'dokter' and created_by = auth.uid())
    )
  )
  with check (
    public.is_admin()
    or (public.my_role() = 'kader' and posyandu_id = public.my_posyandu_id())
    or (public.my_role() = 'dietisien' and puskesmas_id = public.my_puskesmas_id())
    or (public.my_role() = 'dokter' and created_by = auth.uid())
  );

-- Tidak ada policy DELETE: penghapusan hanya via kolom deleted_at.

-- ---- Skrining --------------------------------------------------------
create policy "baca skrining sesuai cakupan" on public.skrining
  for select to authenticated
  using (
    deleted_at is null
    and (
      public.is_admin()
      or (public.my_role() = 'kader' and posyandu_id = public.my_posyandu_id())
      or (public.my_role() = 'dietisien' and puskesmas_id = public.my_puskesmas_id())
      or (
        public.my_role() = 'dokter'
        and (
          created_by = auth.uid()
          or exists (
            select 1 from public.rujukan r
            where r.balita_id = public.skrining.balita_id
            and (
              r.puskesmas_id = public.my_puskesmas_id()
              or r.rs_tujuan_id = public.my_puskesmas_id()
            )
          )
        )
      )
    )
  );

create policy "tambah skrining sesuai cakupan" on public.skrining
  for insert to authenticated
  with check (
    public.is_aktif()
    and created_by = auth.uid()
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
-- =====================================================================
-- APLIKASI TANGGUH - MIGRASI TAMBAHAN: PENYESUAIAN HASIL TELAAH KODE LAMA
-- Versi     : 1.1
-- Tanggal   : 19 Agustus 2026
-- Prasyarat : 20260819090000_init_tangguh.sql sudah dijalankan
-- Rujukan   : TELAAH_KODE_LAMA_TANGGUH.md
--
-- Migrasi ini menambahkan kolom dan nilai enum yang dibutuhkan untuk:
--   T-1/T-2 : dua angka kebutuhan gizi (pemeliharaan & tumbuh kejar)
--   T-3     : penanda nilai di luar rentang standar WHO
--   S-2     : data kalori PKMK per produk
--   S-4     : penanda hasil migrasi yang dihitung ulang
-- =====================================================================

-- ---------------------------------------------------------------------
-- T-1 & T-2: Dua angka kebutuhan gizi
-- Kolom lama (kalori_target_kkal, protein_min_gram, protein_max_gram)
-- tetap ada dan diisi nilai PEMELIHARAAN agar sebanding dengan data lama.
-- Kolom baru menyimpan target TUMBUH KEJAR.
-- ---------------------------------------------------------------------

create type public.metode_kalori as enum ('pemeliharaan', 'catch_up');

alter table public.skrining
  add column usia_tinggi_bulan        numeric(5,2),
  add column rda_kkal_per_kg          smallint,
  add column kalori_catchup_kkal      integer,
  add column protein_catchup_min_gram numeric(5,1),
  add column protein_catchup_max_gram numeric(5,1),
  add column kalori_metode            public.metode_kalori not null default 'pemeliharaan',
  add column gizi_terverifikasi_oleh  uuid references public.profiles(id),
  add column gizi_terverifikasi_pada  timestamptz;

comment on column public.skrining.kalori_target_kkal is
  'Kebutuhan PEMELIHARAAN: RDA(usia kronologis) x berat aktual. Setara perilaku aplikasi lama.';
comment on column public.skrining.kalori_catchup_kkal is
  'Target TUMBUH KEJAR: RDA(usia-tinggi) x berat ideal untuk tinggi. Wajib diverifikasi nutrisionis sebelum dipakai sebagai dasar terapi.';
comment on column public.skrining.usia_tinggi_bulan is
  'Usia-tinggi (height-age) hasil interpolasi median tabel TB/U. Dasar perhitungan RDA tumbuh kejar.';
comment on column public.skrining.gizi_terverifikasi_oleh is
  'Diisi dokter atau dietisien yang memverifikasi angka kebutuhan gizi pada baris ini.';

-- ---------------------------------------------------------------------
-- T-3: Penanda nilai di luar rentang standar WHO
-- Menggantikan perilaku lama yang menjepit nilai ke tepi tabel.
-- ---------------------------------------------------------------------

alter table public.skrining
  add column di_luar_rentang         boolean not null default false,
  add column catatan_di_luar_rentang text;

comment on column public.skrining.di_luar_rentang is
  'true bila usia > 60 bulan atau panjang/tinggi di luar rentang tabel WHO. Bila true, kolom z-score dan status boleh NULL.';

-- Batas usia diperketat: standar WHO yang dipakai aplikasi hanya 0-60 bulan.
-- 1857 hari kira-kira 61 bulan, memberi kelonggaran sedikit untuk pembulatan.
alter table public.skrining drop constraint chk_umur;
alter table public.skrining add constraint chk_umur
  check (umur_hari between 0 and 1857);

-- Baris di luar rentang wajib menyertakan keterangan.
alter table public.skrining add constraint chk_di_luar_rentang_berketerangan
  check (di_luar_rentang = false or catatan_di_luar_rentang is not null);

-- ---------------------------------------------------------------------
-- T-4: Kategori TB/U mengikuti standar Kemenkes
-- Nilai enum lama sudah benar (sangat_pendek, pendek, normal, tinggi).
-- Tidak ada perubahan struktur; hanya perubahan ambang di lapisan kode:
--   normal berlaku sampai +3 SD, di atas +3 SD berkategori 'tinggi'.
-- Kategori "Sangat Tinggi" dari aplikasi lama tidak dipakai.
-- ---------------------------------------------------------------------

-- (tidak ada perintah SQL; dicatat di sini agar terlacak di riwayat migrasi)

-- ---------------------------------------------------------------------
-- S-2: Data PKMK per produk, satu sumber kebenaran
-- Menghapus dua sumber yang bertentangan di aplikasi lama
-- (pkmkData di constants.ts dan getPkmkSpecs di App.tsx).
-- ---------------------------------------------------------------------

alter table public.produk_pkmk
  add column sendok_per_saji     smallint,
  add column kkal_per_saji       integer,
  add column ml_air_per_sendok   numeric(4,1),
  add column densitas_kkal_per_ml numeric(4,2);

-- kkal per sendok takar dihitung, tidak diketik manual
alter table public.produk_pkmk
  add column kkal_per_sendok numeric(5,2)
  generated always as (
    case when sendok_per_saji is null or sendok_per_saji = 0 then null
         else kkal_per_saji::numeric / sendok_per_saji end
  ) stored;

comment on column public.produk_pkmk.kkal_per_sendok is
  'Dihitung otomatis. Aplikasi lama memakai nilai tetap 25 kkal untuk semua produk, padahal nilai sebenarnya berkisar 20-40.';

-- Seed lima produk sesuai data aplikasi lama.
-- Nilai min_usia_bulan bersifat sementara dan WAJIB diperiksa terhadap
-- label kemasan serta indikasi klinis sebelum dipakai.
insert into public.produk_pkmk
  (nama, merek, kkal_per_ml, sendok_per_saji, kkal_per_saji, ml_per_saji,
   ml_air_per_sendok, densitas_kkal_per_ml, min_usia_bulan, anjuran_klinis)
values
  ('SGM Gain 100',      'SGM',       1.00, 5,  100, 90,  30, 1.00, 12,
   'Periksa label kemasan untuk indikasi usia dan cara penyiapan.'),
  ('SGM Optigrow',      'SGM',       1.00, 4,  160, 180, 30, 1.00, 12,
   'Periksa label kemasan untuk indikasi usia dan cara penyiapan.'),
  ('DanGro Gain&Grow',  'Danone',    1.00, 5,  180, 180, 30, 1.00, 12,
   'Periksa label kemasan untuk indikasi usia dan cara penyiapan.'),
  ('PediaComplete',     'Kalbe',     1.00, 5,  200, 190, 38, 1.00, 12,
   'Periksa label kemasan untuk indikasi usia dan cara penyiapan.'),
  ('Nutrinidrink',      'Nutricia',  1.50, 10, 300, 150, 30, 1.50, 12,
   'Densitas 1,5 kkal/ml. Untuk kebutuhan kalori padat. Periksa label kemasan.')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- S-4: Penanda asal data
-- Aplikasi lama menyimpan objek results yang dihitung oleh dua jalur kode
-- yang sudah menyimpang. Saat migrasi, hanya angka mentah yang dipindahkan
-- dan seluruh nilai turunan dihitung ulang. Kolom ini merekam asal baris.
-- ---------------------------------------------------------------------

create type public.asal_data as enum ('input_langsung', 'sinkronisasi_offline', 'migrasi_firestore');

alter table public.skrining
  add column asal_data       public.asal_data not null default 'input_langsung',
  add column ref_firestore_id text;

create index idx_skrining_ref_firestore
  on public.skrining(ref_firestore_id)
  where ref_firestore_id is not null;

comment on column public.skrining.ref_firestore_id is
  'ID dokumen asal di Firestore. Dipakai untuk penelusuran dan pencegahan duplikasi saat migrasi.';

-- ---------------------------------------------------------------------
-- S-3: Batas penilaian velocity 21-110 hari
-- ---------------------------------------------------------------------

alter table public.evaluasi_velocity
  add constraint chk_selisih_hari_wajar
  check (
    status = 'tidak_dapat_dinilai'
    or selisih_hari between 21 and 110
  );

comment on constraint chk_selisih_hari_wajar on public.evaluasi_velocity is
  'Aplikasi lama menskalakan ambang P5 secara linear untuk selisih hari berapa pun. Laju pertumbuhan tidak linear terhadap usia, sehingga penilaian di luar 21-110 hari harus berstatus tidak_dapat_dinilai.';

-- ---------------------------------------------------------------------
-- Tambahan: kolom penapisan gizi buruk yang belum ada di aplikasi lama
-- (LILA dan edema sudah ada di migrasi awal; ini melengkapi klasifikasinya)
-- ---------------------------------------------------------------------

create type public.status_lila as enum ('normal', 'risiko', 'gizi_kurang', 'gizi_buruk', 'tidak_diukur');

alter table public.skrining
  add column status_lila public.status_lila not null default 'tidak_diukur';

comment on column public.skrining.status_lila is
  'Klasifikasi LILA untuk usia 6-59 bulan. Bersama edema bilateral menjadi penentu gizi buruk selain BB/TB.';

-- ---------------------------------------------------------------------
-- Perbarui view rekap agar memuat kolom baru
-- ---------------------------------------------------------------------

drop view if exists public.v_rekap_bulanan;

create view public.v_rekap_bulanan
with (security_invoker = on) as
select
  s.kabupaten_id,
  s.puskesmas_id,
  s.posyandu_id,
  date_trunc('month', s.tanggal_periksa)::date as bulan,
  count(*)                                                            as total_skrining,
  count(distinct s.balita_id)                                         as total_balita,
  count(*) filter (where s.di_luar_rentang)                           as jumlah_di_luar_rentang,
  count(*) filter (where s.status_tbu in ('pendek','sangat_pendek'))  as jumlah_stunting,
  count(*) filter (where s.status_tbu = 'sangat_pendek')              as jumlah_sangat_pendek,
  count(*) filter (where s.status_bbtb = 'gizi_buruk')                as jumlah_gizi_buruk,
  count(*) filter (where s.status_bbtb = 'gizi_kurang')               as jumlah_gizi_kurang,
  count(*) filter (where s.status_lila = 'gizi_buruk')                as jumlah_lila_gizi_buruk,
  count(*) filter (where s.edema)                                     as jumlah_edema,
  count(*) filter (where s.is_red_flag)                               as jumlah_red_flag,
  count(*) filter (where s.kalori_metode = 'catch_up')                as jumlah_target_catchup,
  -- penyebut untuk prevalensi: hanya baris yang dapat dinilai
  count(*) filter (where s.status_tbu is not null)                    as penyebut_tbu,
  count(*) filter (where s.status_bbtb is not null)                   as penyebut_bbtb,
  round(avg(s.z_tbu)::numeric, 3)                                     as rerata_z_tbu
from public.skrining s
where s.deleted_at is null
group by 1,2,3,4;

comment on view public.v_rekap_bulanan is
  'Kolom penyebut_* disediakan agar persentase prevalensi selalu dapat ditampilkan bersama pembilang dan penyebutnya. Baris di_luar_rentang tidak masuk penyebut.';

-- =====================================================================
-- SELESAI.
--
-- Setelah menjalankan migrasi ini:
--   1. supabase gen types typescript --linked > src/types/database.ts
--   2. Perbarui skema Zod di src/lib/validasi/skrining.ts
--   3. Periksa kembali data min_usia_bulan pada tabel produk_pkmk
--      terhadap label kemasan bersama dietisien
-- =====================================================================
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
-- =====================================================================
-- APLIKASI TANGGUH - MIGRASI KEEMPAT
-- JENJANG WILAYAH (38 PROVINSI) DAN FASILITAS KESEHATAN (PUSKESMAS & RUMAH SAKIT)
--
-- Versi     : 1.4
-- Tanggal   : 20 Agustus 2026
-- Prasyarat : 20260819090000_init_tangguh.sql
--             20260819120000_patch_temuan_telaah.sql
--             20260819140000_approval_semua_peran.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- BAGIAN 1: TABEL PROVINSI (38 PROVINSI SE-INDONESIA)
-- ---------------------------------------------------------------------

create table if not exists public.provinsi (
  id         uuid primary key default gen_random_uuid(),
  kode       text not null unique,
  nama       text not null,
  created_at timestamptz not null default now()
);

-- Seed 38 Provinsi
insert into public.provinsi (kode, nama) values
  ('11', 'Aceh'),
  ('12', 'Sumatera Utara'),
  ('13', 'Sumatera Barat'),
  ('14', 'Riau'),
  ('15', 'Jambi'),
  ('16', 'Sumatera Selatan'),
  ('17', 'Bengkulu'),
  ('18', 'Lampung'),
  ('19', 'Kepulauan Bangka Belitung'),
  ('21', 'Kepulauan Riau'),
  ('31', 'DKI Jakarta'),
  ('32', 'Jawa Barat'),
  ('33', 'Jawa Tengah'),
  ('34', 'DI Yogyakarta'),
  ('35', 'Jawa Timur'),
  ('36', 'Banten'),
  ('51', 'Bali'),
  ('52', 'Nusa Tenggara Barat'),
  ('53', 'Nusa Tenggara Timur'),
  ('61', 'Kalimantan Barat'),
  ('62', 'Kalimantan Tengah'),
  ('63', 'Kalimantan Selatan'),
  ('64', 'Kalimantan Timur'),
  ('65', 'Kalimantan Utara'),
  ('71', 'Sulawesi Utara'),
  ('72', 'Sulawesi Tengah'),
  ('73', 'Sulawesi Selatan'),
  ('74', 'Sulawesi Tenggara'),
  ('75', 'Gorontalo'),
  ('76', 'Sulawesi Barat'),
  ('81', 'Maluku'),
  ('82', 'Maluku Utara'),
  ('91', 'Papua Barat'),
  ('92', 'Papua Barat Daya'),
  ('94', 'Papua'),
  ('95', 'Papua Selatan'),
  ('96', 'Papua Tengah'),
  ('97', 'Papua Pegunungan')
on conflict (kode) do update set nama = excluded.nama;

-- Tambah provinsi_id pada kabupaten
alter table public.kabupaten add column if not exists provinsi_id uuid references public.provinsi(id);

-- Update kabupaten Gorontalo agar menunjuk ke provinsi Gorontalo
update public.kabupaten
set provinsi_id = (select id from public.provinsi where kode = '75')
where provinsi_id is null;

-- ---------------------------------------------------------------------
-- BAGIAN 2: TABEL FASKES (PUSKESMAS & RUMAH SAKIT)
-- ---------------------------------------------------------------------

create type public.jenis_faskes as enum ('puskesmas', 'rumah_sakit');
create type public.status_faskes as enum ('master', 'usulan');

create table if not exists public.faskes (
  id              uuid primary key default gen_random_uuid(),
  nama            text not null,
  jenis           public.jenis_faskes not null default 'puskesmas',
  status          public.status_faskes not null default 'master',
  kabupaten_id    uuid references public.kabupaten(id) on delete restrict,
  diusulkan_oleh  uuid references public.profiles(id),
  sumber_data     text not null default 'seed_dinkes',
  kode_kemenkes   text,
  perlu_verifikasi boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_faskes_kabupaten on public.faskes(kabupaten_id, jenis, status);

-- Tambah status usulan pada posyandu
alter table public.posyandu add column if not exists status public.status_faskes not null default 'master';
alter table public.posyandu add column if not exists diusulkan_oleh uuid references public.profiles(id);

-- Migrasi data lama dari puskesmas ke faskes jika ada
insert into public.faskes (id, nama, jenis, status, kabupaten_id, created_at)
select id, nama, 'puskesmas'::public.jenis_faskes, 'master'::public.status_faskes, kabupaten_id, created_at
from public.puskesmas
on conflict (id) do nothing;

-- Perbarui tabel profiles, balita, skrining
alter table public.profiles add column if not exists faskes_id uuid references public.faskes(id);
alter table public.profiles add column if not exists provinsi_id uuid references public.provinsi(id);
alter table public.profiles add column if not exists jenis_faskes public.jenis_faskes default 'puskesmas';

update public.profiles set faskes_id = puskesmas_id where faskes_id is null and puskesmas_id is not null;

alter table public.balita add column if not exists faskes_id uuid references public.faskes(id);
update public.balita set faskes_id = puskesmas_id where faskes_id is null and puskesmas_id is not null;

alter table public.skrining add column if not exists faskes_id uuid references public.faskes(id);
update public.skrining set faskes_id = puskesmas_id where faskes_id is null and puskesmas_id is not null;

-- ---------------------------------------------------------------------
-- BAGIAN 3: FUNGSI USULAN & NORMALISASI FASILITAS OLEH ADMIN
-- ---------------------------------------------------------------------

-- Fungsi untuk mengusulkan fasilitas baru (isian manual saat registrasi)
create or replace function public.usulkan_faskes(
  p_nama text,
  p_jenis public.jenis_faskes,
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
  insert into public.faskes (
    nama, jenis, status, kabupaten_id, sumber_data, perlu_verifikasi
  )
  values (
    trim(p_nama), p_jenis, 'usulan'::public.status_faskes, p_kabupaten_id, 'usulan_pengguna', true
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Fungsi untuk mengusulkan posyandu baru (isian manual kader)
create or replace function public.usulkan_posyandu(
  p_nama text,
  p_kabupaten_id uuid,
  p_faskes_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.posyandu (
    nama, kabupaten_id, puskesmas_id, status
  )
  values (
    trim(p_nama), p_kabupaten_id, p_faskes_id, 'usulan'::public.status_faskes
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Fungsi pengesahan usulan faskes oleh admin
create or replace function public.sahkan_faskes_usulan(
  p_usulan_id uuid,
  p_master_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang berwenang mengesahkan usulan fasilitas.';
  end if;

  if p_master_id is not null then
    -- Tautkan seluruh profil pengguna yang mengusulkan faskes ini ke faskes master
    update public.profiles
    set faskes_id = p_master_id
    where faskes_id = p_usulan_id;

    -- Hapus baris usulan
    delete from public.faskes where id = p_usulan_id and status = 'usulan';
  else
    -- Sahkan baris usulan menjadi master baru
    update public.faskes
    set status = 'master', perlu_verifikasi = false, updated_at = now()
    where id = p_usulan_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- BAGIAN 4: CAKUPAN DATA SESUAI KEPUTUSAN D-9
-- ---------------------------------------------------------------------

create or replace function public.my_faskes_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select p.faskes_id from public.profiles p where p.id = auth.uid(); $$;

create or replace function public.boleh_lihat(
  p_posyandu_id uuid,
  p_faskes_id uuid,
  p_kabupaten_id uuid,
  p_created_by uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_faskes_id uuid;
  v_posyandu_id uuid;
  v_kabupaten_id uuid;
  v_jenis public.jenis_faskes;
begin
  if not public.is_aktif() then
    return false;
  end if;

  select p.role, p.faskes_id, p.posyandu_id, p.kabupaten_id, p.jenis_faskes
  into v_role, v_faskes_id, v_posyandu_id, v_kabupaten_id, v_jenis
  from public.profiles p
  where p.id = auth.uid();

  if v_role = 'admin' then
    return true;
  end if;

  if v_role = 'kader' then
    return p_posyandu_id is not null and p_posyandu_id = v_posyandu_id;
  end if;

  if v_role in ('dokter', 'dietisien') then
    -- Spesialis di Rumah Sakit: HANYA melihat balita yang diinput sendiri (D-9)
    if v_jenis = 'rumah_sakit' then
      return p_created_by is not null and p_created_by = auth.uid();
    end if;

    -- Dokter / Dietisien di Puskesmas: melihat balita di faskes puskesmasnya
    return p_faskes_id is not null and p_faskes_id = v_faskes_id;
  end if;

  return false;
end;
$$;

-- ---------------------------------------------------------------------
-- BAGIAN 5: SEED 95 PUSKESMAS GORONTALO (STATUS = MASTER)
-- ---------------------------------------------------------------------

-- Seed Puskesmas Kota Gorontalo (12)
insert into public.faskes (nama, jenis, status, kabupaten_id, sumber_data, perlu_verifikasi)
select nama, 'puskesmas'::public.jenis_faskes, 'master'::public.status_faskes,
  (select id from public.kabupaten where kode = '7571'), 'seed_kompilasi_2016', true
from (values
  ('Puskesmas Pilolodaa'), ('Puskesmas Buladu'), ('Puskesmas Dungingi'),
  ('Puskesmas Limba B'), ('Puskesmas Tamalate'), ('Puskesmas Hulonthalangi'),
  ('Puskesmas Dumbo Raya'), ('Puskesmas Dulalowo'), ('Puskesmas Wongkaditi'),
  ('Puskesmas Sipatana'), ('Puskesmas Kota Tengah'), ('Puskesmas Kota Utara')
) as p(nama)
on conflict do nothing;

-- Seed Puskesmas Kab. Gorontalo (21)
insert into public.faskes (nama, jenis, status, kabupaten_id, sumber_data, perlu_verifikasi)
select nama, 'puskesmas'::public.jenis_faskes, 'master'::public.status_faskes,
  (select id from public.kabupaten where kode = '7502'), 'seed_kompilasi_2016', true
from (values
  ('Puskesmas Batudaa Pantai'), ('Puskesmas Biluhu'), ('Puskesmas Batudaa'),
  ('Puskesmas Dungaliyo'), ('Puskesmas Molopatodu'), ('Puskesmas Tabongo'),
  ('Puskesmas Tibawa'), ('Puskesmas Buhu'), ('Puskesmas Pulubala'),
  ('Puskesmas Boliyohuto'), ('Puskesmas Bilato'), ('Puskesmas Mootilango'),
  ('Puskesmas Tolangohula'), ('Puskesmas Asparaga'), ('Puskesmas Limboto'),
  ('Puskesmas Limboto Barat'), ('Puskesmas Telaga'), ('Puskesmas Pilohayanga'),
  ('Puskesmas Telaga Biru'), ('Puskesmas Tilango'), ('Puskesmas Telaga Jaya')
) as p(nama)
on conflict do nothing;

-- Seed Puskesmas Kab. Boalemo (11)
insert into public.faskes (nama, jenis, status, kabupaten_id, sumber_data, perlu_verifikasi)
select nama, 'puskesmas'::public.jenis_faskes, 'master'::public.status_faskes,
  (select id from public.kabupaten where kode = '7501'), 'seed_kompilasi_2016', true
from (values
  ('Puskesmas Mananggu'), ('Puskesmas Tilamuta'), ('Puskesmas Dulupi'),
  ('Puskesmas Pangi'), ('Puskesmas Botumoito'), ('Puskesmas Paguyaman'),
  ('Puskesmas Bongo II'), ('Puskesmas Bongo Nol'), ('Puskesmas Berlian'),
  ('Puskesmas Sari Tani'), ('Puskesmas Paguyaman Pantai')
) as p(nama)
on conflict do nothing;

-- Seed Puskesmas Kab. Pohuwato (16)
insert into public.faskes (nama, jenis, status, kabupaten_id, sumber_data, perlu_verifikasi)
select nama, 'puskesmas'::public.jenis_faskes, 'master'::public.status_faskes,
  (select id from public.kabupaten where kode = '7503'), 'seed_kompilasi_2016', true
from (values
  ('Puskesmas Popayato'), ('Puskesmas Popayato Barat'), ('Puskesmas Popayato Timur'),
  ('Puskesmas Lemito'), ('Puskesmas Wonggarasi I'), ('Puskesmas Wonggarasi II'),
  ('Puskesmas Wanggarasi'), ('Puskesmas Marisa'), ('Puskesmas Patilanggio'),
  ('Puskesmas Buntulia'), ('Puskesmas Duhiadaa'), ('Puskesmas Motolohu'),
  ('Puskesmas Pancakarsa I'), ('Puskesmas Pancakarsa II'), ('Puskesmas Paguat'),
  ('Puskesmas Dengilo')
) as p(nama)
on conflict do nothing;

-- Seed Puskesmas Kab. Bone Bolango (20)
insert into public.faskes (nama, jenis, status, kabupaten_id, sumber_data, perlu_verifikasi)
select nama, 'puskesmas'::public.jenis_faskes, 'master'::public.status_faskes,
  (select id from public.kabupaten where kode = '7504'), 'seed_kompilasi_2016', true
from (values
  ('Puskesmas Tapa'), ('Puskesmas Bulango Selatan'), ('Puskesmas Bulango Timur'),
  ('Puskesmas Bulango Utara'), ('Puskesmas Bulango Ulu'), ('Puskesmas Kabila'),
  ('Puskesmas Botupingge'), ('Puskesmas Tilongkabila'), ('Puskesmas Toto Utara'),
  ('Puskesmas Suwawa'), ('Puskesmas Ulantha'), ('Puskesmas Suwawa Selatan'),
  ('Puskesmas Suwawa Tengah'), ('Puskesmas Dumbayabulan'), ('Puskesmas Pinogu'),
  ('Puskesmas Bone Pantai'), ('Puskesmas Kabila Bone'), ('Puskesmas Tombulilato'),
  ('Puskesmas Bone'), ('Puskesmas Bulawa')
) as p(nama)
on conflict do nothing;

-- Seed Puskesmas Kab. Gorontalo Utara (15)
insert into public.faskes (nama, jenis, status, kabupaten_id, sumber_data, perlu_verifikasi)
select nama, 'puskesmas'::public.jenis_faskes, 'master'::public.status_faskes,
  (select id from public.kabupaten where kode = '7505'), 'seed_kompilasi_2016', true
from (values
  ('Puskesmas Atinggola'), ('Puskesmas Gentuma'), ('Puskesmas Kwandang'),
  ('Puskesmas Molingkapoto'), ('Puskesmas Ponelo'), ('Puskesmas Dambalo'),
  ('Puskesmas Anggrek'), ('Puskesmas Monano'), ('Puskesmas Ilangata'),
  ('Puskesmas Sumalata'), ('Puskesmas Dulukapa'), ('Puskesmas Buloila'),
  ('Puskesmas Tolinggula'), ('Puskesmas Biawu'), ('Puskesmas Limbato')
) as p(nama)
on conflict do nothing;
