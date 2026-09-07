-- Menyimpan HASIL takaran, bukan hanya targetnya.
--
-- Alasan: pada purwarupa lama hanya target yang tersimpan, sehingga resep yang
-- benar-benar diberikan kepada anak tidak dapat diaudit kemudian. Kartu
-- menuliskan 600 kkal sementara takaran yang tercetak hanya memberi 360 kkal,
-- dan data lama tidak menyimpan apa pun yang memungkinkan selisih itu
-- ditemukan kembali.
--
-- Seluruh kolom bersifat tambahan dan boleh kosong, sehingga baris lama tetap
-- sah. Row level security serta policy tabel `asuhan_gizi` tidak berubah dan
-- tetap berlaku pada kolom-kolom ini.

alter table public.asuhan_gizi
  add column if not exists produk_pkmk_kode      text,
  add column if not exists mode_takaran          text
    check (mode_takaran is null or mode_takaran in ('dari_takaran', 'dari_target')),
  add column if not exists sendok_per_saji       smallint
    check (sendok_per_saji is null or sendok_per_saji between 1 and 15),
  add column if not exists sendok_per_hari       smallint
    check (sendok_per_hari is null or sendok_per_hari >= 0),
  add column if not exists kalori_persen_target  smallint
    check (kalori_persen_target is null or kalori_persen_target between 0 and 100),
  -- Energi yang BENAR-BENAR diberikan takaran akhir. Bukan target.
  add column if not exists kalori_diberikan      integer,
  add column if not exists kalori_selisih        integer,
  add column if not exists ml_larutan_per_saji   numeric(6,1),
  add column if not exists ml_larutan_per_hari   numeric(7,1),
  add column if not exists sisa_kalori_makanan   integer,
  add column if not exists ringkasan_takaran     text,
  add column if not exists peringatan_takaran    jsonb;

comment on column public.asuhan_gizi.kalori_target is
  'Target energi PKMK dalam kkal. BUKAN energi yang diberikan takaran.';
comment on column public.asuhan_gizi.kalori_diberikan is
  'Energi yang benar-benar diberikan takaran akhir, kkal. Selalu sendok_per_hari x kkal per sendok produk.';
comment on column public.asuhan_gizi.sisa_kalori_makanan is
  'Sisa kebutuhan yang harus dipenuhi makanan keluarga atau ASI. Dihitung dari kalori_diberikan, bukan dari kalori_target.';
