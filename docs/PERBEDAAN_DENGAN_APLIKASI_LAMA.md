# Perbedaan Hasil Engine Baru terhadap Aplikasi TANGGUH Versi Firebase

Versi engine: `zscore-2.0.0`
Tanggal: 19 Agustus 2026
Dasar: uji regresi otomatis pada 4.032 kasus dan verifikasi 842 baris tabel WHO, seluruh 135 uji lolos

Dokumen ini dibuat untuk dibawa ke verifikasi klinis. Setiap perbedaan hasil
dicantumkan beserta alasan, arah perubahan, dan besarnya dampak.

---

## Ringkasan Uji Regresi

Engine lama diporting apa adanya ke `referensi/engine-lama.ts`, lalu kedua engine
dijalankan pada kisi 4.032 kasus yang menjangkau: dua jenis kelamin, umur 0 sampai
1.900 hari, berat 3 sampai 20 kg, panjang 50 sampai 130 cm, dan dua posisi pengukuran.

| Hasil | Jumlah |
|---|---|
| Kasus dibandingkan | 4.032 |
| Perbedaan yang tidak dapat dijelaskan | **0** |
| Perbedaan karena penolakan nilai di luar rentang (disengaja) | 1.280 |
| Perbedaan karena ambang TB/U Kemenkes (disengaja) | 152 |
| Nilai Z berbeda pada kasus yang dinilai kedua engine | **0** |

Baris terakhir adalah temuan terpenting: **pada setiap kasus yang dinilai oleh kedua
engine, nilai Z-Score-nya identik sampai tiga desimal.** Pemindahan tabel L/M/S,
rumus LMS, koreksi WHO untuk nilai ekstrem, koreksi posisi pengukuran, dan pemilihan
tabel BB/PB atau BB/TB dilakukan tanpa mengubah apa pun.

### A. Nilai Z pada kasus dalam rentang

| kasus | BB/U baru | BB/U lama | TB/U baru | TB/U lama | BB/TB baru | BB/TB lama |
|---|---|---|---|---|---|---|
| Lk 24,0 bln / 78 cm / 8 kg | -3.613 | -3.613 | -2.995 | -2.995 | -3.060 | -3.060 |
| Pr 18,0 bln / 78 cm / 9,5 kg | -0.598 | -0.598 | -0.912 | -0.912 | -0.235 | -0.235 |
| Lk 6,0 bln / 66 cm / 7 kg | -1.108 | -1.108 | -0.716 | -0.716 | -0.856 | -0.856 |
| Pr 59,4 bln / 105 cm / 15 kg | -1.330 | -1.330 | -0.885 | -0.885 | -1.240 | -1.240 |
| Lk 24,0 bln / 95 cm / 20 kg | 4.533 | 4.533 | 2.564 | 2.564 | 4.261 | 4.261 |

Baris terakhir sekaligus membuktikan koreksi WHO untuk nilai di luar 3 SD berjalan
sama pada kedua engine.

---

## Perbedaan 1 — Nilai di luar rentang ditolak, tidak dijepit ke tepi tabel

**Keputusan D-3. Arah perubahan: lebih berhati-hati.**

Aplikasi lama, ketika nilai berada di luar rentang tabel, memakai baris tepi tabel
dan tetap mengeluarkan angka. Untuk anak berumur 62 bulan, ia memakai parameter
bulan ke-60. Karena anak yang lebih tua secara alami lebih tinggi, hasilnya membuat
status stunting **terlihat lebih ringan dari kenyataan**.

Engine baru menolak dan menyatakan alasannya:

| Keadaan | Aplikasi lama | Engine baru |
|---|---|---|
| Umur di atas 60 bulan | memakai baris bulan ke-60 | seluruh indikator tidak dinilai, disertai keterangan |
| Panjang di bawah 45 cm atau di atas 110 cm pada standar terlentang | memakai baris tepi | BB/PB tidak dinilai |
| Tinggi di bawah 65 cm atau di atas 120 cm pada standar berdiri | memakai baris tepi | BB/TB tidak dinilai |
| Berat di luar 0,5 sampai 40 kg | tetap dihitung | ditolak, dengan permintaan memeriksa angka penimbangan |
| Tanggal periksa mendahului tanggal lahir | umur dipaksa menjadi 0 | ditolak |

Catatan tambahan yang diputuskan saat penulisan: bila umur di atas 60 bulan, BB/PB
dan BB/TB juga tidak dinilai meskipun tabelnya tidak berbasis umur. Alasannya
konsistensi laporan — menolak TB/U tetapi tetap menyajikan BB/TB menghasilkan
dokumen yang setengah sahih.

