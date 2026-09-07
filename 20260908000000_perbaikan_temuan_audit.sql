-- =====================================================================
-- Perbaikan temuan audit September 2026
--
-- Migrasi ini menegakkan di tingkat basis data apa yang sebelumnya hanya
-- diandaikan di tingkat aplikasi. Seluruh perubahan bersifat aditif atau
-- memperketat; tidak ada kolom yang dihapus, sehingga baris lama tetap sah
-- dan penerapan dapat dibatalkan tanpa kehilangan data.
--
-- Rujukan temuan: docs/AUDIT_PKMK.md dan docs/AUDIT_ZSCORE.md
--   T-0b  rujukan produk pada asuhan_gizi tidak pernah terisi
--   T-3   densitas dan takaran air berdiri bebas dari angka label
--   T-5   min_usia_bulan berbawaan 0, yaitu nilai paling permisif
--   T-6   kolom label boleh kosong sehingga angka turunan jadi tebakan
--   T-14  dua kolom menyimpan besaran densitas yang sama
--   Z-4   jejak koreksi prematuritas tidak tersimpan pada skrining
-- =====================================================================

-- ---------------------------------------------------------------------
-- T-6: angka label produk PKMK wajib ada dan wajib masuk akal
--
-- Sebelumnya `sendok_per_saji` dan `kkal_per_saji` ditambahkan sebagai kolom
-- nullable tanpa bawaan. Pada baris dengan sendok_per_saji kosong, pemetaan di
-- aplikasi menebak 1 sendok, sehingga produk 300 kkal per saji terbaca
-- 300 kkal PER SENDOK: sepuluh kali lipat, tanpa peringatan.
-- ---------------------------------------------------------------------

-- Melengkapi baris lama yang mungkin kosong sebelum memasang kendala.
update public.produk_pkmk
   set ml_per_saji = 180
 where ml_per_saji is null;

alter table public.produk_pkmk
  drop constraint if exists chk_pkmk_sendok_per_saji;
alter table public.produk_pkmk
  add constraint chk_pkmk_sendok_per_saji
  check (sendok_per_saji is null or sendok_per_saji between 1 and 30);

alter table public.produk_pkmk
  drop constraint if exists chk_pkmk_kkal_per_saji;
alter table public.produk_pkmk
  add constraint chk_pkmk_kkal_per_saji
  check (kkal_per_saji is null or (kkal_per_saji > 0 and kkal_per_saji <= 2000));

alter table public.produk_pkmk
  drop constraint if exists chk_pkmk_ml_per_saji;
alter table public.produk_pkmk
  add constraint chk_pkmk_ml_per_saji
  check (ml_per_saji is null or (ml_per_saji > 0 and ml_per_saji <= 1000));

alter table public.produk_pkmk
  drop constraint if exists chk_pkmk_ml_air_per_sendok;
alter table public.produk_pkmk
  add constraint chk_pkmk_ml_air_per_sendok
  check (ml_air_per_sendok is null or (ml_air_per_sendok > 0 and ml_air_per_sendok <= 200));

-- Produk yang AKTIF wajib memiliki ketiga angka label, karena tanpa itu tidak
-- ada satu pun angka takaran yang dapat dihitung untuk peresepan.
alter table public.produk_pkmk
  drop constraint if exists chk_pkmk_aktif_wajib_lengkap;
alter table public.produk_pkmk
  add constraint chk_pkmk_aktif_wajib_lengkap
  check (
    is_active = false
    or (sendok_per_saji is not null and kkal_per_saji is not null and ml_per_saji is not null)
  );

-- ---------------------------------------------------------------------
-- T-3 & T-14: densitas menjadi KOLOM TURUNAN, bukan isian bebas
--
-- Pada data seed, densitas tersimpan 1,00 kkal/ml untuk 4 dari 5 produk,
-- padahal kkal_per_saji / ml_per_saji berkisar 0,89 sampai 2,00. Nutrinidrink
-- tersimpan 1,50 padahal labelnya 300/150 = 2,00.
--
-- `densitas_kkal_per_ml` dan `kkal_per_ml` menyimpan besaran yang sama, jadi
-- keduanya digantikan satu kolom turunan. Kolom lama DIBIARKAN ADA agar kode
-- lama tidak pecah, tetapi tidak lagi menjadi sumber kebenaran; aplikasi sudah
-- berhenti membacanya.
-- ---------------------------------------------------------------------
alter table public.produk_pkmk
  add column if not exists densitas_turunan_kkal_per_ml numeric(5,3)
  generated always as (
    case
      when ml_per_saji is null or ml_per_saji = 0 or kkal_per_saji is null then null
      else kkal_per_saji::numeric / ml_per_saji
    end
  ) stored;

