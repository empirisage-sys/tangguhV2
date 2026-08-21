import { describe, expect, it } from 'vitest'
import {
  bolehLihatTrenZ,
  bolehMemverifikasi,
  bolehMencatatSkrining,
  bolehMenyusunAsuhanGizi,
  cakupanData,
  LABEL_TAB,
  pesanStatusAkun,
  posyanduWajib,
  strWajib,
  tabKurvaUntuk,
  type Peran,
} from '@/lib/tampilan/akses'
import { skemaPendaftaran } from '@/lib/validasi/pendaftaran'
import { cariFaskesMiripLokal } from '@/lib/db/wilayah'

const SEMUA_PERAN: Peran[] = ['kader', 'dokter', 'dietisien', 'admin']

describe('tab kurva menurut peran', () => {
  it('setiap peran melihat ketiga kurva WHO', () => {
    for (const p of SEMUA_PERAN) {
      const tab = tabKurvaUntuk(p)
      expect(tab).toContain('bbu')
      expect(tab).toContain('tbu')
      expect(tab).toContain('bbtb')
    }
  })

  it('tren nilai Z hanya untuk dokter dan admin', () => {
    expect(bolehLihatTrenZ('dokter')).toBe(true)
    expect(bolehLihatTrenZ('admin')).toBe(true)
    expect(bolehLihatTrenZ('dietisien')).toBe(false)
    expect(bolehLihatTrenZ('kader')).toBe(false)
  })

  it('kader dan dietisien melihat tepat tiga tab', () => {
    expect(tabKurvaUntuk('kader')).toHaveLength(3)
    expect(tabKurvaUntuk('dietisien')).toHaveLength(3)
    expect(tabKurvaUntuk('dokter')).toHaveLength(4)
  })

  it('setiap tab punya label', () => {
    for (const p of SEMUA_PERAN) {
      for (const t of tabKurvaUntuk(p)) {
        expect(LABEL_TAB[t]).toBeTruthy()
      }
    }
  })

  it('urutan tab menempatkan tren Z paling akhir', () => {
    const tab = tabKurvaUntuk('dokter')
    expect(tab[tab.length - 1]).toBe('trenZ')
  })
})

describe('kewenangan per peran', () => {
  it('admin tidak mencatat skrining, tetapi memverifikasi pendaftaran', () => {
    expect(bolehMencatatSkrining('admin')).toBe(false)
    expect(bolehMemverifikasi('admin')).toBe(true)
  })

  it('kader, dokter, dan dietisien mencatat skrining tetapi tidak memverifikasi', () => {
    for (const p of ['kader', 'dokter', 'dietisien'] as Peran[]) {
      expect(bolehMencatatSkrining(p)).toBe(true)
      expect(bolehMemverifikasi(p)).toBe(false)
    }
  })

  it('asuhan gizi hanya disusun dietisien', () => {
    expect(bolehMenyusunAsuhanGizi('dietisien')).toBe(true)
    for (const p of ['kader', 'dokter', 'admin'] as Peran[]) {
      expect(bolehMenyusunAsuhanGizi(p)).toBe(false)
    }
  })

  it('STR wajib untuk tenaga kesehatan, tidak untuk kader', () => {
    expect(strWajib('dokter')).toBe(true)
    expect(strWajib('dietisien')).toBe(true)
    expect(strWajib('kader')).toBe(false)
  })

  it('posyandu wajib dipilih kader, karena itu cakupan kerjanya', () => {
    expect(posyanduWajib('kader')).toBe(true)
    expect(posyanduWajib('dokter')).toBe(false)
  })
})

