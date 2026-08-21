# Laporan Verifikasi Tabel Referensi WHO

Tanggal verifikasi: 19 Agustus 2026
Cakupan: seluruh tabel L/M/S yang dipakai Aplikasi TANGGUH
Metode: pengunduhan tabel resmi dari cdn.who.int, lalu perbandingan baris per baris

---

## 1. Hasil Ringkas

| Tabel | Baris aplikasi | Baris WHO | Nilai L beda | Nilai M beda | Nilai S beda | Status |
|---|---|---|---|---|---|---|
| BB/U laki-laki | 61 | 61 | 0 | 0 | 0 | sama persis |
| BB/U perempuan | 61 | 61 | 0 | 0 | 0 | sama persis |
| TB/U laki-laki | 61 | 61 | 0 | 0 | 0 | sama persis |
| TB/U perempuan | 61 | 61 | 0 | 0 | 0 | sama persis |
| BB/PB laki-laki | 131 | 131 | 0 | 0 | 0 | sama persis |
| **BB/PB perempuan** | 131 | 131 | 0 | **1** | **1** | **satu baris dikoreksi** |
| BB/TB laki-laki | 111 | 111 | 0 | 0 | 0 | sama persis |
| BB/TB perempuan | 111 | 111 | 0 | 0 | 0 | sama persis |
| Velocity (6 tabel) | 114 | 114 | 0 | 0 | 0 | sama persis |

**Total: 842 baris, 2.526 nilai L/M/S dibandingkan, 2 nilai berbeda (0,08%).**

Kedua nilai yang berbeda berada pada satu baris yang sama, dan sudah dikoreksi.

---

## 2. Sumber yang Diunduh

Seluruh berkas diambil dari cdn.who.int pada 19 Agustus 2026.

| Tabel | Berkas sumber WHO |
|---|---|
| BB/U laki-laki | `wfa-boys-0-5-zscores.pdf` |
| BB/U perempuan | `wfa-girls-0-5-zscores.pdf` |
| TB/U laki-laki, bulan 0–23 | `lfa_boys_0_2_zscores.pdf` (basis panjang terlentang) |
| TB/U laki-laki, bulan 24–60 | `hfa_boys_2_5_zscores.pdf` (basis tinggi berdiri) |
| TB/U perempuan, bulan 0–23 | `lfa_girls_0_2_zscores.pdf` |
| TB/U perempuan, bulan 24–60 | `hfa_girls_2_5_zscores.pdf` |
| BB/PB laki-laki | `wfl-boys-0-2-zscores.pdf` |
| BB/PB perempuan | `wfl-girls-0-2-zscores.pdf` |
| BB/TB laki-laki | `wfh-boys-2-5-zscores.pdf` |
| BB/TB perempuan | `wfh-girls-2-5-zscores.pdf` |
| Velocity, 6 tabel | `lms_weight_{boys,girls}_{1,2,3}mon_p.pdf` |

Catatan penting tentang tabel TB/U: aplikasi memakai satu tabel gabungan 0–60
bulan. Susunannya terbukti benar, yaitu bulan 0 sampai 23 diambil dari tabel
panjang badan dan bulan 24 sampai 60 dari tabel tinggi badan. Itu memang
konvensi WHO. Titik peralihannya terlihat pada nilai median laki-laki: bulan 23
bernilai 86,941 cm (basis panjang) dan bulan 24 bernilai 87,1161 cm (basis
tinggi). Bila keduanya diambil dari basis yang sama, bulan 24 akan bernilai
87,8161 cm.

---

## 3. Satu Koreksi: BB/PB Perempuan Baris 95,5 cm

### Temuan

Pada `constants.ts` aplikasi versi Firebase, baris 95,5 cm tabel `girlsWfl`
berisi nilai yang **identik dengan baris 95,5 cm tabel `girlsWfh`**. Satu baris
dari tabel berat-menurut-tinggi masuk ke tabel berat-menurut-panjang.

```
girlsWfl['95.5'] = [-0.3833, 14.0186, 0.08984]   <- keliru
girlsWfh['95.5'] = [-0.3833, 14.0186, 0.08984]   <- benar untuk tabel ini
nilai resmi WHO  = [-0.3833, 13.8408, 0.08972]
```

### Bukti pendukung

Kesalahan itu juga memutus sifat monoton tabel. Median berat menurut panjang
badan tidak mungkin menurun ketika panjang badan bertambah, tetapi pada
aplikasi lama:

| Panjang | Median menurut aplikasi lama | Median resmi WHO |
|---|---|---|
| 95,0 cm | 13,7146 kg | 13,7146 kg |
| 95,5 cm | **14,0186 kg** | **13,8408 kg** |
| 96,0 cm | 13,9676 kg | 13,9676 kg |

Nilai di baris tengah lebih besar daripada nilai di baris berikutnya. Ini satu-
satunya pelanggaran monotonisitas di antara 728 baris tabel LMS.

### Dampak

Berlaku untuk anak **perempuan berumur di bawah 24 bulan** dengan panjang badan
antara 95,0 dan 96,0 cm, karena interpolasi pada rentang itu memakai baris yang
keliru.

| Berat anak | Z resmi WHO | Z aplikasi lama | Selisih |
|---|---|---|---|
| 10,5 kg | −3,248 | −3,402 | −0,154 |
| 11,0 kg | −2,677 | −2,829 | −0,152 |
| 11,5 kg | −2,140 | −2,290 | −0,150 |
| 12,0 kg | −1,635 | −1,783 | −0,148 |

Ambang klinis bergeser:

| Ambang | Berat menurut WHO | Berat menurut aplikasi lama |
|---|---|---|
| −3 SD (gizi buruk) | 10,713 kg | 10,847 kg |
| −2 SD (gizi kurang) | 11,636 kg | 11,783 kg |

