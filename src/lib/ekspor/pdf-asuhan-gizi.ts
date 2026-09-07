import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatTanggal } from '@/lib/tampilan/format'
import type { HasilTakaran } from '@/lib/pkmk/hitung'
import { sisaDariMakanan } from '@/lib/pkmk/hitung'
import { PERINGATAN_DATA_PRODUK } from '@/lib/pkmk/produk'
import { bacaSeluruhPeringatan, keteranganProduk, ringkasanTakaran } from '@/lib/pkmk/teks'

/**
 * Lembar Asuhan Gizi PKMK yang dibawa pulang ibu.
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
  doc.setFontSize(14)
  doc.setTextColor(15, 43, 49)
  doc.text('PEMERINTAH PROVINSI GORONTALO', 105, 18, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(74, 107, 114)
  doc.text(
    'APLIKASI TANGGUH — Deteksi Dini & Intervensi Stunting Berstandar WHO / Kemenkes RI',
    105,
    24,
    { align: 'center' },
  )

  doc.setDrawColor(220, 233, 235)
  doc.setLineWidth(0.8)
  doc.line(15, 28, 195, 28)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(11, 118, 129)
  doc.text('LEMBAR ASUHAN GIZI — TAKARAN SAJI PKMK', 105, 36, { align: 'center' })

  // 2. Identitas
  autoTable(doc, {
    startY: 41,
    margin: { left: 15, right: 15 },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.5, textColor: [15, 43, 49] },
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
    ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // 3. TAKARAN — bagian terpenting, dicetak paling menonjol
  doc.setFillColor(232, 248, 240)
  doc.setDrawColor(27, 128, 75)
  doc.setLineWidth(0.4)
  doc.roundedRect(15, posTakaran, 180, 24, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(21, 110, 63)
  doc.text('CARA PEMBERIAN', 20, posTakaran + 7)

  doc.setFontSize(12)
  doc.setTextColor(15, 43, 49)
  doc.text(ringkasanTakaran(hasil), 20, posTakaran + 15, { maxWidth: 170 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(74, 107, 114)
  doc.text(`${hasil.produk.nama} — ${keteranganProduk(hasil)}`, 20, posTakaran + 21)

  // 4. Rincian energi. Label wajib menyebut "diberikan takaran ini", bukan "target".
  autoTable(doc, {
    startY: posTakaran + 29,
    margin: { left: 15, right: 15 },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5, textColor: [15, 43, 49] },
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

  let posY = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // 5. Peringatan — seluruhnya, tanpa disaring
  if (peringatan.length > 0) {
    autoTable(doc, {
      startY: posY,
      margin: { left: 15, right: 15 },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 43, 49] },
      headStyles: { fillColor: [255, 246, 224], textColor: [122, 74, 0], fontStyle: 'bold' },
      head: [['Perhatian', 'Saran Tindakan']],
      body: peringatan.map((p) => [p.pesan, p.saran]),
      columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 90 } },
    })
    posY = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }

  // 6. Penyangkalan. Peringatan data produk WAJIB ada pada setiap cetakan.
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(122, 74, 0)
  doc.text(PERINGATAN_DATA_PRODUK, 15, posY, { maxWidth: 180 })

  doc.setTextColor(122, 149, 155)
  doc.text(
    'Penyangkalan Klinis: lembar ini adalah alat bantu asuhan gizi, bukan pengganti pemeriksaan dan keputusan klinis tenaga kesehatan.',
    15,
    posY + 8,
    { maxWidth: 180 },
  )

  // 7. Tanda tangan
  const posTtd = posY + 20
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(15, 43, 49)
  doc.text(`Dicetak di Gorontalo: ${tglCetak}`, 135, posTtd)
  doc.text('Dietisien / Tenaga Kesehatan,', 135, posTtd + 5)
  doc.text(`( ${identitas.namaDietisien ?? '.....................................'} )`, 135, posTtd + 26)

  doc.setFontSize(8)
  doc.setTextColor(122, 149, 155)
  doc.text('Aplikasi TANGGUH • Modul PKMK • Standar WHO 2006', 15, 287)

  return new Uint8Array(doc.output('arraybuffer'))
}
