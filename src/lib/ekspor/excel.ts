import ExcelJS from 'exceljs'
import type { BalitaDetail } from '@/lib/db/balita-mock'

/**
 * Menghasilkan berkas Excel Rekapitulasi Stunting TANGGUH sesuai spesifikasi Sprint 9:
 * - Lembar 1: "Data" (satu baris per skrining)
 * - Lembar 2: "Ringkasan" (agregat per posyandu)
 * - Bekukan baris judul, atur lebar kolom, format kolom tanggal sebagai tanggal, jangan gabung sel.
 */
export async function buatExcelRekap(balitaList: BalitaDetail[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Aplikasi TANGGUH Gorontalo'
  workbook.created = new Date()

  // 1. Lembar Data (Satu baris per penimbangan)
  const sheetData = workbook.addWorksheet('Data Skrining', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  sheetData.columns = [
    { header: 'ID Balita', key: 'id', width: 14 },
    { header: 'Nama Balita', key: 'nama', width: 24 },
    { header: 'NIK', key: 'nik', width: 18 },
    { header: 'Jenis Kelamin', key: 'jk', width: 14 },
    { header: 'Tanggal Lahir', key: 'tglLahir', width: 14 },
    { header: 'Nama Ibu', key: 'namaIbu', width: 20 },
    { header: 'Posyandu', key: 'posyandu', width: 25 },
    { header: 'Puskesmas', key: 'puskesmas', width: 22 },
    { header: 'Kabupaten/Kota', key: 'kabupaten', width: 22 },
    { header: 'Tanggal Periksa', key: 'tglPeriksa', width: 14 },
    { header: 'Umur (Bulan)', key: 'umurBulan', width: 14 },
    { header: 'Berat (kg)', key: 'beratKg', width: 12 },
    { header: 'Panjang/Tinggi (cm)', key: 'panjangCm', width: 18 },
    { header: 'Z BB/U', key: 'z_bbu', width: 12 },
    { header: 'Z TB/U', key: 'z_tbu', width: 12 },
    { header: 'Z BB/TB', key: 'z_bbtb', width: 12 },
    { header: 'Status BB/U', key: 'statusBBU', width: 22 },
    { header: 'Status TB/U (Stunting)', key: 'statusTBU', width: 22 },
    { header: 'Status BB/TB (Wasting)', key: 'statusBBTB', width: 22 },
    { header: 'Red Flag', key: 'isRedFlag', width: 12 },
  ]

  // Header styling
  sheetData.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheetData.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0E96A1' }, // Laut-600
  }

  for (const b of balitaList) {
    for (const r of b.riwayat) {
      sheetData.addRow({
        id: b.id,
        nama: b.nama,
        nik: b.nik ?? '-',
        jk: b.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan',
        tglLahir: b.tanggalLahir,
        namaIbu: b.namaIbu ?? '-',
        posyandu: b.namaPosyandu,
        puskesmas: b.namaPuskesmas,
        kabupaten: b.namaKabupaten,
        tglPeriksa: r.tanggal,
        umurBulan: r.umurBulan,
        beratKg: r.beratKg,
        panjangCm: r.panjangCm,
        z_bbu: r.z_bbu ?? '-',
        z_tbu: r.z_tbu ?? '-',
        z_bbtb: r.z_bbtb ?? '-',
        statusBBU: r.statusBBU ?? '-',
        statusTBU: r.statusTBU ?? '-',
        statusBBTB: r.statusBBTB ?? '-',
        isRedFlag: r.statusBBTB === 'gizi_buruk' || r.statusTBU === 'sangat_pendek' ? 'YA' : 'TIDAK',
      })
    }
  }

  // 2. Lembar Ringkasan (Agregat per Posyandu)
  const sheetRingkasan = workbook.addWorksheet('Ringkasan Posyandu', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  sheetRingkasan.columns = [
    { header: 'Nama Posyandu', key: 'posyandu', width: 26 },
    { header: 'Puskesmas', key: 'puskesmas', width: 22 },
    { header: 'Kabupaten/Kota', key: 'kabupaten', width: 22 },
    { header: 'Total Balita', key: 'totalBalita', width: 14 },
    { header: 'Total Skrining', key: 'totalSkrining', width: 14 },
    { header: 'Stunting (Pendek/Sangat Pendek)', key: 'stunting', width: 28 },
    { header: 'Prevalensi Stunting (%)', key: 'prevStunting', width: 22 },
    { header: 'Wasting (Gizi Kurang/Buruk)', key: 'wasting', width: 26 },
    { header: 'Prevalensi Wasting (%)', key: 'prevWasting', width: 22 },
  ]

  sheetRingkasan.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheetRingkasan.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0B7681' }, // Laut-700
  }

  // Hitung agregat per posyandu
  const grupPosyandu = new Map<
    string,
    {
      posyandu: string
      puskesmas: string
      kabupaten: string
      balitaCount: number
      skriningCount: number
      stuntingCount: number
      wastingCount: number
    }
  >()

  for (const b of balitaList) {
    const key = b.posyanduId
    const item = grupPosyandu.get(key) ?? {
      posyandu: b.namaPosyandu,
      puskesmas: b.namaPuskesmas,
      kabupaten: b.namaKabupaten,
      balitaCount: 0,
      skriningCount: 0,
      stuntingCount: 0,
      wastingCount: 0,
    }

    item.balitaCount++
    item.skriningCount += b.riwayat.length

    const skriningAkhir = b.riwayat[b.riwayat.length - 1]
    if (skriningAkhir) {
      if (skriningAkhir.statusTBU === 'pendek' || skriningAkhir.statusTBU === 'sangat_pendek') {
        item.stuntingCount++
      }
      if (skriningAkhir.statusBBTB === 'gizi_kurang' || skriningAkhir.statusBBTB === 'gizi_buruk') {
        item.wastingCount++
      }
    }

    grupPosyandu.set(key, item)
  }

  for (const g of grupPosyandu.values()) {
    const pStunting = g.balitaCount > 0 ? ((g.stuntingCount / g.balitaCount) * 100).toFixed(1) : '0.0'
    const pWasting = g.balitaCount > 0 ? ((g.wastingCount / g.balitaCount) * 100).toFixed(1) : '0.0'

    sheetRingkasan.addRow({
      posyandu: g.posyandu,
      puskesmas: g.puskesmas,
      kabupaten: g.kabupaten,
      totalBalita: g.balitaCount,
      totalSkrining: g.skriningCount,
      stunting: `${g.stuntingCount} dari ${g.balitaCount} anak`,
      prevStunting: `${pStunting}%`,
      wasting: `${g.wastingCount} dari ${g.balitaCount} anak`,
      prevWasting: `${pWasting}%`,
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}