Artinya anak perempuan dengan berat antara 11,64 dan 11,78 kg akan dinyatakan
gizi kurang oleh aplikasi lama, padahal status sebenarnya gizi baik. **Arah
kesalahannya over-diagnosis**, sama seperti temuan delta pada tabel velocity.

### Seberapa sering terjadi di lapangan

Jarang. Panjang badan 95 cm pada umur di bawah 24 bulan tergolong sangat tinggi;
median panjang perempuan pada umur 24 bulan hanya 86,4 cm, sehingga 95,5 cm
berada di sekitar +3 SD. Anak seperti itu ada, tetapi tidak banyak.

Meski begitu, kesalahannya tetap nyata dan sudah dikoreksi. Nilai yang dipakai
sekarang adalah nilai resmi WHO.

### Status

Sudah dikoreksi pada `src/lib/who/lms-bbpb-pr.ts`, dengan penjelasan lengkap
di kepala berkas. Koreksi ini adalah **satu-satunya perubahan nilai** yang
dilakukan terhadap tabel aplikasi lama.

---

## 4. Uji Pencegahan yang Ditambahkan

Kesalahan seperti ini tidak terlihat saat membaca kode: nilainya wajar, jumlah
digitnya benar, tidak ada tanda apa pun yang mencurigakan. Yang menangkapnya
adalah pembandingan terhadap sumber, dan sifat matematis tabelnya.

Karena itu ditambahkan berkas uji `src/lib/zscore/__tests__/integritas-tabel.test.ts`
berisi lima jenis pemeriksaan yang berjalan otomatis pada setiap `npm run test`:

**1. Monotonisitas median.** Median harus naik pada setiap baris berikutnya di
seluruh delapan tabel. Ini yang paling langsung menangkap baris tertukar.

**2. Kehalusan lokal.** Setiap baris dibandingkan dengan titik tengah kedua
tetangganya. Ambangnya dikalibrasi dari data nyata:

| Kelompok tabel | Rasio tertinggi yang sah | Ambang uji |
|---|---|---|
| BB/PB dan BB/TB | 0,022 | 0,10 |
| BB/U | 0,151 (bulan ke-2) | 0,25 |
| TB/U selain bulan 23–24 | 0,146 | 0,25 |
| TB/U bulan 23 dan 24 | 0,672 (peralihan basis) | 0,80 |

Baris salah salin yang ditemukan menghasilkan rasio **1,403**, jauh di atas
ambang 0,10. Uji ini juga memuat pembuktian eksplisit bahwa nilai keliru itu
memang akan tertangkap, sehingga ambangnya tidak bisa dilonggarkan tanpa
disadari.

**3. Rentang parameter S.** Harus berada antara 0,02 dan 0,2 pada semua baris.

**4. Sifat nilai L.** TB/U harus bernilai 1 pada seluruh baris. BB/PB dan BB/TB
harus bernilai tetap per jenis kelamin: −0,3521 untuk laki-laki dan −0,3833
untuk perempuan.

**5. Tidak ada baris identik antara BB/PB dan BB/TB.** Kedua tabel berasal dari
basis pengukuran yang berbeda, sehingga pada rentang tumpang tindih 65–110 cm
tidak boleh ada baris yang nilainya persis sama. Pemeriksaan inilah yang secara
khusus menutup celah kesalahan yang terjadi.

Ditambah satu uji khusus yang memastikan baris 95,5 cm memakai nilai resmi WHO
dan tidak pernah kembali ke nilai lama.

---

## 5. Catatan Metodologi

Yang perlu diketahui tentang batas verifikasi ini:

1. **Nilai L/M/S ditranskripsi manual** dari berkas PDF WHO ke berkas teks, lalu
   dibandingkan secara otomatis. Kesalahan transkripsi pada sisi WHO akan
   muncul sebagai perbedaan palsu, bukan sebagai perbedaan yang terlewat. Tujuh
   dari delapan tabel cocok sempurna, yang menunjukkan transkripsinya bersih;
   bila ada kesalahan ketik, ia akan tampak sebagai perbedaan acak yang
   tersebar, bukan sebagai satu baris yang persis sama dengan tabel lain.
2. **Satu perbedaan yang ditemukan bukan kesalahan transkripsi**, karena nilai
   di aplikasi lama persis sama dengan baris tabel BB/TB perempuan pada panjang
   yang sama. Kebetulan seperti itu tidak mungkin terjadi karena salah ketik.
3. **Uji regresi terhadap engine lama tidak mencakup perbedaan ini**, karena
   porting engine lama memakai tabel yang sama dengan engine baru. Pembagian
   itu disengaja: satu berkas uji menjaga algoritma, satu berkas uji menjaga
   data. Sudah dicatat di kepala `regresi.test.ts`.
4. **Tabel velocity diverifikasi dua lapis**: nilai L/M/S dibandingkan baris per
   baris, dan hasil perhitungan ambang persentil 5 dibandingkan dengan kolom
   persentil 5 yang diterbitkan WHO pada seluruh 114 baris.

---

## 6. Cara Menjalankan Ulang Verifikasi

Perbandingan terhadap sumber WHO dilakukan sekali dan hasilnya diabadikan dalam
uji otomatis. Untuk memeriksa bahwa tabel tidak berubah sejak verifikasi:

```bash
npx vitest run integritas-tabel
```

Bila suatu hari tabel WHO diperbarui atau ada keraguan baru, unduh ulang berkas
di bagian 2 dan bandingkan kembali. Jangan mengubah nilai di `src/lib/who/`
tanpa mencatat alasan dan sumbernya di kepala berkas, seperti yang dilakukan
pada koreksi baris 95,5 cm.
