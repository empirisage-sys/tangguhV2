/**
 * BERKAS INI SUDAH DIPENSIUNKAN.
 *
 * Sumber kebenaran data dan perhitungan PKMK kini berada di `src/lib/pkmk/`.
 *
 * Versi lama berkas ini memuat dua angka patokan yang menjadi akar cacat pada
 * purwarupa: `mlAirPerSendok: 30` untuk hampir semua produk, dan perhitungan
 * takaran yang melaporkan target sebagai kenyataan. Keduanya sudah dihapus.
 * Jangan menambahkan kembali angka patokan apa pun di sini.
 */

export type { ProdukPKMK } from '@/lib/pkmk/produk'
export { PRODUK_PKMK as PRODUK_PKMK_LIST, produkById, produkUntukUmur } from '@/lib/pkmk/produk'
