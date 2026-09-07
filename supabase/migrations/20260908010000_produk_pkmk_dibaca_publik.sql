-- =====================================================================
-- Produk PKMK dapat dibaca pengguna publik (anon)
--
-- DITEMUKAN SAAT UJI PRODUKSI, bukan saat audit kode.
--
-- Policy yang ada, dari migrasi awal:
--
--   create policy "referensi dibaca semua" on public.produk_pkmk
--     for select to authenticated using (is_active or public.is_admin());
--
-- Perannya hanya `authenticated`. Halaman publik `skrining-tamu` memuat
-- kalkulator PKMK yang sama dengan layar dietisien, tetapi pengunjungnya
-- adalah peran `anon`, sehingga pembacaan master data selalu gagal dan
-- formulir jatuh ke daftar cadangan statis disertai spanduk merah.
--
-- Sebelum perbaikan audit T-0, kegagalan itu tidak terlihat karena aplikasi
-- diam-diam menyajikan daftar statis pada SEMUA jalur. Sekarang kegagalannya
-- terlihat — itu memang yang diinginkan — tetapi pada halaman publik yang
-- sengaja disediakan gratis, jatuh ke cadangan bukan perilaku yang benar.
--
-- Mengapa aman dibuka untuk anon:
--   - isinya spesifikasi produk susu yang tercetak pada kemasan yang dijual
--     bebas: nama, merek, kalori per saji, sendok per saji, volume per saji
--   - BUKAN data pasien, dan tidak memuat satu pun kolom yang merujuk balita
--   - halaman kalkulatornya sendiri sudah publik dan diiklankan sebagai
--     akses gratis untuk masyarakat
--
-- Yang TIDAK dibuka: hanya SELECT, dan hanya baris `is_active`. Penambahan,
-- pengubahan, dan penghapusan tetap milik admin melalui policy yang ada.
-- =====================================================================

drop policy if exists "produk pkmk aktif dibaca publik" on public.produk_pkmk;

create policy "produk pkmk aktif dibaca publik" on public.produk_pkmk
  for select to anon using (is_active);

comment on table public.produk_pkmk is
  'Master produk PKMK. Baris aktif dapat dibaca peran anon agar kalkulator '
  'publik skrining-tamu memakai master data yang sama dengan layar dietisien, '
  'bukan daftar cadangan statis. Penulisan tetap terbatas pada admin.';