**Dampak pada data lama:** sebagian riwayat akan berubah dari "punya Z-Score"
menjadi "tidak dapat dinilai". Saat migrasi, baris seperti itu harus ditandai dan
dilaporkan, bukan dihitung ulang secara diam-diam.

Penjepitan nilai tetap tersedia lewat fungsi terpisah `lmsUntukKurva`, khusus untuk
menggambar garis kurva pertumbuhan agar tidak terputus. Fungsi itu tidak pernah
dipakai untuk menetapkan status.

---

## Perbedaan 2 — Ambang TB/U mengikuti standar Kemenkes

**Keputusan D-4. Arah perubahan: menyesuaikan dengan format pelaporan nasional.**

| Nilai Z TB/U | Aplikasi lama | Engine baru |
|---|---|---|
| Z < -3 | Sangat Pendek | sangat_pendek |
| -3 ≤ Z < -2 | Pendek | pendek |
| -2 ≤ Z ≤ +2 | Normal | normal |
| +2 < Z ≤ +3 | **Tinggi** | **normal** |
| Z > +3 | Sangat Tinggi | tinggi |

Dua perubahan: rentang +2 sampai +3 kini berkategori normal, dan kategori
"Sangat Tinggi" dihapus karena tidak dikenal standar Kemenkes.

Pada uji regresi, perubahan ini menyentuh 152 dari 4.032 kasus, seluruhnya berada
tepat pada rentang Z antara +2 dan +3. Tidak ada intervensi klinis yang berubah
akibat perubahan label ini.

Kategori BB/U dan BB/TB **tidak diubah** karena sudah sesuai standar.

---

## Perbedaan 3 — Delta dikurangkan pada penilaian kenaikan berat badan

**Temuan K-3. Arah perubahan: memperbaiki kesalahan yang menyebabkan over-diagnosis.**

Ini perbedaan dengan dampak lapangan terbesar.

WHO memodelkan tabel velocity berat badan pada data yang sudah digeser, yaitu
kenaikan sebenarnya ditambah sebuah konstanta delta. Nilai yang keluar dari rumus
LMS karena itu wajib dikurangi delta. Aplikasi lama tidak melakukannya.

### C. Ambang persentil 5 kenaikan berat badan (gram)

| jenis kelamin | interval | umur awal | ambang baru (sesuai WHO) | ambang lama | selisih |
|---|---|---|---|---|---|
| laki-laki | 1 bulan | 0 bln | 460 | 860 | +400 |
| laki-laki | 1 bulan | 6 bln | 42 | 442 | +400 |
| laki-laki | 1 bulan | 11 bln | **-106** | 294 | +400 |
| perempuan | 1 bulan | 0 bln | 446 | 846 | +400 |
| perempuan | 1 bulan | 6 bln | 37 | 437 | +400 |
| perempuan | 1 bulan | 11 bln | **-102** | 298 | +400 |
| laki-laki | 2 bulan | 6 bln | 238 | 838 | +600 |
| perempuan | 2 bulan | 12 bln | **-19** | 581 | +600 |
| laki-laki | 3 bulan | 12 bln | 88 | 738 | +650 |
| perempuan | 3 bulan | 21 bln | 8 | 808 | +800 |

Angka pada kolom "ambang baru" sudah dibuktikan sama dengan kolom persentil 5 pada
tabel terbitan WHO, dengan selisih di bawah 1,5 gram pada seluruh 114 baris tabel.
Pembuktian itu ada di `src/lib/zscore/__tests__/velocity.test.ts` dan nilai
pembandingnya di `fixtur-who-p5.ts`, diambil langsung dari cdn.who.int.

Perhatikan baris yang ditebalkan: ambang WHO bernilai **negatif** pada umur mendekati
satu tahun. Artinya lima persen bayi sehat memang kehilangan sedikit berat pada
bulan itu, dan hal tersebut belum menjadi penanda gagal tumbuh. Aplikasi lama
menuntut kenaikan ratusan gram pada situasi yang sama.

Perhatikan juga bahwa delta interval 3 bulan berbeda antara laki-laki (650 g) dan
perempuan (800 g). Delta bukan satu angka untuk semua tabel.

### D. Kasus nyata

| kasus | ambang baru | status baru | ambang lama | status lama |
|---|---|---|---|---|
| Lk 11 bln, naik 100 g dalam 30 hari | -105 g | naik | 290 g | growth faltering |
| Pr 5 bln, naik 200 g dalam 30 hari | 170 g | naik | 564 g | growth faltering |
| Lk 1 bln, naik 700 g dalam 30 hari | 703 g | growth faltering | 1.097 g | growth faltering |
| Pr 17 bln, naik 100 g dalam 30 hari | 240 g | growth faltering | 600 g | growth faltering |