comment on column public.produk_pkmk.densitas_turunan_kkal_per_ml is
  'Densitas energi, DIHITUNG dari kkal_per_saji / ml_per_saji. Inilah sumber '
  'kebenaran densitas. Kolom densitas_kkal_per_ml dan kkal_per_ml dipertahankan '
  'hanya untuk kompatibilitas dan tidak boleh dipakai menghitung.';

alter table public.produk_pkmk
  add column if not exists ml_larutan_per_sendok numeric(6,2)
  generated always as (
    case
      when sendok_per_saji is null or sendok_per_saji = 0 or ml_per_saji is null then null
      else ml_per_saji::numeric / sendok_per_saji
    end
  ) stored;

comment on column public.produk_pkmk.ml_larutan_per_sendok is
  'Volume LARUTAN JADI per sendok takar, DIHITUNG dari ml_per_saji / '
  'sendok_per_saji. Berbeda dari ml_air_per_sendok: bubuk menempati ruang, '
  'sehingga air 30 ml per sendok tidak menghasilkan larutan 30 ml per sendok. '
  'Seluruh perhitungan volume memakai kolom ini.';

comment on column public.produk_pkmk.ml_air_per_sendok is
  'Air yang ditambahkan per sendok takar menurut label. PETUNJUK PENYIAPAN '
  'untuk ibu, bukan volume larutan jadi, dan tidak dipakai menghitung volume.';

comment on column public.produk_pkmk.densitas_kkal_per_ml is
  'USANG. Dipertahankan untuk kompatibilitas. Pakai densitas_turunan_kkal_per_ml.';
comment on column public.produk_pkmk.kkal_per_ml is
  'USANG. Duplikat densitas_kkal_per_ml. Pakai densitas_turunan_kkal_per_ml.';

-- ---------------------------------------------------------------------
-- T-5: min_usia_bulan tidak lagi berbawaan 0
--
-- Bawaan 0 adalah nilai paling permisif yang mungkin: produk apa pun menjadi
-- boleh untuk neonatus. Pada produksi, SGM Gain 100 tercatat 0 bulan padahal
-- seed migrasi menuliskan 12.
--
-- CATATAN: migrasi ini TIDAK mengubah nilai baris yang sudah ada, karena usia
-- minimal yang benar adalah keputusan klinis yang harus dicocokkan dengan label
-- kemasan bersama dietisien. Yang diubah hanya bawaan kolom dan kendalanya.
-- Baris yang perlu diperiksa dapat dilihat dengan:
--
--   select id, nama, merek, min_usia_bulan from public.produk_pkmk
--    where min_usia_bulan < 6 order by nama;
-- ---------------------------------------------------------------------
alter table public.produk_pkmk
  alter column min_usia_bulan set default 12;

alter table public.produk_pkmk
  drop constraint if exists chk_pkmk_min_usia;
alter table public.produk_pkmk
  add constraint chk_pkmk_min_usia
  check (min_usia_bulan between 0 and 60);

alter table public.produk_pkmk
  drop constraint if exists chk_pkmk_rentang_usia;
alter table public.produk_pkmk
  add constraint chk_pkmk_rentang_usia
  check (maks_usia_bulan is null or maks_usia_bulan >= min_usia_bulan);

comment on column public.produk_pkmk.min_usia_bulan is
  'Usia minimal pemakaian dalam bulan, menurut label kemasan. Bawaan 12. '
  'WAJIB diverifikasi dietisien terhadap kemasan yang beredar; nilai 0 berarti '
  'produk boleh diberikan sejak lahir dan hampir selalu keliru untuk formula '
  'penambah berat badan.';

-- Nama produk tidak boleh berulang per merek, agar admin tidak mengelola dua
-- baris yang menggambarkan produk yang sama dengan angka berbeda.
create unique index if not exists uq_produk_pkmk_nama_merek
  on public.produk_pkmk (lower(nama), lower(coalesce(merek, '')));

