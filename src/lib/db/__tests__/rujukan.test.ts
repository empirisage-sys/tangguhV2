import { describe, expect, it } from 'vitest'
import { petakanRujukan, rujukanBerjalan } from '../rujukan'

const barisDasar = {
  id: '11111111-1111-4111-a111-111111111111',
  balita_id: '22222222-2222-4222-a222-222222222222',
  status: 'diajukan',
  tujuan: 'RSUD Contoh',
  alasan: 'BB/TB di bawah -3 SD',
  diagnosis_awal: 'Gizi buruk',
  diajukan_oleh_nama: 'dr. Puskesmas',
  puskesmas_id: '33333333-3333-4333-a333-333333333333',
  rs_tujuan_id: '44444444-4444-4444-a444-444444444444',
  created_at: '2026-11-01T02:00:00+00:00',
  diterima_pada: null,
  selesai_pada: null,
  balita: {
    nama: 'Anak Uji',
    nik: '9900000000000001',
    tanggal_lahir: '2025-02-02',
    jenis_kelamin: 'P',
    kabupaten: { nama: 'Kota Gorontalo' },
  },
  puskesmas: { nama: 'Puskesmas Uji' },
  rs: { nama: 'RSUD Uji' },
}

describe('petakanRujukan', () => {
  it('memetakan relasi dan menghitung umur bulan penuh', () => {
    const r = petakanRujukan(barisDasar, '2026-11-21')
    expect(r.namaBalita).toBe('Anak Uji')
    expect(r.jenisKelamin).toBe('P')
    expect(r.umurBulan).toBe(21)
    expect(r.namaPuskesmas).toBe('Puskesmas Uji')
    expect(r.namaKabupaten).toBe('Kota Gorontalo')
    expect(r.namaRsTujuan).toBe('RSUD Uji')
    expect(r.tanggalPengajuan).toBe('2026-11-01')
    expect(r.balitaTerbaca).toBe(true)
  })

  it('membuka akses rumah sakit tepat 90 hari sejak pengajuan', () => {
    expect(petakanRujukan(barisDasar, '2026-11-21').aksesBerakhir).toBe('2027-01-30')
    expect(petakanRujukan(barisDasar, '2027-01-29').aksesAktif).toBe(true)
    expect(petakanRujukan(barisDasar, '2027-01-30').aksesAktif).toBe(false)
  })

  it('rujukan batal tidak memberi akses', () => {
    expect(petakanRujukan({ ...barisDasar, status: 'batal' }, '2026-11-21').aksesAktif).toBe(false)
  })

  it('tetap terbaca saat relasi balita tidak dapat diakses lagi', () => {
    const r = petakanRujukan({ ...barisDasar, balita: null }, '2026-11-21')
    expect(r.balitaTerbaca).toBe(false)
    expect(r.namaBalita).toBe('Data balita tidak dapat dibaca')
    expect(r.umurBulan).toBe(0)
  })

  it('memakai nama tujuan bila relasi rumah sakit kosong', () => {
    expect(petakanRujukan({ ...barisDasar, rs: null }, '2026-11-21').namaRsTujuan).toBe('RSUD Contoh')
  })

  it('status tidak dikenal dibaca sebagai diajukan', () => {
    expect(petakanRujukan({ ...barisDasar, status: 'aneh' }, '2026-11-21').status).toBe('diajukan')
  })
})

describe('rujukanBerjalan', () => {
  it('hanya diajukan dan diterima yang berjalan', () => {
    expect(rujukanBerjalan({ status: 'diajukan' })).toBe(true)
    expect(rujukanBerjalan({ status: 'diterima' })).toBe(true)
    expect(rujukanBerjalan({ status: 'selesai' })).toBe(false)
    expect(rujukanBerjalan({ status: 'batal' })).toBe(false)
  })
})