Dua kasus teratas adalah bayi yang tumbuh normal menurut WHO tetapi dinyatakan gagal
tumbuh oleh aplikasi lama.

**Dampak yang perlu diantisipasi:** setelah perbaikan ini, jumlah kasus growth
faltering yang terdeteksi aplikasi akan **turun tajam**. Penurunan itu bukan tanda
aplikasi menjadi kurang sensitif; ia menunjukkan bahwa angka sebelumnya memuat
banyak kasus yang sebenarnya normal. Siapkan penjelasan ini sebelum angka rekap
bulanan dibandingkan dengan bulan-bulan sebelumnya, karena penurunan mendadak akan
menimbulkan pertanyaan di tingkat puskesmas dan dinas.

---

## Perbedaan 4 — Batas jarak antar penimbangan

**Temuan S-3.**

Aplikasi lama menskalakan ambang secara linear terhadap jarak hari berapa pun.
Untuk jarak 200 hari, ia memilih tabel interval 3 bulan lalu mengalikan ambangnya
sekitar 2,2 kali. Laju pertumbuhan tidak linear terhadap umur, sehingga hasilnya
tidak sahih.

Engine baru menerima penilaian hanya pada jarak 21 sampai 110 hari. Di luar itu
statusnya `tidak_dapat_dinilai`, disertai saran tindakan: bila terlalu pendek,
tunggu; bila terlalu panjang, jadikan penimbangan sekarang sebagai titik awal baru.

---

## Perbedaan 5 — Jalur cadangan untuk umur di luar cakupan tabel velocity WHO

**Ditemukan saat penulisan engine, belum ada di dokumen telaah.**

Cakupan tabel velocity WHO ternyata tidak menjangkau seluruh kebutuhan posyandu:

| Tabel | Cakupan umur awal |
|---|---|
| interval 1 bulan | 0 sampai 11 bulan |
| interval 2 bulan | 0 sampai 22 bulan |
| interval 3 bulan | 0 sampai 21 bulan |

Artinya anak umur 2 sampai 5 tahun tidak dapat dinilai dengan standar velocity WHO,
dan anak di atas 12 bulan yang ditimbang dengan jarak satu bulan juga tidak.
Padahal justru penimbangan bulanan itu yang lazim di posyandu.

Engine baru beralih ke jalur cadangan berbasis Kenaikan Berat Minimal, memakai tabel
laju harian yang dipindahkan apa adanya dari aplikasi lama (30, 20, 15, 12, 8, dan
6 gram per hari menurut kelompok umur). Metodenya dinyatakan terbuka pada keluaran:
teks metode berisi "KBM perkiraan", sehingga pengguna dan dietisien tahu angka itu
bukan standar WHO.

**Butuh verifikasi:** tabel laju harian tersebut adalah pendekatan. Tabel Kenaikan
Berat Minimal resmi Kemenkes yang dipakai pada Kartu Menuju Sehat dinyatakan dalam
gram per bulan per umur, bukan gram per hari. Perlu dibandingkan dan diganti bila
berbeda. Sudah ditandai `TODO VERIFIKASI` di dalam kode.

---

## Perbedaan 6 — Kebutuhan gizi menghasilkan dua angka

**Keputusan D-1 dan D-2.**

### B. Kebutuhan gizi

| kasus | BB ideal | usia-tinggi baru | usia-tinggi lama | kalori lama | pemeliharaan baru | target catch-up |
|---|---|---|---|---|---|---|
| Lk 24 bln / 78 cm / 8 kg (gizi buruk) | 10,21 kg | 13,96 bln | 14 bln | 800 kkal | 800 kkal | **1.021 kkal** |
| Pr 12 bln / 70 cm / 6,5 kg (gizi kurang) | 8,16 kg | 8,90 bln | 9 bln | 650 kkal | 650 kkal | **898 kkal** |
| Lk 24 bln / 87,1 cm / 12,2 kg (gizi baik) | 12,19 kg | 23,91 bln | 24 bln | 1.220 kkal | 1.220 kkal | 1.219 kkal |

Perhatikan tiga hal:

1. **Angka pemeliharaan identik dengan aplikasi lama.** Tidak ada yang hilang; angka
   yang selama ini dipakai tetap tersedia dan tetap tercetak.
