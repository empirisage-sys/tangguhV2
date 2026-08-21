# RENCANA TEKNIS PENGEMBANGAN APLIKASI TANGGUH

Dokumen pelacak status berkas, pemetaan komponen, urutan pengerjaan sprint, dan manajemen risiko teknis.

---

## 1. Inventaris Berkas & Status Verifikasi

| Komponen / Berkas | Status Uji | Keterangan |
|---|---|---|
| `src/lib/who/` (842 baris tabel LMS & velocity) | **Terverifikasi 100%** | Diverifikasi terhadap tabel resmi WHO, 2 baris dikoreksi pada 95.5 cm |
| `src/lib/zscore/` (`zscore-2.0.0`) | **230 Uji Lolos** | Menghitung Z-Score WHO, regresi 4.032 kasus, kalori & protein catch-up, batas 0-60 bulan |
| `src/lib/grafik/` (seri kurva & render SVG) | **53 Uji Lolos** | Seri titik riwayat dan perender SVG independen untuk ekspor PDF |
| `src/lib/tampilan/` (status, pita, format, akses) | **72 Uji Lolos** | Matematika Pita Z-Score, pembagian hak akses peran, pemformatan string |
| `src/lib/validasi/` (skema Zod) | **12 Uji Lolos** | Skema validasi pendaftaran dan skrining balita |
| `src/lib/db/pemetaan.ts` | **8 Uji Lolos** | Pemetaan kalkulasi engine ke baris tabel Supabase |
| `src/proxy.ts` | Siap diuji | Middleware Next.js 16 untuk penyegaran sesi & pengalihan rute |
| `src/lib/supabase/` (penjaga, server, client, admin) | Siap diuji | Lapisan otorisasi token & manipulasi database |
| `src/components/ui/` & `src/components/skrining/` | Siap render | Komponen visual Pita Z-Score, Kartu Hasil, InputAngka, Button |
| `supabase/migrations/` (3 file migrasi SQL) | Siap jalankan | Skema DB, RLS 4 peran, view agregat, fungsi verifikasi |

---

## 2. Urutan Pengerjaan & Ketergantungan (Sprint 1 - 11)

1. **Sprint 1 - 3**: Fondasi Next.js 16 + React 19 + Supabase SSR + Auth & Verifikasi Admin (`/masuk`, `/daftar`, `/menunggu-verifikasi`, `/admin/verifikasi`).
2. **Sprint 4**: Engine Perhitungan Z-Score (`zscore-2.0.0`) — *Selesai & terbukti 230 uji*.
3. **Sprint 5**: Modul Balita (`/balita`, `/balita/baru`, `/balita/[id]`).
4. **Sprint 6**: Form Skrining 3-Langkah (`/balita/[id]/skrining-baru`) dengan hitung instan + `PitaZScore` + `KartuHasil`.
5. **Sprint 7**: Visualisasi Kurva WHO & Evaluasi Velocity (`KurvaWHO`, `TrenZScore`, `PanelKurva`).
6. **Sprint 8**: Modul Dietisien & Kalkulator Resep PKMK (`/dietisien`).
7. **Sprint 9**: Rekapitulasi Wilayah & Ekspor Laporan Excel (`exceljs`) / PDF (`jspdf` + SVG).
8. **Sprint 10**: Offline Mode & PWA (IndexedDB outbox pattern & sync).
9. **Sprint 11**: Kesiapan Produksi & Uji Keamanan RLS.

---

## 3. Matriks Risiko Teknis & Mitigasi

| Risiko Teknis | Potensi Dampak | Strategi Mitigasi |
|---|---|---|
| Salah hitung Z-Score di lapangan | Salah diagnosis klinis anak | Engine `zscore-2.0.0` murni, teruji 230 test suit, dihitung ulang di server |
| Bocor data balita antar faskes / kabupaten | Pelanggaran UU PDP No. 27/2022 | RLS ketat berbasis wilayah profil pengguna + `security_invoker = on` pada views |
| Penggunaan di bawah terik matahari | Silau dan susah dibaca kader | Latar *Putih Kabut* (`#F6FAFB`) dan kontras teks tinggi (`#0F2B31`) |
| Jaringan seluler putus di Posyandu terpencil | Data skrining hilang saat kirim | Pola outbox IndexedDB (`idb`) dengan kunci idempoten `client_uuid` |
| Angka rekap lambat / tidak sinkron | Laporan dinas tertunda | Kueri agregat efisien via view `v_rekap_bulanan` dengan pembilang & penyebut transparan |
