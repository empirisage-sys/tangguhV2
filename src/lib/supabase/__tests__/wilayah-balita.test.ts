/**
 * Uji untuk penentuan posyandu saat mendaftarkan balita.
 *
 * Temuan yang dikunci di sini: profil dokter dan dietisien tidak memiliki
 * `posyandu_id` (lihat `daftar/actions.ts`, yang hanya mengisinya untuk kader),
 * sehingga `wilayahUntukMenulis` selalu menolak mereka dengan pesan 'wilayah
 * kerja belum lengkap' — padahal policy RLS `boleh_akses_balita` sudah lama
 * mengizinkan mereka menulis ke seluruh posyandu di puskesmasnya.
 *
 * Yang paling penting diuji di berkas ini BUKAN jalur bahagianya, melainkan
 * bahwa penerimaan pilihan dari formulir tidak membuka jalan menulis ke wilayah
 * orang lain.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

const PUSKESMAS_A = '11111111-1111-4111-8111-111111111111'
const PUSKESMAS_B = '22222222-2222-4222-8222-222222222222'
const KABUPATEN = '33333333-3333-4333-8333-333333333333'

const POSYANDU_A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const POSYANDU_A2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const POSYANDU_B1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'

/** Isi tabel `posyandu` yang dipakai seluruh uji di berkas ini. */
const TABEL_POSYANDU = [
  { id: POSYANDU_A1, nama: 'Melati', desa: 'Dulomo', puskesmas_id: PUSKESMAS_A },
  { id: POSYANDU_A2, nama: 'Anggrek', desa: null, puskesmas_id: PUSKESMAS_A },
  { id: POSYANDU_B1, nama: 'Kenanga', desa: 'Tapa', puskesmas_id: PUSKESMAS_B },
]

/** Berapa kali database disentuh. Dipakai untuk membuktikan jalan pintas. */
let jumlahKueri = 0

/**
 * Tiruan klien Supabase yang BENAR-BENAR menerapkan filter `.eq()`, bukan
 * sekadar mengembalikan nilai yang sudah ditentukan. Tanpa ini, uji 'posyandu
 * puskesmas lain ditolak' hanya menguji tiruannya sendiri.
 */
function klienTiruan() {
  return {
    from(tabel: string) {
      jumlahKueri += 1
      let baris = tabel === 'posyandu' ? [...TABEL_POSYANDU] : []

      const rantai = {
        select: () => rantai,
        order: () => rantai,
        eq(kolom: string, nilai: unknown) {
          baris = baris.filter((b) => (b as Record<string, unknown>)[kolom] === nilai)
          return rantai
        },
        maybeSingle: async () => ({ data: baris[0] ?? null, error: null }),
        then: (
          resolve: (hasil: { data: unknown[]; error: null }) => unknown,
        ) => resolve({ data: baris, error: null }),
      }
      return rantai
    },
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => klienTiruan(),
}))

const {
  wilayahUntukMenulisBalita,
  perluMemilihPosyandu,
  TidakBerwenangError,
} = await import('@/lib/supabase/penjaga')

type Profil = Parameters<typeof perluMemilihPosyandu>[0]

function profil(ubah: Partial<Profil>): Profil {
  return {
    id: 'pengguna-1',
    namaLengkap: 'Uji',
    peran: 'dietisien',
    statusAkun: 'disetujui',
    alasanTolak: null,
    posyanduId: null,
    faskesId: PUSKESMAS_A,
    puskesmasId: PUSKESMAS_A,
    kabupatenId: KABUPATEN,
    provinsiId: null,
    jenisFaskes: 'puskesmas',
    ...ubah,
  } as Profil
}

beforeEach(() => {
  jumlahKueri = 0
})

describe('perluMemilihPosyandu', () => {
  it('kader tidak memilih karena profilnya sudah terikat satu posyandu', () => {
    expect(perluMemilihPosyandu(profil({ peran: 'kader', posyanduId: POSYANDU_A1 }))).toBe(false)
  })

  it('dietisien memilih karena profilnya tidak punya posyandu', () => {
    expect(perluMemilihPosyandu(profil({}))).toBe(true)
  })
})

describe('wilayahUntukMenulisBalita', () => {
  it('memakai posyandu dari profil bila ada', async () => {
    const w = await wilayahUntukMenulisBalita(
      profil({ peran: 'kader', posyanduId: POSYANDU_A1 }),
      null,
    )
    expect(w).toEqual({
      posyanduId: POSYANDU_A1,
      puskesmasId: PUSKESMAS_A,
      kabupatenId: KABUPATEN,
    })
  })

  it('MENGABAIKAN pilihan formulir bila profil sudah terikat posyandu', async () => {
    // Kader yang menyisipkan posyanduId milik orang lain ke dalam kiriman
    // formulir tetap menulis ke posyandunya sendiri.
    const w = await wilayahUntukMenulisBalita(
      profil({ peran: 'kader', posyanduId: POSYANDU_A1 }),
      POSYANDU_B1,
    )
    expect(w.posyanduId).toBe(POSYANDU_A1)
    expect(jumlahKueri).toBe(0)
  })

  it('menerima posyandu yang berada di puskesmas pengguna', async () => {
    const w = await wilayahUntukMenulisBalita(profil({}), POSYANDU_A2)
    expect(w).toEqual({
      posyanduId: POSYANDU_A2,
      puskesmasId: PUSKESMAS_A,
      kabupatenId: KABUPATEN,
    })
  })

  it('MENOLAK posyandu milik puskesmas lain', async () => {
    // Lubang yang ditutup: `puskesmas_id` pada baris balita diambil dari profil,
    // sehingga policy RLS tidak akan menangkap posyandu asing. Baris yang lolos
    // akan menunjuk ke dua wilayah yang berbeda sekaligus.
    await expect(wilayahUntukMenulisBalita(profil({}), POSYANDU_B1)).rejects.toThrow(
      TidakBerwenangError,
    )
    await expect(wilayahUntukMenulisBalita(profil({}), POSYANDU_B1)).rejects.toThrow(
      /tidak berada di wilayah kerja/i,
    )
  })

  it('menolak posyandu yang tidak ada sama sekali', async () => {
    const hantu = '99999999-9999-4999-8999-999999999999'
    await expect(wilayahUntukMenulisBalita(profil({}), hantu)).rejects.toThrow(
      TidakBerwenangError,
    )
  })

  it('meminta pengguna memilih bila tidak ada pilihan yang dikirim', async () => {
    await expect(wilayahUntukMenulisBalita(profil({}), null)).rejects.toThrow(
      /pilih dulu posyandu/i,
    )
    expect(jumlahKueri).toBe(0)
  })

  it('menolak masukan yang bukan uuid TANPA menyentuh database', async () => {
    for (const jahat of ['', ' ', 'bukan-uuid', "' or '1'='1", '../../etc/passwd']) {
      await expect(wilayahUntukMenulisBalita(profil({}), jahat)).rejects.toThrow(
        TidakBerwenangError,
      )
    }
    expect(jumlahKueri).toBe(0)
  })

  it('menolak bila puskesmas pada profil belum diisi', async () => {
    await expect(
      wilayahUntukMenulisBalita(profil({ puskesmasId: null }), POSYANDU_A1),
    ).rejects.toThrow(/wilayah kerja pada profil anda belum lengkap/i)
  })

  it('menolak bila kabupaten pada profil belum diisi', async () => {
    await expect(
      wilayahUntukMenulisBalita(profil({ kabupatenId: null }), POSYANDU_A1),
    ).rejects.toThrow(/wilayah kerja pada profil anda belum lengkap/i)
  })
})
