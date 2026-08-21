import { describe, expect, it } from 'vitest'
import { hitungSkrining } from '@/lib/zscore'
import {
  NAMA_INDIKATOR,
  PENYANGKALAN_KLINIS,
  tampilanBBTB,
  tampilanBBU,
  tampilanTBU,
  tampilanVelocity,
} from '@/lib/tampilan/status'
import { garisUkur, posisiPenanda, segmenUntuk, zKePersen, Z_MAKS, Z_MIN } from '@/lib/tampilan/pita'
import {
  formatBerat,
  formatTanggal,
  formatUmur,
  formatZ,
  namaBerkas,
} from '@/lib/tampilan/format'
import { periksaTerhadapBalita, skemaSkrining } from '@/lib/validasi/skrining'
import { bandingkanHasil, keBarisSkrining, posisiDariDb, posisiKeDb } from '@/lib/db/pemetaan'
import type { StatusBBTB, StatusBBU, StatusTBU, StatusVelocity } from '@/lib/zscore/tipe'

describe('pemetaan kategori ke tampilan', () => {
  it('setiap kode kategori punya label dan tidak ada yang terlewat', () => {
    const bbu: StatusBBU[] = [
      'berat_badan_sangat_kurang',
      'berat_badan_kurang',
      'berat_badan_normal',
      'risiko_berat_badan_lebih',
    ]
    const tbu: StatusTBU[] = ['sangat_pendek', 'pendek', 'normal', 'tinggi']
    const bbtb: StatusBBTB[] = [
      'gizi_buruk',
      'gizi_kurang',
      'gizi_baik',
      'risiko_gizi_lebih',
      'gizi_lebih',
      'obesitas',
    ]
    const vel: StatusVelocity[] = ['naik', 'tidak_naik', 'growth_faltering', 'tidak_dapat_dinilai']

    for (const s of bbu) expect(tampilanBBU(s).label.length).toBeGreaterThan(3)
    for (const s of tbu) expect(tampilanTBU(s).label.length).toBeGreaterThan(3)
    for (const s of bbtb) expect(tampilanBBTB(s).label.length).toBeGreaterThan(3)
    for (const s of vel) expect(tampilanVelocity(s).label.length).toBeGreaterThan(3)
  })

  it('status null ditampilkan sebagai tidak dapat dinilai, bukan sebagai normal', () => {
    // Kekeliruan yang mudah terjadi: memperlakukan null sebagai aman.
    expect(tampilanBBU(null).label).toBe('Tidak dapat dinilai')
    expect(tampilanTBU(null).nada).toBe('netral')
    expect(tampilanBBTB(null).nada).not.toBe('aman')
  })

  it('nada bahaya hanya untuk kondisi yang menuntut rujukan', () => {
    expect(tampilanBBTB('gizi_buruk').nada).toBe('bahaya')
    expect(tampilanTBU('sangat_pendek').nada).toBe('bahaya')
    expect(tampilanBBU('berat_badan_sangat_kurang').nada).toBe('bahaya')

    expect(tampilanBBTB('gizi_kurang').nada).toBe('waspada')
    expect(tampilanTBU('pendek').nada).toBe('waspada')
    expect(tampilanBBTB('gizi_baik').nada).toBe('aman')
  })

  it('setiap lencana punya ikon, sehingga tidak bergantung pada warna saja', () => {
    // Sekitar delapan persen laki-laki mengalami gangguan penglihatan warna,
    // dan layar di bawah matahari mengurangi perbedaan warna.
    for (const s of ['gizi_buruk', 'gizi_kurang', 'gizi_baik'] as StatusBBTB[]) {
      expect(tampilanBBTB(s).ikon).toBeTruthy()
      expect(tampilanBBTB(s).label).toBeTruthy()
    }
  })

  it('label memakai bahasa Indonesia tanpa istilah Inggris', () => {
    const semua = [
      tampilanBBTB('gizi_buruk').label,
      tampilanBBTB('gizi_kurang').label,
      tampilanTBU('sangat_pendek').label,
      tampilanVelocity('growth_faltering').label,
    ].join(' ')
    for (const asing of ['Wasted', 'Severely', 'Stunted', 'Underweight', 'Faltering']) {
      expect(semua).not.toContain(asing)
    }
  })

  it('kalimat penyangkalan klinis tersedia dan menyebut tenaga kesehatan', () => {
    expect(PENYANGKALAN_KLINIS).toContain('alat bantu skrining')
    expect(PENYANGKALAN_KLINIS).toContain('tenaga kesehatan')
  })

  it('nama indikator dieja lengkap untuk laporan cetak', () => {
    expect(NAMA_INDIKATOR.bbtb).toContain('panjang atau tinggi badan')
  })
})