describe('pesan status akun', () => {
  it('akun disetujui dinyatakan aktif', () => {
    const p = pesanStatusAkun('disetujui', 'kader')
    expect(p.nada).toBe('aman')
    expect(p.tindakan).toBeNull()
  })

  it('kader yang menunggu diberi penjelasan tentang posyandu, bukan tentang STR', () => {
    // Sejak seluruh peran wajib disetujui admin, kader pun bisa menunggu.
    const p = pesanStatusAkun('menunggu', 'kader')
    expect(p.penjelasan).toContain('posyandu')
    expect(p.penjelasan).not.toContain('STR')
    expect(p.nada).toBe('waspada')
  })

  it('tenaga kesehatan yang menunggu diberi penjelasan tentang STR', () => {
    for (const p of ['dokter', 'dietisien'] as Peran[]) {
      expect(pesanStatusAkun('menunggu', p).penjelasan).toContain('STR')
    }
  })

  it('pesan menunggu menyatakan dengan jelas bahwa data belum dapat diakses', () => {
    const p = pesanStatusAkun('menunggu', 'kader')
    expect(p.penjelasan).toContain('belum dapat mencatat')
  })

  it('pesan menunggu memberi jalan keluar, bukan hanya menolak', () => {
    const p = pesanStatusAkun('menunggu', 'dokter')
    expect(p.tindakan).toContain('puskesmas')
    expect(p.tindakan).toContain('tidak perlu didaftarkan ulang')
  })

  it('penolakan menampilkan alasan dari admin bila ada', () => {
    const p = pesanStatusAkun('ditolak', 'dokter', 'Nomor STR tidak ditemukan di sistem KKI.')
    expect(p.penjelasan).toBe('Nomor STR tidak ditemukan di sistem KKI.')
    expect(p.nada).toBe('bahaya')
  })

  it('penolakan tanpa alasan tetap memberi arahan', () => {
    const p = pesanStatusAkun('ditolak', 'kader', '')
    expect(p.penjelasan).toContain('Hubungi admin')
    expect(p.tindakan).toBeTruthy()
  })

  it('seluruh pesan memakai bahasa Indonesia tanpa istilah teknis', () => {
    const semua = (['menunggu', 'disetujui', 'ditolak'] as const).flatMap((s) =>
      SEMUA_PERAN.map((p) => {
        const m = pesanStatusAkun(s, p)
        return [m.judul, m.penjelasan, m.tindakan ?? ''].join(' ')
      }),
    ).join(' ')

    for (const asing of ['pending', 'approved', 'rejected', 'unauthorized', 'error', 'null']) {
      expect(semua.toLowerCase()).not.toContain(asing)
    }
  })
})

describe('cakupan data balita per peran dan fasilitas (Keputusan D-9)', () => {
  it('kader mencakup posyandu tempat bertugas', () => {
    expect(cakupanData('kader')).toBe('posyandu')
    expect(cakupanData('kader', 'puskesmas')).toBe('posyandu')
  })

  it('dokter dan dietisien di puskesmas mencakup seluruh puskesmasnya', () => {
    expect(cakupanData('dokter', 'puskesmas')).toBe('faskes')
    expect(cakupanData('dietisien', 'puskesmas')).toBe('faskes')
  })

  it('spesialis dan nakes di rumah sakit HANYA melihat balita yang ia input sendiri (D-9)', () => {
    expect(cakupanData('dokter', 'rumah_sakit')).toBe('input_sendiri')
    expect(cakupanData('dietisien', 'rumah_sakit')).toBe('input_sendiri')
  })

  it('admin dinkes mencakup seluruh provinsi', () => {
    expect(cakupanData('admin')).toBe('provinsi')
    expect(cakupanData('admin', 'puskesmas')).toBe('provinsi')
    expect(cakupanData('admin', 'rumah_sakit')).toBe('provinsi')
  })
})

