-- =====================================================================
-- APLIKASI TANGGUH - MIGRASI KEENAM (BAGIAN 1 DARI 3)
-- PERAN BARU: DOKTER SPESIALIS ANAK (BERTUGAS DI RUMAH SAKIT)
--
-- Versi     : 1.6
-- Tanggal   : 26 Agustus 2026
-- Prasyarat : 20260825090000_pendaftaran_tahan_galat.sql
--
-- MENGAPA BERDIRI SENDIRI
-- PostgreSQL tidak mengizinkan sebuah nilai enum yang baru ditambahkan
-- dipakai di dalam transaksi yang sama. Penambahan nilai karena itu berdiri
-- sendiri di berkas ini, dan seluruh aturan yang memakainya berada di
-- 20260826100100_peran_dsa_aturan.sql. Jalankan berkas ini lebih dahulu,
-- tunggu sampai selesai, baru jalankan berkas berikutnya.
-- =====================================================================

alter type public.user_role add value if not exists 'dokter_spesialis_anak';