describe('pita Z-Score', () => {
  it('memetakan nilai Z ke posisi persen secara linear', () => {
    expect(zKePersen(Z_MIN)).toBe(0)
    expect(zKePersen(0)).toBe(50)
    expect(zKePersen(Z_MAKS)).toBe(100)
    expect(zKePersen(-2)).toBeCloseTo(25, 6)
    expect(zKePersen(2)).toBeCloseTo(75, 6)
  })

  it('menjepit posisi penanda dan menandai arah bila di luar pita', () => {
    const jauh = posisiPenanda(-6)
    expect(jauh?.persen).toBe(0)
    expect(jauh?.diLuarPita).toBe(true)
    expect(jauh?.arah).toBe('kiri')

    const tinggi = posisiPenanda(7)
    expect(tinggi?.persen).toBe(100)
    expect(tinggi?.arah).toBe('kanan')

    const biasa = posisiPenanda(-2.5)
    expect(biasa?.diLuarPita).toBe(false)
    expect(biasa?.arah).toBeNull()
  })

  it('tidak menampilkan penanda bila indikator tidak dapat dinilai', () => {
    expect(posisiPenanda(null)).toBeNull()
    expect(posisiPenanda(Number.NaN)).toBeNull()
  })

  it('segmen pita menutup seluruh lebar tanpa celah dan tanpa tumpang tindih', () => {
    for (const ind of ['bbu', 'tbu', 'bbtb'] as const) {
      const segmen = segmenUntuk(ind)
      expect(segmen[0]?.dariPersen).toBe(0)
      expect(segmen[segmen.length - 1]?.sampaiPersen).toBe(100)
      for (let i = 1; i < segmen.length; i += 1) {
        expect(segmen[i]?.dariPersen).toBe(segmen[i - 1]?.sampaiPersen)
      }
    }
  })

  it('segmen BB/TB menandai gizi baik pada rentang -2 sampai +1 SD', () => {
    const aman = segmenUntuk('bbtb').find((s) => s.nada === 'aman')
    expect(aman?.dariPersen).toBeCloseTo(zKePersen(-2), 6)
    expect(aman?.sampaiPersen).toBeCloseTo(zKePersen(1), 6)
  })

  it('segmen TB/U menandai normal sampai +3 SD sesuai standar Kemenkes', () => {
    const aman = segmenUntuk('tbu').find((s) => s.nada === 'aman')
    expect(aman?.sampaiPersen).toBeCloseTo(zKePersen(3), 6)
  })

  it('garis ukur berjarak setengah SD dengan garis besar pada SD bulat', () => {
    const g = garisUkur()
    expect(g).toHaveLength(17) // -4 sampai +4 dengan langkah 0,5
    expect(g.filter((x) => x.besar)).toHaveLength(9)
  })
})

