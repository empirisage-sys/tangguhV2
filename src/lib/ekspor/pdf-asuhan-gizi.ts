import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatTanggal } from '@/lib/tampilan/format'
import type { HasilTakaran } from '@/lib/pkmk/hitung'
import { sisaDariMakanan } from '@/lib/pkmk/hitung'
import {
  bacaSeluruhPeringatan,
  bacaSlotJadwal,
  judulJadwal,
  keteranganProduk,
  ringkasanTakaran,
} from '@/lib/pkmk/teks'
import { susunJadwal } from '@/lib/pkmk/jadwal'

/**
 * Lembar "Tata Laksana Nutrisi Anak" yang dibawa pulang ibu.
 *
 * ATURAN YANG MENGIKAT BERKAS INI
 * -------------------------------
 * Lembar ini WAJIB mencetak takaran nyata dan energi yang benar-benar diberikan
 * takaran itu — bukan target. Yang diminum anak adalah takarannya, bukan angka
 * di kartu. Pada purwarupa lama, lembar yang dibawa pulang memuat 600 kkal
 * sementara resep yang tertulis di lembar yang sama hanya memberi 360 kkal.
 *
 * Setiap angka di bawah berasal dari satu objek `HasilTakaran`. Tidak ada
 * perhitungan ulang di berkas ini, dan tidak boleh ditambahkan.
 *
 * Catatan: peringatan bahwa data produk belum diverifikasi terhadap label
 * kemasan sengaja TIDAK dicetak pada lembar ini, atas permintaan pemilik
 * aplikasi. Peringatan itu tetap tampil pada layar dietisien di
 * `FormulasiPKMKSection`, tempat takaran disusun.
 */

export type IdentitasLembarAsuhan = {
  namaBalita: string
  nik?: string | null
  tanggalLahir?: string | null
  umurBulan?: number | null
  namaIbu?: string | null
  namaPuskesmas?: string | null
  tataLaksana: string
  /** Total kebutuhan energi tumbuh kejar balita, kkal. */
  totalKebutuhanKkal: number
  namaDietisien?: string | null
  /** Anak masih mendapat ASI. Menentukan Alternatif 1 atau 2 pada tabel jadwal. */
  masihASI?: boolean
}

