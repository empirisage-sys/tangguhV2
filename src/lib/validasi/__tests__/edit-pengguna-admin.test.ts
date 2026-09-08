/**
 * Uji untuk skema edit akun oleh administrator.
 *
 * TEMUAN YANG DIKUNCI DI SINI
 *
 * Formulir edit admin dahulu hanya menyunting nama, peran, status, no HP, dan
 * no STR. Ia tidak pernah menyentuh `jenis_faskes`, `puskesmas_id`,
 * `faskes_id`, `posyandu_id`, maupun `alasan_tolak`. Sementara itu tabel
 * `profiles` memiliki lima batasan CHECK yang menuntut kolom-kolom tersebut.
 *
 * Akibatnya administrator yang mengubah peran sebuah akun menjadi
 * `dokter_spesialis_anak` menerima pesan mentah dari Postgres:
 *
 *   new row for relation "profiles" violates check constraint
 *   "chk_spesialis_anak_di_rs"
 *
 * Setiap uji di bawah ini memastikan penolakan terjadi di lapisan validasi,
 * dalam bahasa yang menyebut medan mana yang harus diisi.
 */
import { describe, expect, it } from 'vitest'
import { skemaEditPenggunaAdmin, RS_BARU } from '@/lib/validasi/pendaftaran'

const PUSKESMAS = '11111111-1111-4111-8111-111111111111'
const POSYANDU = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const RUMAH_SAKIT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

/** Masukan lengkap yang sah untuk seorang dokter umum di puskesmas. */
const DASAR = {
  penggunaId: 'pengguna-1',
  namaLengkap: 'dr. Uji Coba',
  role: 'dokter' as const,
  statusAkun: 'disetujui' as const,
  noHp: '081234567890',
  noStr: '1234567',
  jenisFaskes: 'puskesmas' as const,
  puskesmasId: PUSKESMAS,
  rumahSakitId: '',
  namaRsBaru: '',
  posyanduId: '',
  alasanTolak: '',
}

function periksa(ubah: Record<string, unknown>) {
  return skemaEditPenggunaAdmin.safeParse({ ...DASAR, ...ubah })
}

/** Mengumpulkan medan mana saja yang ditolak. */
function medanBermasalah(hasil: ReturnType<typeof periksa>): string[] {
  if (hasil.success) return []
  return hasil.error.issues.map((i) => String(i.path[0] ?? 'umum'))
}

describe('jalur yang sah', () => {
  it('menerima dokter umum di puskesmas', () => {
    expect(periksa({}).success).toBe(true)
  })

  it('menerima kader dengan puskesmas dan posyandu', () => {
    const h = periksa({
      role: 'kader',
      noStr: '',
      posyanduId: POSYANDU,
    })
    expect(h.success).toBe(true)
  })

  it('menerima spesialis anak di rumah sakit yang sudah ada', () => {
    const h = periksa({
      role: 'dokter_spesialis_anak',
      jenisFaskes: 'rumah_sakit',
      rumahSakitId: RUMAH_SAKIT,
      puskesmasId: '',
    })
    expect(h.success).toBe(true)
  })

  it('menerima spesialis anak dengan nama rumah sakit yang diketik', () => {
    const h = periksa({
      role: 'dokter_spesialis_anak',
      jenisFaskes: 'rumah_sakit',
      rumahSakitId: RS_BARU,
      namaRsBaru: 'RSUD Prof. Dr. H. Aloei Saboe',
      puskesmasId: '',
    })
    expect(h.success).toBe(true)
  })

  it('menerima administrator TANPA wilayah sama sekali', () => {
    // Permintaan langsung: administrator tidak bertugas di puskesmas mana pun.
    const h = periksa({
      role: 'admin',
      noStr: '',
      jenisFaskes: '',
      puskesmasId: '',
      posyanduId: '',
    })
    expect(h.success).toBe(true)
  })
})

describe('chk_spesialis_anak_di_rs', () => {
  it('menolak spesialis anak yang jenis fasilitasnya puskesmas', () => {
    // Inilah galat yang dialami administrator di produksi.
    const h = periksa({ role: 'dokter_spesialis_anak', jenisFaskes: 'puskesmas' })
    expect(h.success).toBe(false)
    expect(medanBermasalah(h)).toContain('jenisFaskes')
  })

  it('menolak spesialis anak tanpa jenis fasilitas', () => {
    const h = periksa({
      role: 'dokter_spesialis_anak',
      jenisFaskes: '',
      puskesmasId: '',
    })
    expect(h.success).toBe(false)
    expect(medanBermasalah(h)).toContain('jenisFaskes')
  })

  it('pesannya menyebut medan yang harus diubah, bukan nama batasan', () => {
    const h = periksa({ role: 'dokter_spesialis_anak', jenisFaskes: 'puskesmas' })
    if (h.success) throw new Error('seharusnya ditolak')
    const pesan = h.error.issues.map((i) => i.message).join(' ')
    expect(pesan).toMatch(/jenis fasilitas/i)
    expect(pesan).not.toMatch(/chk_|constraint|violates/i)
  })
})