describe('pemformatan', () => {
  it('nilai Z memakai koma desimal dan tanda plus yang eksplisit', () => {
    expect(formatZ(-2.345)).toBe('-2,35')
    expect(formatZ(1.5)).toBe('+1,50')
    expect(formatZ(0)).toBe('0,00')
    expect(formatZ(null)).toBe('tidak dinilai')
  })

  it('berat dan tanggal memakai gaya Indonesia', () => {
    expect(formatBerat(8.5)).toBe('8,5 kg')
    expect(formatTanggal('2026-08-19')).toBe('19 Agustus 2026')
    expect(formatTanggal('2026-01-01')).toBe('1 Januari 2026')
  })

  it('umur ditampilkan dalam tahun dan bulan, bukan desimal', () => {
    expect(formatUmur(2, 1)).toBe('2 tahun 1 bulan')
    expect(formatUmur(0, 7)).toBe('7 bulan')
    expect(formatUmur(0, 0)).toBe('Baru lahir')
    expect(formatUmur(3, 0)).toBe('3 tahun')
  })

  it('nama berkas unduhan aman untuk semua sistem berkas', () => {
    expect(namaBerkas('skrining', 'Siti Nur Aisyah', '2026-08-19', 'pdf')).toBe(
      'skrining-siti-nur-aisyah-2026-08-19.pdf',
    )
    expect(namaBerkas('skrining', 'A/B "C"', '2026-08-19', 'pdf')).not.toMatch(/[/"\s]/)
    expect(namaBerkas('skrining', '', '2026-08-19', 'pdf')).toContain('tanpa-nama')
  })
})

describe('validasi masukan skrining', () => {
  const dasar = {
    balitaId: '11111111-1111-4111-8111-111111111111',
    clientUuid: '22222222-2222-4222-8222-222222222222',
    tanggalPeriksa: '2026-08-19',
    beratKg: 8,
    panjangCm: 78,
    posisiUkur: 'otomatis' as const,
    edema: false,
  }

  it('menerima masukan yang wajar', () => {
    const hasil = skemaSkrining.safeParse(dasar)
    expect(hasil.success).toBe(true)
  })

  it('menerima koma sebagai pemisah desimal, karena itu yang diketik kader', () => {
    const hasil = skemaSkrining.safeParse({ ...dasar, beratKg: '8,5', panjangCm: '78,3' })
    expect(hasil.success).toBe(true)
    if (hasil.success) {
      expect(hasil.data.beratKg).toBe(8.5)
      expect(hasil.data.panjangCm).toBe(78.3)
    }
  })

  it('menolak berat di luar batas dengan pesan yang menyuruh memeriksa timbangan', () => {
    const hasil = skemaSkrining.safeParse({ ...dasar, beratKg: 550 })
    expect(hasil.success).toBe(false)
    if (!hasil.success) {
      expect(hasil.error.issues[0]?.message).toContain('timbangan')
    }
  })

  it('menolak tanggal pemeriksaan di masa depan', () => {
    const besok = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    const hasil = skemaSkrining.safeParse({ ...dasar, tanggalPeriksa: besok })
    expect(hasil.success).toBe(false)
  })

  it('menolak tanggal yang tidak ada dalam kalender', () => {
    expect(skemaSkrining.safeParse({ ...dasar, tanggalPeriksa: '2026-02-30' }).success).toBe(false)
  })

  it('mewajibkan penanda pengiriman agar tidak terjadi data ganda', () => {
    const { clientUuid, ...tanpaUuid } = dasar
    void clientUuid
    expect(skemaSkrining.safeParse(tanpaUuid).success).toBe(false)
  })

  it('pesan galat memakai bahasa Indonesia tanpa istilah teknis', () => {
    const hasil = skemaSkrining.safeParse({ ...dasar, beratKg: 0.1, panjangCm: 500 })
    expect(hasil.success).toBe(false)
    if (!hasil.success) {
      const semua = hasil.error.issues.map((i) => i.message).join(' ')
      for (const asing of ['Invalid', 'expected', 'required', 'Number', 'String']) {
        expect(semua).not.toContain(asing)
      }
    }
  })

  it('memeriksa hubungan dengan tanggal lahir balita', () => {
    expect(periksaTerhadapBalita({ tanggalPeriksa: '2026-08-19' }, '2026-09-01').ok).toBe(false)
    expect(periksaTerhadapBalita({ tanggalPeriksa: '2026-08-19' }, '2018-01-01').ok).toBe(false)
    expect(periksaTerhadapBalita({ tanggalPeriksa: '2026-08-19' }, '2024-08-19').ok).toBe(true)
  })

  it('umur di atas 60 bulan ditolak dengan penjelasan cakupan standar', () => {
    const hasil = periksaTerhadapBalita({ tanggalPeriksa: '2026-08-19' }, '2021-01-01')
    expect(hasil.ok).toBe(false)
    if (!hasil.ok) expect(hasil.pesan).toContain('60 bulan')
  })
})

describe('pemetaan ke baris database', () => {
  const konteks = {
    clientUuid: '22222222-2222-4222-8222-222222222222',
    balitaId: '11111111-1111-4111-8111-111111111111',
    tanggalPeriksa: '2026-08-21',
    beratKg: 8,
    panjangCm: 78,
    posisiUkur: 'otomatis' as const,
    edema: false,
    createdBy: '33333333-3333-4333-8333-333333333333',
    posyanduId: '44444444-4444-4444-8444-444444444444',
    puskesmasId: '55555555-5555-4555-8555-555555555555',
    kabupatenId: '66666666-6666-4666-8666-666666666666',
    asalData: 'input_langsung' as const,
  }

  const hasil = hitungSkrining({
    tanggalLahir: '2024-08-19',
    tanggalPeriksa: '2026-08-21',
    jenisKelamin: 'lk',
    beratKg: 8,
    panjangCm: 78,
    posisiUkur: 'otomatis',
  })

  it('menerjemahkan posisi ukur ke nilai enum Postgres', () => {
    expect(posisiKeDb('terlentang')).toBe('recumbent')
    expect(posisiKeDb('berdiri')).toBe('standing')
    expect(posisiKeDb('otomatis')).toBe('auto')
    expect(posisiDariDb('recumbent')).toBe('terlentang')
    expect(posisiDariDb('auto')).toBe('otomatis')
  })

  it('mengisi seluruh kolom wajib', () => {
    const baris = keBarisSkrining(konteks, hasil)
    expect(baris.client_uuid).toBe(konteks.clientUuid)
    expect(baris.engine_version).toBe('zscore-2.0.0')
    expect(baris.dihitung_di).toBe('server')
    expect(baris.status_bbtb).toBe('gizi_buruk')
    expect(baris.is_red_flag).toBe(true)
    expect(baris.kalori_metode).toBe('catch_up')
    expect(baris.kalori_catchup_kkal).toBeGreaterThan(baris.kalori_target_kkal)
  })

  it('menyimpan wilayah dari profil pengguna, bukan dari formulir', () => {
    const baris = keBarisSkrining(konteks, hasil)
    expect(baris.posyandu_id).toBe(konteks.posyanduId)
    expect(baris.puskesmas_id).toBe(konteks.puskesmasId)
    expect(baris.kabupaten_id).toBe(konteks.kabupatenId)
    expect(baris.created_by).toBe(konteks.createdBy)
  })

  it('kolom pemeliharaan tetap terisi meskipun metode yang dianjurkan catch-up', () => {
    // Supaya laporan lama dan baru tetap sebanding.
    const baris = keBarisSkrining(konteks, hasil)
    expect(baris.kalori_target_kkal).toBe(800)
    expect(baris.rda_kkal_per_kg).toBe(100)
  })

  it('baris di luar rentang menyertakan keterangan, sesuai batasan check di database', () => {
    const luar = hitungSkrining({
      tanggalLahir: '2021-01-01',
      tanggalPeriksa: '2026-08-19',
      jenisKelamin: 'lk',
      beratKg: 18,
      panjangCm: 108,
      posisiUkur: 'otomatis',
    })
    const baris = keBarisSkrining({ ...konteks, tanggalPeriksa: '2026-08-19' }, luar)
    expect(baris.di_luar_rentang).toBe(true)
    expect(baris.catatan_di_luar_rentang).toBeTruthy()
    expect(baris.z_tbu).toBeNull()
  })
})

describe('perbandingan hasil klien dengan server', () => {
  const server = hitungSkrining({
    tanggalLahir: '2024-08-19',
    tanggalPeriksa: '2026-08-21',
    jenisKelamin: 'lk',
    beratKg: 8,
    panjangCm: 78,
    posisiUkur: 'otomatis',
  })

  it('hasil identik dinyatakan cocok', () => {
    expect(bandingkanHasil(server, server).cocok).toBe(true)
  })

  it('selisih kecil masih diterima', () => {
    const klien = {
      ...server,
      bbu: { ...server.bbu, z: (server.bbu.z as number) + 0.005 },
    }
    expect(bandingkanHasil(klien, server).cocok).toBe(true)
  })

  it('selisih besar dilaporkan beserta angkanya', () => {
    const klien = {
      ...server,
      bbtb: { ...server.bbtb, z: (server.bbtb.z as number) + 0.5 },
    }
    const hasil = bandingkanHasil(klien, server)
    expect(hasil.cocok).toBe(false)
    if (!hasil.cocok) expect(hasil.selisih[0]).toContain('BB/TB')
  })

  it('versi engine yang berbeda dilaporkan, karena menandakan perangkat belum diperbarui', () => {
    const klien = { ...server, engineVersion: 'zscore-1.0.0' }
    const hasil = bandingkanHasil(klien, server)
    expect(hasil.cocok).toBe(false)
    if (!hasil.cocok) expect(hasil.selisih.join(' ')).toContain('versi engine')
  })
})