describe('skema pendaftaran wilayah & fasilitas bertingkat', () => {
  const dataDasar = {
    email: 'nakes@puskesmas.go.id',
    sandi: 'RahasiaKuat12345',
    ulangiSandi: 'RahasiaKuat12345',
    namaLengkap: 'dr. Fadel Mohammad',
    noHp: '081234567890',
    noStr: 'STR-7571-123456',
    setujuKetentuan: true as const,
  }

  it('pendaftar memilih Rumah Sakit wajib mengisi nama fasilitas manual', () => {
    const hasil = skemaPendaftaran.safeParse({
      ...dataDasar,
      peran: 'dokter',
      provinsiId: 'prov-75',
      kabupatenId: 'kab-7571',
      jenisFaskes: 'rumah_sakit',
      faskesManual: 'RSUD Prof. Dr. H. Aloei Saboe',
    })
    expect(hasil.success).toBe(true)

    const gagal = skemaPendaftaran.safeParse({
      ...dataDasar,
      peran: 'dokter',
      provinsiId: 'prov-75',
      kabupatenId: 'kab-7571',
      jenisFaskes: 'rumah_sakit',
      faskesManual: '',
    })
    expect(gagal.success).toBe(false)
  })

  it('pendaftar memilih Puskesmas di Gorontalo dapat memilih dari daftar master', () => {
    const hasil = skemaPendaftaran.safeParse({
      ...dataDasar,
      peran: 'dokter',
      provinsiId: 'prov-75',
      kabupatenId: 'kab-7571',
      jenisFaskes: 'puskesmas',
      faskesId: 'pus-7571-01',
    })
    expect(hasil.success).toBe(true)
  })

  it('pendaftar memilih Puskesmas di Gorontalo opsi Lainnya wajib mengisi nama faskes manual', () => {
    const hasil = skemaPendaftaran.safeParse({
      ...dataDasar,
      peran: 'dokter',
      provinsiId: 'prov-75',
      kabupatenId: 'kab-7571',
      jenisFaskes: 'puskesmas',
      faskesId: 'lainnya',
      faskesManual: 'Puskesmas Pembantu Baru',
    })
    expect(hasil.success).toBe(true)

    const gagal = skemaPendaftaran.safeParse({
      ...dataDasar,
      peran: 'dokter',
      provinsiId: 'prov-75',
      kabupatenId: 'kab-7571',
      jenisFaskes: 'puskesmas',
      faskesId: 'lainnya',
      faskesManual: '',
    })
    expect(gagal.success).toBe(false)
  })

  it('pendaftar memilih Puskesmas di luar Gorontalo langsung mengisi nama manual', () => {
    const hasil = skemaPendaftaran.safeParse({
      ...dataDasar,
      peran: 'dokter',
      provinsiId: 'prov-71', // Sulut
      kabupatenManual: 'Kota Manado',
      jenisFaskes: 'puskesmas',
      faskesManual: 'Puskesmas Ranotana Weru',
    })
    expect(hasil.success).toBe(true)
  })

  it('peran kader wajib mengisi posyandu manual, peran dokter tidak', () => {
    const kader = skemaPendaftaran.safeParse({
      ...dataDasar,
      peran: 'kader',
      provinsiId: 'prov-75',
      kabupatenId: 'kab-7571',
      jenisFaskes: 'puskesmas',
      faskesId: 'pus-7571-01',
      posyanduManual: 'Posyandu Mawar Dulalowo',
    })
    expect(kader.success).toBe(true)

    const kaderGagal = skemaPendaftaran.safeParse({
      ...dataDasar,
      peran: 'kader',
      provinsiId: 'prov-75',
      kabupatenId: 'kab-7571',
      jenisFaskes: 'puskesmas',
      faskesId: 'pus-7571-01',
      posyanduManual: '',
    })
    expect(kaderGagal.success).toBe(false)
  })
})

describe('pencarian kemiripan faskes usulan untuk admin verifikasi', () => {
  it('dua pendaftar mengetik PKM Marisa dan Puskesmas Marisa memunculkan saran master yang sama', () => {
    const saran1 = cariFaskesMiripLokal('PKM Marisa', 'kab-7503', 'puskesmas')
    const saran2 = cariFaskesMiripLokal('Puskesmas Marisa ', 'kab-7503', 'puskesmas')

    expect(saran1.length).toBeGreaterThan(0)
    expect(saran2.length).toBeGreaterThan(0)
    expect(saran1[0]?.nama).toBe('Puskesmas Marisa')
    expect(saran2[0]?.nama).toBe('Puskesmas Marisa')
  })
})