describe('chk_spesialis_anak_wajib_faskes', () => {
  it('menolak jenis rumah sakit tanpa memilih rumah sakit', () => {
    const h = periksa({
      role: 'dokter_spesialis_anak',
      jenisFaskes: 'rumah_sakit',
      rumahSakitId: '',
      puskesmasId: '',
    })
    expect(h.success).toBe(false)
    expect(medanBermasalah(h)).toContain('rumahSakitId')
  })

  it('menolak pilihan "ketik nama" dengan nama yang terlalu pendek', () => {
    const h = periksa({
      role: 'dokter_spesialis_anak',
      jenisFaskes: 'rumah_sakit',
      rumahSakitId: RS_BARU,
      namaRsBaru: 'RS',
      puskesmasId: '',
    })
    expect(h.success).toBe(false)
    expect(medanBermasalah(h)).toContain('namaRsBaru')
  })

  it('menolak id rumah sakit yang bukan uuid', () => {
    const h = periksa({
      role: 'dokter_spesialis_anak',
      jenisFaskes: 'rumah_sakit',
      rumahSakitId: 'bukan-uuid',
      puskesmasId: '',
    })
    expect(h.success).toBe(false)
    expect(medanBermasalah(h)).toContain('rumahSakitId')
  })
})

describe('chk_nakes_wajib_puskesmas', () => {
  it('menolak dokter umum tanpa puskesmas', () => {
    const h = periksa({ puskesmasId: '' })
    expect(h.success).toBe(false)
    expect(medanBermasalah(h)).toContain('puskesmasId')
  })

  it('menolak dietisien yang jenis fasilitasnya rumah sakit', () => {
    // Cakupan dietisien adalah `p_puskesmas_id = my_puskesmas_id()`, sehingga
    // dietisien berbasis rumah sakit tidak dapat dinilai cakupannya.
    const h = periksa({
      role: 'dietisien',
      jenisFaskes: 'rumah_sakit',
      rumahSakitId: RUMAH_SAKIT,
      puskesmasId: '',
    })
    expect(h.success).toBe(false)
    expect(medanBermasalah(h)).toContain('jenisFaskes')
  })

  it('spesialis anak TIDAK dituntut berpuskesmas', () => {
    // Dikecualikan sejak migrasi 20260909000000: induknya rumah sakit, dan
    // cakupannya dinilai spesialis_anak_boleh_lihat.
    const h = periksa({
      role: 'dokter_spesialis_anak',
      jenisFaskes: 'rumah_sakit',
      rumahSakitId: RUMAH_SAKIT,
      puskesmasId: '',
    })
    expect(h.success).toBe(true)
  })
})

describe('chk_kader_wajib_posyandu', () => {
  it('menolak kader tanpa posyandu', () => {
    const h = periksa({ role: 'kader', noStr: '', posyanduId: '' })
    expect(h.success).toBe(false)
    expect(medanBermasalah(h)).toContain('posyanduId')
  })

  it('menolak kader tanpa puskesmas', () => {
    const h = periksa({
      role: 'kader',
      noStr: '',
      puskesmasId: '',
      posyanduId: POSYANDU,
    })
    expect(h.success).toBe(false)
    expect(medanBermasalah(h)).toContain('puskesmasId')
  })

  it('menolak posyandu yang bukan uuid', () => {
    const h = periksa({ role: 'kader', noStr: '', posyanduId: 'sembarang' })
    expect(h.success).toBe(false)
    expect(medanBermasalah(h)).toContain('posyanduId')
  })
})

describe('chk_str_nakes', () => {
  it.each(['dokter', 'dietisien', 'dokter_spesialis_anak'])(
    'menolak %s tanpa nomor STR',
    (peran) => {
      const tambahan =
        peran === 'dokter_spesialis_anak'
          ? { jenisFaskes: 'rumah_sakit', rumahSakitId: RUMAH_SAKIT, puskesmasId: '' }
          : {}
      const h = periksa({ role: peran, noStr: '', ...tambahan })
      expect(h.success).toBe(false)
      expect(medanBermasalah(h)).toContain('noStr')
    },
  )

  it('menolak nomor STR yang kurang dari 5 karakter', () => {
    const h = periksa({ noStr: '1234' })
    expect(h.success).toBe(false)
    expect(medanBermasalah(h)).toContain('noStr')
  })

  it('kader dan admin tidak dituntut nomor STR', () => {
    expect(periksa({ role: 'kader', noStr: '', posyanduId: POSYANDU }).success).toBe(true)
    expect(
      periksa({ role: 'admin', noStr: '', jenisFaskes: '', puskesmasId: '' }).success,
    ).toBe(true)
  })
})

describe('chk_tolak_wajib_beralasan', () => {
  it('menolak status ditolak tanpa alasan', () => {
    const h = periksa({ statusAkun: 'ditolak', alasanTolak: '' })
    expect(h.success).toBe(false)
    expect(medanBermasalah(h)).toContain('alasanTolak')
  })

  it('menolak alasan yang kurang dari 10 karakter', () => {
    const h = periksa({ statusAkun: 'ditolak', alasanTolak: 'STR palsu' })
    expect(h.success).toBe(false)
    expect(medanBermasalah(h)).toContain('alasanTolak')
  })

  it('menerima alasan yang cukup panjang', () => {
    const h = periksa({
      statusAkun: 'ditolak',
      alasanTolak: 'Nomor STR tidak ditemukan pada pangkalan data KKI.',
    })
    expect(h.success).toBe(true)
  })
})

describe('ketahanan masukan', () => {
  it('menolak uuid wilayah yang dipalsukan', () => {
    for (const jahat of ["' or '1'='1", '../../etc/passwd', '00000000', 'null']) {
      expect(periksa({ puskesmasId: jahat }).success).toBe(false)
    }
  })

  it('menolak peran di luar daftar', () => {
    expect(periksa({ role: 'superadmin' }).success).toBe(false)
  })

  it('menolak status akun di luar daftar', () => {
    expect(periksa({ statusAkun: 'dibekukan' }).success).toBe(false)
  })

  it('menolak nama lengkap yang terlalu pendek', () => {
    expect(periksa({ namaLengkap: 'ab' }).success).toBe(false)
  })
})