2. **Target tumbuh kejar hanya berbeda pada anak yang kurang gizi.** Pada anak gizi
   baik, kedua angka hampir sama (1.220 dan 1.219 kkal), karena berat aktualnya
   memang mendekati berat ideal. Ini menjadi pemeriksaan kewajaran yang bagus:
   bila kedua angka jauh berbeda pada anak gizi baik, ada yang salah.
3. **Selisih pada anak gizi buruk mencapai 28 persen**, dan pada contoh kedua
   38 persen.

Protein mengikuti pola yang sama: pemeliharaan 1,2 sampai 1,5 gram per kg berat
aktual, tumbuh kejar 1,5 sampai 2,0 gram per kg berat ideal.

Penanda `kalori_metode` disimpan pada setiap baris skrining, bernilai `catch_up`
bila status BB/TB adalah gizi kurang atau gizi buruk, dan `pemeliharaan` bila tidak.
Dengan begitu laporan lama dan baru tidak tercampur.

**Angka tumbuh kejar tidak boleh dipakai sebagai dasar terapi sebelum ditandatangani
nutrisionis atau dokter spesialis anak.** Sudah ditulis sebagai peringatan di kepala
berkas `src/lib/zscore/gizi.ts`.

---

## Perbedaan 7 — Usia-tinggi diinterpolasi

**Temuan pelengkap.**

Aplikasi lama memindai 61 baris tabel TB/U dan mengambil bulan dengan median
terdekat, sehingga hasilnya selalu bilangan bulat. Engine baru menginterpolasi,
sehingga menghasilkan pecahan bulan: 13,96 bulan alih-alih 14 bulan.

Dampaknya kecil pada tabel RDA yang kasar (110, 100, dan 90 kkal/kg), tetapi menjadi
penting bila tabel RDA diganti dengan tabel yang lebih rinci setelah diverifikasi
nutrisionis.

---

## Perbedaan 8 — Kategori dikembalikan sebagai kode, bukan teks berikut kelas CSS

**Temuan T-5.**

Aplikasi lama mengembalikan teks yang dibaca pengguna berikut nama kelas Tailwind
dari lapisan logika, lalu di tempat lain mencocokkan teks itu dengan `includes()`.
Pola ini sudah menimbulkan kekeliruan nyata di dua tempat:

| Berkas | Kode | Teks sebenarnya | Hasil |
|---|---|---|---|
| `KaderDashboard.tsx` baris 32 | mencari `'Gizi kurang'` | `'Gizi Kurang (Wasted)'` | tidak pernah cocok |
| `KaderDashboard.tsx` baris 32 | mencari `'Gizi buruk'` | `'Gizi Buruk (Severely Wasted)'` | tidak pernah cocok |
| `KaderDashboard.tsx` baris 43 | mencari `'Gizi baik'` | `'Gizi Baik (Normal)'` | tidak pernah cocok, hitungan anak normal selalu nol |
| `DietisienDashboard.tsx` baris 73-74 | sama seperti di atas | sama | anak yang hanya wasted terlewat dari daftar prioritas |
| `DietisienDashboard.tsx` baris 75 | mencari `'Sangat Pendek'` saja | | anak berstatus pendek saja tidak masuk daftar |

Perbandingan teks dalam JavaScript peka huruf besar-kecil, sehingga
`'Gizi Kurang (Wasted)'.includes('Gizi kurang')` bernilai salah.

Akibat praktisnya: daftar prioritas dietisien selama ini melewatkan anak yang wasted
tetapi BB/U-nya masih normal, dan melewatkan anak yang stunted tanpa disertai wasting.
Statistik "anak dengan status normal" di dasbor kader selalu menunjukkan nol.

Engine baru mengembalikan kode kategori seperti `gizi_kurang` dan `sangat_pendek`.
Pemetaan menjadi label bahasa Indonesia dan warna dikerjakan di lapisan tampilan.
Penyaringan memakai fungsi `perluIntervensiGizi`, yang diuji dan mencakup keenam
kondisi yang seharusnya masuk daftar prioritas.

---

## Perbedaan 9 — Satu baris tabel BB/PB perempuan dikoreksi

**Ditemukan pada verifikasi baris per baris terhadap tabel resmi WHO.**

Baris 95,5 cm pada tabel BB/PB perempuan aplikasi lama berisi nilai yang identik
dengan baris 95,5 cm tabel BB/TB perempuan. Satu baris dari tabel
berat-menurut-tinggi masuk ke tabel berat-menurut-panjang.

| Panjang | Median aplikasi lama | Median resmi WHO |
|---|---|---|
| 95,0 cm | 13,7146 kg | 13,7146 kg |
| 95,5 cm | **14,0186 kg** | **13,8408 kg** |
| 96,0 cm | 13,9676 kg | 13,9676 kg |

