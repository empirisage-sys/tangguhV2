import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { BalitaDetail } from '@/lib/db/balita-mock'
import { formatTanggal, formatZ } from '@/lib/tampilan/format'

/**
 * Menghasilkan PDF Laporan Hasil Skrining Antropometri Balita resmi TANGGUH.
 */
export async function buatPdfSkriningBalita(balita: BalitaDetail): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const skrining = balita.riwayat[balita.riwayat.length - 1]
  const tglCetak = formatTanggal(new Date().toISOString().slice(0, 10))

  // 1. Kop Resmi Laporan
  doc.setFillColor(14, 150, 161) // Laut-600
  doc.rect(0, 0, 210, 8, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(15, 43, 49) // Tinta-900
  doc.text('PEMERINTAH PROVINSI GORONTALO', 105, 18, { align: 'center' })
  doc.text('FAKULTAS KEDOKTERAN UNIV. MUHAMMADIYAH GORONTALO - FB -', 105, 24, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(74, 107, 114) // Tinta-600
  doc.text('APLIKASI TANGGUH — Deteksi Dini & Intervensi Stunting Berstandar WHO / Kemenkes RI', 105, 29, { align: 'center' })

  doc.setDrawColor(220, 233, 235) // Kabut-200
  doc.setLineWidth(0.8)
  doc.line(15, 33, 195, 33)

  // 2. Judul Dokumen
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(11, 118, 129) // Laut-700
  doc.text('LEMBAR HASIL SKRINING ANTROPOMETRI BALITA', 105, 41, { align: 'center' })

  // 3. Data Identitas Balita
  autoTable(doc, {
    startY: 46,
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
      ['Nama Balita', `: ${balita.nama}`, 'Tanggal Periksa', `: ${skrining ? formatTanggal(skrining.tanggal) : '-'}`],
      ['NIK Balita', `: ${balita.nik ?? '-'}`, 'Umur Saat Periksa', `: ${skrining ? `${skrining.umurBulan} Bulan` : '-'}`],
      ['Tanggal Lahir', `: ${formatTanggal(balita.tanggalLahir)}`, 'Posyandu / Faskes', `: ${balita.namaPosyandu}`],
      ['Jenis Kelamin', `: ${balita.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}`, 'Puskesmas', `: ${balita.namaPuskesmas}`],
      ['Nama Ibu', `: ${balita.namaIbu ?? '-'}`, 'Kabupaten / Kota', `: ${balita.namaKabupaten}`],
    ],
  })

  // 4. Tabel Hasil Pengukuran & Nilai Z-Score
  const posAkhirTabelIdentitas = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 43, 49)
  doc.text('Hasil Analisis Tiga Indikator Standar WHO', 15, posAkhirTabelIdentitas)

  autoTable(doc, {
    startY: posAkhirTabelIdentitas + 3,
    margin: { left: 15, right: 15 },
    headStyles: {
      fillColor: [14, 150, 161],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: { fontSize: 9, cellPadding: 3, textColor: [15, 43, 49] },
    head: [['Indikator', 'Hasil Ukur', 'Nilai Z-Score (SD)', 'Kategori Status Gizi (Kemenkes RI)']],
    body: [
      [
        'Berat Badan menurut Umur (BB/U)',
        `${skrining?.beratKg ?? '-'} kg`,
        formatZ(skrining?.z_bbu ?? null),
        skrining?.statusBBU?.replace(/_/g, ' ').toUpperCase() ?? '-',
      ],
      [
        'Tinggi/Panjang menurut Umur (TB/U)',
        `${skrining?.panjangCm ?? '-'} cm`,
        formatZ(skrining?.z_tbu ?? null),
        skrining?.statusTBU?.replace(/_/g, ' ').toUpperCase() ?? '-',
      ],
      [
        'Berat menurut Panjang/Tinggi (BB/TB)',
        `${skrining?.beratKg ?? '-'} kg / ${skrining?.panjangCm ?? '-'} cm`,
        formatZ(skrining?.z_bbtb ?? null),
        skrining?.statusBBTB?.replace(/_/g, ' ').toUpperCase() ?? '-',
      ],
    ],
  })

  // 5. Rekomendasi Kebutuhan Nutrisi
  const posTabel2 = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Rekomendasi Kebutuhan Nutrisi Harian', 15, posTabel2)

  autoTable(doc, {
    startY: posTabel2 + 3,
    margin: { left: 15, right: 15 },
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 43, 49] },
    headStyles: { fillColor: [237, 243, 245], textColor: [15, 43, 49], fontStyle: 'bold' },
    head: [['Kategori Kebutuhan', 'Estimasi Target Energi', 'Estimasi Kebutuhan Protein']],
    body: [
      ['Kebutuhan Pemeliharaan (Maintenance)', '800 kkal / hari', '9,6 sampai 12,0 g / hari'],
      ['Target Tumbuh Kejar (Catch-up Growth)', '1.021 kkal / hari', '15,3 sampai 20,4 g / hari'],
    ],
  })

  // 6. Disclaimer & Tanda Tangan
  const posBawah = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(122, 149, 155) // Tinta-400
  doc.text(
    'Penyangkalan Klinis: Hasil ini adalah alat bantu skrining, bukan pengganti pemeriksaan dan keputusan klinis tenaga kesehatan.',
    15,
    posBawah,
    { maxWidth: 180 },
  )

  const posTtd = posBawah + 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(15, 43, 49)

  doc.text(`Dicetak di Gorontalo: ${tglCetak}`, 135, posTtd)
  doc.text('Pemeriksa / Tenaga Kesehatan,', 135, posTtd + 5)
  doc.text('( ..................................................... )', 135, posTtd + 26)
  doc.text('NIP / STR: ', 135, posTtd + 31)

  // 7. Footer Versi Engine
  doc.setFontSize(8)
  doc.setTextColor(122, 149, 155)
  doc.text('Aplikasi TANGGUH • Engine: zscore-2.0.0 • Standar WHO 2006', 15, 287)

  return new Uint8Array(doc.output('arraybuffer'))
}
