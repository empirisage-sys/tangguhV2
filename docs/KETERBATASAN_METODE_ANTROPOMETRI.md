# Keterbatasan Metode Antropometri TANGGUH

Dokumen ini mencatat keterbatasan metode yang **diketahui dan disengaja**, beserta besarnya.
Ia ada supaya keterbatasan itu tidak ditemukan kembali sebagai kejutan — terutama saat hasil
TANGGUH dibandingkan dengan WHO Anthro dalam publikasi ilmiah.

Ditulis menyusul audit September 2026. Temuan yang dapat diperbaiki dengan kode sudah
diperbaiki; yang ada di sini adalah yang tidak, dan alasannya.

---

## 1. Interpolasi tabel bulanan, bukan tabel harian (temuan Z-6)

**Keadaan sekarang.** Mesin memakai 61 baris tabel bulanan WHO (bulan 0–60) dan
menginterpolasi linear pada bulan desimal. Umur dalam bulan dihitung sebagai
hari ÷ 30,4375, yaitu konvensi WHO (365,25 ÷ 12) dan nilainya benar.

**Yang dilakukan WHO.** Implementasi rujukan WHO (igrowup / WHO Anthro) memakai tabel
**harian** 0–1856 hari, justru untuk menghindari galat interpolasi ini, karena kurva LMS
paling melengkung pada bulan-bulan awal.

**Besar galatnya.** Diukur dengan menginterpolasi L, M, S dari bulan n−1 dan n+1 lalu
membandingkannya dengan baris tabel bulan n; galat di tengah bulan kira-kira seperempat
nilai itu:

| Tabel | Pergeseran Z terburuk di titik uji | Perkiraan di tengah bulan |
|---|---|---|
| TB/U perempuan (bulan 1) | +0,297 SD | **~0,074 SD** |
| TB/U laki-laki (bulan 1) | +0,292 SD | ~0,073 SD |
| BB/U laki-laki (bulan 2) | +0,209 SD | ~0,052 SD |
| BB/U perempuan (bulan 2) | +0,167 SD | ~0,042 SD |

Jadi pada bayi 0–3 bulan nilai Z dapat bergeser sekitar **0,05–0,07 SD** dibanding
perhitungan WHO, dan galatnya mengecil tajam setelah bulan ke-6. Cukup kecil untuk
kebanyakan keperluan, tetapi cukup untuk membalik anak yang berada di −1,95 SD menjadi
−2,02 SD.

**Mengapa belum diganti.** Menukar ke tabel harian berarti mengganti delapan berkas tabel
di `src/lib/who/` yang dilarang diedit tanpa jalur generator dan uji regresi penuh
(AGENTS.md 2.1), lalu mengindeks dengan `umur.hari` alih-alih `umur.bulan`. Itu pekerjaan
tersendiri, bukan bagian dari perbaikan cacat.

**Bila hendak diperbaiki.** Unduh tabel harian dari cdn.who.int, perbarui
`scripts/hasilkan-tabel-who.ts`, ubah `LANGKAH_UMUR_BULAN` menjadi langkah harian, dan
jalankan ulang suite regresi. Perbedaan yang muncul harus terkategori seluruhnya, seperti
1.432 perbedaan yang sudah terdokumentasi terhadap mesin Firebase.

---

## 2. Ambang peralihan rumus logaritmik (temuan Z-15)

`hitungZ` beralih ke `ln(y/M)/S` ketika `|L| < 0,01`, bukan ketika `L` tepat 0. Ambang ini
dipertahankan agar hasilnya setara dengan aplikasi versi Firebase.

Sudah diukur: berlaku pada **5 baris** saja (BB/U laki-laki bulan 20–23, BB/U perempuan
bulan 4), dan galat maksimalnya **0,005 SD** pada L tepat di bawah ambang. Dapat diabaikan.
Tidak ada rencana mengubahnya.

---

## 3. Indikator IMT/U belum tersedia (temuan Z-17)

Permenkes Nomor 2 Tahun 2020 mencantumkan **empat** indeks antropometri:

