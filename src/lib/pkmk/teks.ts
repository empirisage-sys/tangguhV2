/**
 * Lapisan tampilan untuk modul PKMK.
 *
 * Seluruh teks yang dibaca pengguna berada di sini, terpisah dari lapisan
 * logika di `hitung.ts` (AGENTS.md 2.4).
 */

import type { HasilTakaran, Peringatan } from './hitung'

function angka(nilai: number): string {
  const dibulatkan = Math.round(nilai * 10) / 10
  return Number.isInteger(dibulatkan)
    ? String(dibulatkan)
    : dibulatkan.toFixed(1).replace('.', ',')
}

/** Kalimat ringkas takaran yang dibaca ibu dan tercetak di lembar asuhan gizi. */
export function ringkasanTakaran(hasil: HasilTakaran): string {
  return (
    `${hasil.frekuensiPerHari}x sehari — ${angka(hasil.sendokPerSaji)} sendok takar ` +
    `${hasil.produk.nama} dalam ${angka(hasil.mlLarutanPerSaji)} ml larutan per saji ` +
    `(total ${angka(hasil.sendokPerHari)} sendok/hari, ${angka(hasil.kkalDiberikan)} kkal).`
  )
}

export type PeringatanTerbaca = {
  kode: Peringatan['kode']
  nada: Peringatan['nada']
  pesan: string
  saran: string
}

export function bacaPeringatan(p: Peringatan): PeringatanTerbaca {
  const a = p.angka
  switch (p.kode) {
    case 'kurang_dari_target':
      return {
        kode: p.kode,
        nada: p.nada,
        pesan: `Takaran ini kurang ${angka(a.kurangKkal!)} kkal dari target (${angka(a.persen!)}% di bawah target, batas toleransi ${angka(a.toleransiPersen!)}%).`,
        saran:
          'Tambah jumlah sendok per saji atau tambah frekuensi pemberian, lalu periksa kembali volume per sajinya.',
      }
    case 'lebih_dari_target':
      return {
        kode: p.kode,
        nada: p.nada,
        pesan: `Takaran ini melebihi target ${angka(a.lebihKkal!)} kkal (${angka(a.persen!)}% di atas target, batas toleransi ${angka(a.toleransiPersen!)}%).`,
        saran:
          'Kurangi sendok per saji atau frekuensi bila anak tidak menghabiskan, dan pantau berat badan pada kunjungan berikutnya.',
      }
    case 'volume_per_saji_berlebih':
      return {
        kode: p.kode,
        nada: p.nada,
        pesan: `Volume per saji ${angka(a.mlPerSaji!)} ml melebihi batas wajar ${angka(a.batasMl!)} ml untuk balita.`,
        saran: `Bagi menjadi ${angka(a.frekuensiSaran!)}x sehari agar tiap saji lebih kecil. Volume terlalu besar membuat anak kenyang sebelum kalorinya masuk.`,
      }
    case 'target_tidak_tercapai':
      return {
        kode: p.kode,
        nada: p.nada,
        pesan: `Target ${angka(a.targetKkal!)} kkal tidak tercapai tanpa melewati batas ${angka(a.sendokMaks!)} sendok per saji. Takaran ini hanya memberi ${angka(a.kkalDiberikan!)} kkal.`,
        saran:
          'Tambah frekuensi pemberian, atau pilih produk dengan densitas energi lebih tinggi. Bila tetap tidak tercapai, tinjau ulang target bersama dokter.',
      }
  }
}

export function bacaSeluruhPeringatan(hasil: HasilTakaran): PeringatanTerbaca[] {
  return hasil.peringatan.map(bacaPeringatan)
}

/** Keterangan kecil di bawah nama produk, agar dietisien dapat memeriksa sendiri. */
export function keteranganProduk(hasil: HasilTakaran): string {
  return `${angka(hasil.kkalPerSendok)} kkal dan ${angka(hasil.mlLarutanPerSendok)} ml larutan per sendok takar`
}