function angka(nilai: number): string {
  const n = Math.round(nilai * 10) / 10
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

export async function buatPdfLembarAsuhanGizi(
  identitas: IdentitasLembarAsuhan,
  hasil: HasilTakaran,
): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const tglCetak = formatTanggal(new Date().toISOString().slice(0, 10))
  const peringatan = bacaSeluruhPeringatan(hasil)

  // 1. Kop
  doc.setFillColor(14, 150, 161)
  doc.rect(0, 0, 210, 8, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 43, 49)
  doc.text('Aplikasi Tanggulangi Stunting untuk Hulondalo (Tangguh)', 105, 16, {
    align: 'center',
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(74, 107, 114)
  doc.text('Deteksi Dini & Intervensi Stunting Berstandar WHO / Kemenkes RI', 105, 22, {
    align: 'center',
  })

  doc.setDrawColor(220, 233, 235)
  doc.setLineWidth(0.8)
  doc.line(15, 26, 195, 26)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(11, 118, 129)
  doc.text('TATA LAKSANA NUTRISI ANAK', 105, 33, { align: 'center' })

  // 2. Identitas
  autoTable(doc, {
    startY: 37,
    margin: { left: 15, right: 15 },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.3, textColor: [15, 43, 49] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35, textColor: [74, 107, 114] },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', cellWidth: 35, textColor: [74, 107, 114] },
      3: { cellWidth: 55 },
    },
    body: [
      [
        'Nama Balita',
        `: ${identitas.namaBalita}`,
        'Tanggal Cetak',
        `: ${tglCetak}`,
      ],
      [
        'NIK Balita',
        `: ${identitas.nik ?? '-'}`,
        'Umur',
        `: ${identitas.umurBulan != null ? `${identitas.umurBulan} Bulan` : '-'}`,
      ],
      [
        'Tanggal Lahir',
        `: ${identitas.tanggalLahir ? formatTanggal(identitas.tanggalLahir) : '-'}`,
        'Puskesmas',
        `: ${identitas.namaPuskesmas ?? '-'}`,
      ],
      [
        'Nama Ibu',
        `: ${identitas.namaIbu ?? '-'}`,
        'Tata Laksana',
        `: ${identitas.tataLaksana}`,
      ],
    ],
  })

  const posTakaran =
    ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5

  // 3. TAKARAN — bagian terpenting, dicetak paling menonjol
  // Tinggi kotak DIHITUNG dari jumlah baris teks setelah dipotong, bukan dipatok.
  // Versi sebelumnya memakai tinggi tetap 24 mm, sehingga ringkasan yang memakan
  // dua baris menabrak keterangan produk di bawahnya.
  const LEBAR_ISI = 170
  const TINGGI_BARIS = 5.6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  const barisRingkasan = doc.splitTextToSize(ringkasanTakaran(hasil), LEBAR_ISI) as string[]

  const yRingkasan = posTakaran + 14
  const yKeterangan = yRingkasan + (barisRingkasan.length - 1) * TINGGI_BARIS + 6
  const tinggiKotak = yKeterangan - posTakaran + 4

  doc.setFillColor(232, 248, 240)
  doc.setDrawColor(27, 128, 75)
  doc.setLineWidth(0.4)
  doc.roundedRect(15, posTakaran, 180, tinggiKotak, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(21, 110, 63)
  doc.text('CARA PEMBERIAN', 20, posTakaran + 7)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(15, 43, 49)
  doc.text(barisRingkasan, 20, yRingkasan, { lineHeightFactor: 1.15 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(74, 107, 114)
  doc.text(`${hasil.produk.nama} — ${keteranganProduk(hasil)}`, 20, yKeterangan)

  // 4. Rincian energi. Label wajib menyebut "diberikan takaran ini", bukan "target".
  autoTable(doc, {
    startY: posTakaran + tinggiKotak + 5,
    margin: { left: 15, right: 15 },
    theme: 'grid',
    styles: { fontSize: 8.8, cellPadding: 1.9, textColor: [15, 43, 49] },
    headStyles: { fillColor: [14, 150, 161], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['Rincian Energi Harian', 'Nilai']],
    body: [
      ['Kebutuhan energi tumbuh kejar balita', `${angka(identitas.totalKebutuhanKkal)} kkal`],
      ['Target energi dari PKMK', `${angka(hasil.targetKkal)} kkal`],
      [
        'ENERGI YANG DIBERIKAN TAKARAN INI',
        `${angka(hasil.kkalDiberikan)} kkal  (${angka(hasil.persenTerhadapTarget)}% dari target)`,
      ],
      [
        'Selisih terhadap target',
        `${hasil.selisihKkal >= 0 ? '+' : '-'}${angka(Math.abs(hasil.selisihKkal))} kkal`,
      ],
      [
        'Sisa yang harus dipenuhi makanan keluarga / ASI',
        `${angka(sisaDariMakanan(identitas.totalKebutuhanKkal, hasil))} kkal`,
      ],
      [
        'Volume larutan',
        `${angka(hasil.mlLarutanPerSaji)} ml per saji, ${angka(hasil.mlLarutanPerHari)} ml per hari`,
      ],
    ],
    didParseCell: (data) => {
      // Baris energi nyata ditebalkan: itu angka yang menentukan, bukan targetnya.
      if (data.row.index === 2) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [237, 243, 245]
      }
    },
  })

  let posY = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5

  // 5. Jadwal makan harian. Baris PKMK-nya turunan dari takaran yang sama,
  //    bukan tabel terpisah yang ditulis tangan.
  const jadwal = susunJadwal({ hasil, masihASI: identitas.masihASI ?? false })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(11, 118, 129)
  doc.text(judulJadwal(jadwal), 15, posY)

  autoTable(doc, {
    startY: posY + 2.5,
    margin: { left: 15, right: 15 },
    theme: 'plain',
    styles: { fontSize: 8.3, cellPadding: 1.4, textColor: [15, 43, 49] },
    headStyles: {
      fontStyle: 'bold',
      textColor: [74, 107, 114],
      lineWidth: { bottom: 0.3 },
      lineColor: [15, 43, 49],
    },
    bodyStyles: { lineWidth: { bottom: 0.1 }, lineColor: [220, 233, 235] },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 158 } },
    head: [['Waktu', 'Jenis nutrisi']],
    body: jadwal.slot.map((slot) => {
      const teks = bacaSlotJadwal(slot, hasil.produk.nama)
      return [slot.jam, `${teks.tebal}${teks.biasa}`]
    }),
    didParseCell: (data) => {
      // Baris PKMK ditebalkan: itu yang membedakannya dari makanan keluarga.
      if (data.section === 'body' && jadwal.slot[data.row.index]?.jenis === 'pkmk') {
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  posY = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5

  // 6. Peringatan — seluruhnya, tanpa disaring
  if (peringatan.length > 0) {
    autoTable(doc, {
      startY: posY,
      margin: { left: 15, right: 15 },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.8, textColor: [15, 43, 49] },
      headStyles: { fillColor: [255, 246, 224], textColor: [122, 74, 0], fontStyle: 'bold' },
      head: [['Perhatian', 'Saran Tindakan']],
      body: peringatan.map((p) => [p.pesan, p.saran]),
      columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 90 } },
    })
    posY = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5
  }

  // Bila sisa halaman tidak cukup untuk penyangkalan dan tanda tangan,
  // pindah ke halaman berikutnya daripada menumpuk teks di tepi bawah.
  // Baris terakhir blok penutup (tanda tangan) jatuh 28 mm di bawah `posY`.
  // Batas 283 mm menyisakan ruang bagi footer di 287 mm.
  const TINGGI_PENUTUP = 28
  if (posY + TINGGI_PENUTUP > 283) {
    doc.addPage()
    posY = 25
  }

  // 7. Penyangkalan klinis.
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(122, 149, 155)
  doc.text(
    'lembar ini adalah alat bantu asuhan gizi, bukan pengganti pemeriksaan dan keputusan klinis tenaga kesehatan.',
    15,
    posY,
    { maxWidth: 180 },
  )

  // 8. Tanda tangan
  const posTtd = posY + 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(15, 43, 49)
  doc.text(`Dicetak di Gorontalo: ${tglCetak}`, 135, posTtd)
  doc.text('Dietisien / Tenaga Kesehatan,', 135, posTtd + 5)
  doc.text(`( ${identitas.namaDietisien ?? '.....................................'} )`, 135, posTtd + 20)

  const jumlahHalaman = doc.getNumberOfPages()
  for (let h = 1; h <= jumlahHalaman; h++) {
    doc.setPage(h)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(122, 149, 155)
    doc.text('Aplikasi TANGGUH • Modul PKMK • Standar WHO 2006', 15, 287)
    if (jumlahHalaman > 1) {
      doc.text(`Halaman ${h} dari ${jumlahHalaman}`, 195, 287, { align: 'right' })
    }
  }

  return new Uint8Array(doc.output('arraybuffer'))
}
