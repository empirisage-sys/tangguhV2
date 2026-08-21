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