Berlaku untuk anak perempuan di bawah 24 bulan dengan panjang 95,0 sampai
96,0 cm. Ambang gizi kurang bergeser dari 11,636 kg menjadi 11,783 kg, sehingga
anak dengan berat di antara keduanya dinyatakan gizi kurang padahal gizi baik.
Arah kesalahannya over-diagnosis.

Kejadian nyatanya jarang, karena panjang 95 cm pada umur di bawah 24 bulan
berada di sekitar +3 SD. Tetapi kesalahannya nyata dan sudah dikoreksi.

Ini satu-satunya perubahan nilai tabel yang dilakukan. Dari 842 baris dan 2.526
nilai L/M/S yang dibandingkan dengan tabel terbitan WHO, hanya dua nilai pada
satu baris ini yang berbeda. Laporan lengkapnya di `docs/VERIFIKASI_TABEL_WHO.md`.

**Catatan penting tentang uji regresi:** perbedaan ini TIDAK muncul pada
ringkasan uji regresi di bagian atas dokumen, karena porting engine lama memakai
tabel yang sama dengan engine baru. Uji regresi membandingkan algoritma, bukan
data tabel. Kebenaran data diuji terpisah di `integritas-tabel.test.ts`.

---

## Catatan Perilaku: Batas 24 Bulan Bukan Hari Ulang Tahun Kedua

Bukan perbedaan antar engine — kedua engine berperilaku sama — tetapi perlu diketahui
karena mudah disalahpahami di lapangan.

Umur 24 bulan setara 730,5 hari menurut konvensi 30,4375 hari per bulan. Dua tahun
kalender hanya 730 hari. Akibatnya:

| Hari sejak lahir | Umur tercatat | Standar yang berlaku |
|---|---|---|
| 730 (hari ulang tahun kedua) | 23,98 bulan | panjang badan terlentang |
| 731 (sehari setelahnya) | 24,03 bulan | tinggi badan berdiri |

Perilaku ini sejalan dengan WHO Anthro dan tidak diubah. Konsekuensi yang perlu
disampaikan kepada kader: pada tinggi yang sama, berat ideal berubah saat standar
berpindah, karena median BB/PB dan median BB/TB tidak identik. Pada 78 cm, median
BB/PB adalah 10,08 kg dan median BB/TB adalah 10,21 kg. Selisih 130 gram ini normal
dan bukan tanda kesalahan pengukuran.

Sudah diuji secara eksplisit di `__tests__/skrining.test.ts` pada blok
"batas 24 bulan menurut konvensi hari per bulan".

---

## Yang Harus Dilakukan Sebelum Engine Ini Dipakai di Lapangan

1. **Verifikasi klinis rumus gizi.** Bawa Perbedaan 6 ke nutrisionis atau dokter
   spesialis anak. Minta paraf pada rumus tumbuh kejar dan pada tabel RDA
   110/100/90 kkal/kg. Arsipkan lembar verifikasinya.
2. **Verifikasi tabel KBM.** Bandingkan tabel laju harian di Perbedaan 5 dengan
   tabel Kenaikan Berat Minimal resmi Kemenkes.
3. **Uji silang sepuluh kasus nyata.** Cetak sepuluh kartu hasil dari data nyata dan
   bandingkan dengan perhitungan manual atau WHO Anthro. Simpan sebagai dokumen
   validasi.
4. **Siapkan penjelasan penurunan angka growth faltering.** Lihat peringatan pada
   Perbedaan 3. Sampaikan lebih dahulu kepada puskesmas dan dinas sebelum angka
   rekap bulanan berubah.
5. **Sepakati perlakuan data lama yang menjadi tidak dapat dinilai.** Lihat
   Perbedaan 1. Tandai, laporkan, jangan hapus.
6. **Hitung ulang riwayat anak perempuan bertubuh tinggi di bawah 24 bulan.**
   Lihat Perbedaan 9. Anak perempuan di bawah 24 bulan dengan panjang 95 sampai
   96 cm perlu dinilai ulang dengan tabel yang sudah dikoreksi.

---

## Cara Menjalankan Ulang Pembuktian Ini

```bash
npm install
npx tsc --noEmit     # pemeriksaan tipe, harus bersih
npx vitest run       # 135 uji, harus lolos seluruhnya
```

Keluaran uji regresi mencetak ringkasan perbedaan. Bila muncul kategori berawalan
`TIDAK_DIHARAPKAN`, ada perbedaan yang tidak dapat dijelaskan dan pengerjaan harus
dihentikan sampai penyebabnya ditemukan.