-- ---------------------------------------------------------------------
-- T-0b: rujukan produk pada asuhan_gizi
--
-- Jalur peresepan menulis kode teks ke `produk_pkmk_kode` dan meninggalkan
-- `produk_pkmk_id` NULL pada setiap baris. Penjaga integritas penghapusan
-- produk memeriksa `produk_pkmk_id`, sehingga jumlahnya selalu 0 dan produk
-- yang sudah diresepkan kepada anak sungguhan dapat dihapus permanen.
--
-- Mengisi kembali kolom uuid untuk baris lama yang kodenya cocok dengan nama
-- produk pada master data. Baris yang tidak dapat dipetakan dibiarkan NULL dan
-- tetap terlindungi oleh pemeriksaan `produk_pkmk_kode` di aplikasi.
-- ---------------------------------------------------------------------
update public.asuhan_gizi ag
   set produk_pkmk_id = p.id
  from public.produk_pkmk p
 where ag.produk_pkmk_id is null
   and ag.produk_pkmk_kode is not null
   and ag.produk_pkmk_kode = p.id::text;

create index if not exists idx_asuhan_produk_pkmk_id
  on public.asuhan_gizi (produk_pkmk_id)
  where produk_pkmk_id is not null;

create index if not exists idx_asuhan_produk_pkmk_kode
  on public.asuhan_gizi (produk_pkmk_kode)
  where produk_pkmk_kode is not null;

comment on column public.asuhan_gizi.produk_pkmk_kode is
  'Snapshot kode produk saat diresepkan, disimpan agar rekam medis tetap dapat '
  'dibaca meski produk kelak dihapus. BUKAN pengganti produk_pkmk_id: penjaga '
  'integritas penghapusan memeriksa KEDUA kolom.';

-- ---------------------------------------------------------------------
-- Z-4: jejak koreksi prematuritas pada baris skrining
--
-- Sebelumnya koreksi prematuritas dikerjakan dengan menyuntikkan tanggal lahir
-- palsu dari halaman skrining tamu, sehingga baris tersimpan tidak dapat
-- dibedakan dari umur kronologis dan hasilnya tidak dapat diaudit kembali.
-- ---------------------------------------------------------------------
alter table public.skrining
  add column if not exists usia_gestasi_minggu      smallint
    check (usia_gestasi_minggu is null or usia_gestasi_minggu between 22 and 42),
  add column if not exists umur_dikoreksi_prematur  boolean not null default false,
  add column if not exists umur_kronologis_hari     integer
    check (umur_kronologis_hari is null or umur_kronologis_hari >= 0),
  add column if not exists defisit_prematur_hari    smallint not null default 0
    check (defisit_prematur_hari >= 0 and defisit_prematur_hari <= 126);

comment on column public.skrining.umur_dikoreksi_prematur is
  'true bila nilai Z pada baris ini dihitung memakai umur KOREKSI, bukan umur '
  'kronologis. Tanpa penanda ini, baris terkoreksi dan tidak terkoreksi tampak '
  'identik dan selisih Z sampai 1,7 SD tidak dapat dilacak kembali.';
comment on column public.skrining.umur_kronologis_hari is
  'Umur kronologis dalam hari, disimpan berdampingan dengan umur yang dipakai '
  'menilai, agar keduanya dapat dibandingkan saat audit.';

-- =====================================================================
-- MASIH MENUNGGU KEPUTUSAN KLINIS, TIDAK DIUBAH MIGRASI INI
--
--   1. Nilai min_usia_bulan yang benar untuk kelima produk seed, terhadap
--      label kemasan yang beredar (temuan T-5).
--   2. Tabel RDA 110 / 100 / 90 kkal/kg dan rentang protein di
--      src/lib/zscore/gizi.ts, yang menggerakkan seluruh dosis PKMK
--      (temuan Z-5).
--   3. Tabel Kenaikan Berat Minimal di src/lib/zscore/velocity.ts terhadap
--      tabel KBM resmi Kemenkes (temuan Z-12).
--   4. Batas umur koreksi prematuritas, kini 24 bulan di
--      BATAS_UMUR_KOREKSI_PREMATUR_BULAN (temuan Z-4).
--   5. Apakah anak stunting tanpa wasting layak target tumbuh kejar
--      (temuan Z-7).
-- =====================================================================
