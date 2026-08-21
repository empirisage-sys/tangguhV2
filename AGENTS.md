# ATURAN MENGIKAT PENGEMBANGAN APLIKASI TANGGUH

Dokumen ini dibaca agen Antigravity setiap sesi dan memuat aturan yang tidak boleh dilanggar.

---

## 1. Keamanan dan Supabase

1. **JANGAN PERNAH** menuliskan `SUPABASE_SERVICE_ROLE_KEY` di kode yang dapat berjalan di browser, di Client Component, atau di berkas berawalan `NEXT_PUBLIC_`.
2. **JANGAN PERNAH** memakai pola cookie lama Supabase (`get`, `set`, `remove`). Hanya `getAll` dan `setAll`.
3. **JANGAN PERNAH** memakai `supabase.auth.getSession()` untuk keputusan otorisasi di sisi server. Gunakan `getClaims()`.
4. **JANGAN PERNAH** membuat tabel tanpa `enable row level security` beserta policy-nya dalam migrasi yang sama.
5. **JANGAN PERNAH** mengandalkan `proxy.ts` sebagai satu-satunya lapis otorisasi. Otorisasi ditegakkan oleh `src/lib/supabase/penjaga.ts` dan policy RLS.
6. **JANGAN PERNAH** menghapus baris pada `balita` atau `skrining`. Gunakan `deleted_at`.
7. **JANGAN PERNAH** menerima nilai Z, status gizi, atau kebutuhan kalori dari klien lalu menyimpannya apa adanya. Server wajib menghitung ulang dari angka mentah.
8. **JANGAN PERNAH** menulis `.env*` ke repositori, log, Artifact, atau pesan commit.

---

## 2. Aturan Klinis & Engine Z-Score

1. **Tabel WHO Resmi**: Jangan mengedit berkas di `src/lib/who/`. Seluruh 842 baris tabel LMS dan velocity telah diverifikasi baris per baris terhadap sumber resmi WHO.
2. **Delta Velocity**: Tabel velocity WHO memiliki delta yang WAJIB dikurangkan: hitung dari LMS → kurangi delta → skalakan ke jumlah hari sebenarnya.
3. **Penyaringan Kategori**: Jangan pernah menyaring data berdasarkan pencocokan teks status. Selalu pakai kode kategori enum (contoh: `gizi_buruk`, `pendek`).
4. **Lapisan Logika Murni**: Fungsi di lapisan logika tidak boleh mengembalikan teks yang dibaca pengguna maupun nama kelas CSS.
5. **Penolakan Nilai di Luar Rentang**: Nilai di luar rentang tabel dikembalikan sebagai `null` dengan keterangan, tidak dijepit. Penjepitan hanya pada fungsi khusus kurva (`lmsUntukKurva`).
6. **Batas Umur 0–60 Bulan**: Umur di atas 60 bulan ditolak untuk SELURUH indikator.
7. **Dua Angka Kebutuhan Gizi**: Kebutuhan gizi menghasilkan dua angka: pemeliharaan dan tumbuh kejar, disertai penanda `kalori_metode`.
8. **Versi Engine**: Simpan `engine_version` pada setiap baris skrining (`zscore-2.0.0`).

---

## 3. Registrasi & Verifikasi

1. **Persetujuan Admin**: Seluruh peran wajib melalui persetujuan admin dinas sebelum dapat mengakses data balita.
2. **Peran Admin**: Peran `admin` tidak boleh dapat dibuat lewat pendaftaran mandiri.
3. **Penolakan Berketerangan**: Penolakan pendaftaran wajib disertai alasan minimal 10 karakter.
4. **Wilayah Penulisan**: Wilayah balita dan skrining diambil dari `wilayahUntukMenulis(profil)` di server, tidak pernah dari input form.
5. **Jenjang Wilayah & Faskes**: Registrasi bertingkat: 38 Provinsi ➔ Kabupaten/Kota ➔ Kartu Jenis Faskes (Puskesmas | RS) ➔ Faskes (Master/Usulan) ➔ Posyandu Manual (Kader). Isian manual disimpan berstatus `usulan` sampai dinormalkan admin.
6. **Cakupan Data Balita (D-9)**: Spesialis/Nakes di Rumah Sakit HANYA dapat melihat data balita yang diinput sendiri (dan pasien rujukan aktif 90 hari). Kader melihat posyandunya, nakes puskesmas melihat puskesmasnya, admin melihat se-provinsi.

---

## 4. Desain & Aksesibilitas

1. **Warna Utama**: Biru-hijau laut (`#0B7681`, `#12B5C0`) sebagai warna merek.
2. **Aksen**: Kuning Karawo (`#FFC53D`, `#F5A524`).
3. **Warna Status Khusus Medis**: Aman (`#E8F8EF`), Waspada (`#FFF6E0`), Bahaya (`#FEECEC`). Jangan memakai warna status untuk tombol aksi umum.
4. **Latar Ramah Mata**: Putih kabut (`#F6FAFB`) untuk pemakaian luar ruangan.
5. **Ergonomi**: Sasaran sentuh minimum 48px, tinggi input 56px, huruf angka tabular `IBM Plex Mono`.