1. BB/U — tersedia
2. PB/U atau TB/U — tersedia
3. BB/PB atau BB/TB — tersedia
4. **IMT/U — belum tersedia**

Untuk 0–60 bulan, BB/PB dan IMT/U hampir selalu menghasilkan kategori yang sama, sehingga
dampak praktisnya kecil. Namun laporan atau publikasi yang menyatakan aplikasi ini mengikuti
Permenkes 2/2020 sebaiknya menyebutkan indeks yang tidak disediakan, agar tidak menyiratkan
kepatuhan yang lebih luas daripada kenyataannya.

Menambahkannya memerlukan dua tabel LMS WHO baru (bfa boys/girls 0–5 tahun) melalui jalur
generator yang sama.

---

## 4. Penandaan nilai Z: ditandai, tidak dibuang (temuan Z-3)

WHO Anthro menandai nilai Z di luar batas berikut sebagai tidak masuk akal secara biologis,
lalu **mengeluarkannya dari analisis**:

| Indikator | Batas WHO |
|---|---|
| TB/U | −6 sampai +6 |
| BB/U | −6 sampai +5 |
| BB/TB | −5 sampai +5 |

TANGGUH memakai batas yang sama, tetapi **tidak membuang** nilainya. Alasannya: batas itu
dirancang untuk membersihkan data survei populasi, sedangkan aplikasi ini melakukan skrining
perorangan. Anak umur 24 bulan dengan tinggi 87 cm dan berat 8 kg — kasus gizi buruk yang
sebenarnya, bukan salah catat — menghasilkan Z BB/TB sekitar **−5,8**, yaitu di luar batas
WHO. Bila nilai itu dibuang, penanda rujukan `bbtb_gizi_buruk` ikut hilang dan anak yang
paling perlu dirujuk justru tidak tertandai.

Karena itu perilakunya: nilai Z dan status gizi tetap dikembalikan, `diLuarRentang` menjadi
`true`, dan catatannya menyuruh pengukuran diulang. Pemeriksa melihat angkanya sekaligus tahu
angka itu perlu dikonfirmasi.

Konsekuensi yang perlu disadari: pada analisis agregat, baris dengan
`alasan_di_luar_rentang` yang memuat `*_tidak_wajar_*` sebaiknya dikeluarkan lebih dulu agar
sejalan dengan praktik WHO.

---

## 5. Angka yang masih menunggu verifikasi klinis

Bukan keterbatasan metode, melainkan pekerjaan yang belum selesai. Ketiganya sudah bertanda
peringatan di dalam kode dan **tidak diubah** oleh perbaikan audit, karena angkanya adalah
keputusan klinis.

| Apa | Di mana | Temuan |
|---|---|---|
| Tabel RDA 110 / 100 / 90 kkal/kg dan rentang protein 1,2–1,5 serta 1,5–2,0 g/kg | `src/lib/zscore/gizi.ts` | Z-5 |
| Tabel Kenaikan Berat Minimal harian (jalur cadangan velocity) | `src/lib/zscore/velocity.ts` | Z-12 |
| Batas umur koreksi prematuritas, kini 24 bulan | `BATAS_UMUR_KOREKSI_PREMATUR_BULAN` di `src/lib/zscore/umur.ts` | Z-4 |
| Apakah anak stunting tanpa wasting layak target tumbuh kejar | `hitungKebutuhanGizi`, `statusTBU` sudah diteruskan tetapi belum mengubah perilaku | Z-7 |
| Nilai `min_usia_bulan` yang benar untuk kelima produk PKMK seed | tabel `produk_pkmk` | T-5 |
| Apakah `perluIntervensiGizi` perlu memasukkan gizi lebih dan obesitas | `src/lib/zscore/klasifikasi.ts` | Z-20 |

Rantai yang paling perlu diperhatikan: `rdaKkalPerKg` → `kaloriCatchUpKkal` →
`skrining.kalori_catchup_kkal` → `targetKkal` → `hitungTakaran` → **jumlah sendok takar PKMK
yang benar-benar diminum anak**. Seluruh peresepan PKMK bertumpu pada tiga angka RDA yang
komentar kodenya sendiri tandai belum diverifikasi.
