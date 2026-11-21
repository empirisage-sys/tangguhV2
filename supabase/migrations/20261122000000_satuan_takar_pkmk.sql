-- =====================================================================
-- Satuan takar produk PKMK (sendok takar, sachet, sendok makan)
--
-- Sampai sekarang setiap produk dianggap ditakar dengan SENDOK TAKAR. Tidak
-- semua produk demikian. Transvita (PT Lukas Transamin Perkasa) dikemas per
-- sachet 40 g: satu sachet dilarutkan dalam 135 ml air, dan sachet tidak
-- dibagi di luar rumah sakit. Bila produk seperti itu dimasukkan sebagai
-- "1 sendok per saji", layar akan menulis "1 sendok" kepada ibu, padahal yang
-- dimaksud satu bungkus utuh.
--
-- Kolom baru ini hanya menentukan NAMA satuan. Seluruh perhitungan tetap
-- memakai kolom yang sama (sendok_per_saji, kkal_per_saji, ml_per_saji):
-- "per sendok" pada nama kolom kini berarti "per satuan takar". Takaran
-- sudah selalu dibulatkan ke bilangan bulat, sehingga sachet selalu utuh.
--
-- Aman dijalankan ulang. Baris yang sudah ada menjadi 'sendok_takar'.
-- WAJIB dijalankan SEBELUM kode yang menyimpan kolom ini dideploy, karena
-- formulir admin akan menulis kolom satuan_takar.
-- =====================================================================

alter table public.produk_pkmk
  add column if not exists satuan_takar text not null default 'sendok_takar';

alter table public.produk_pkmk
  drop constraint if exists chk_pkmk_satuan_takar;
alter table public.produk_pkmk
  add constraint chk_pkmk_satuan_takar
  check (satuan_takar in ('sendok_takar', 'sachet', 'sendok_makan'));

comment on column public.produk_pkmk.satuan_takar is
  'Satuan takar menurut label: sendok_takar (bawaan), sachet, atau sendok_makan. '
  'Kolom sendok_per_saji, ml_air_per_sendok, kkal_per_sendok, dan '
  'gram_per_sendok_takar dibaca "per satuan takar".';
