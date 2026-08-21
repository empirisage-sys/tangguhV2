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
