/**
 * Uji pengunci temuan audit jalur sinkronisasi offline (S-1 sampai S-6).
 *
 * Antrean sesungguhnya hidup di IndexedDB, yang tidak ada di lingkungan uji.
 * Karena itu modul `outbox` digantikan tiruan yang menyimpan keadaan di memori:
 * yang diuji adalah KEPUTUSAN `jalankanSinkronisasi`, bukan IndexedDB-nya.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StatusSinkron, SkriningOutboxItem } from '@/lib/offline/db'

// --- Tiruan antrean -------------------------------------------------------
const antrean = new Map<string, SkriningOutboxItem>()
const PERLU_DIKIRIM: StatusSinkron[] = ['tertunda', 'gagal', 'sedang_kirim']

vi.mock('@/lib/offline/outbox', () => ({
  BATAS_PERCOBAAN: 5,
  ambilSkriningTertunda: async () =>
    [...antrean.values()].filter((s) => PERLU_DIKIRIM.includes(s.statusSinkron)),
  updateStatusOutbox: async (
    uuid: string,
    status: StatusSinkron,
    pesan?: string,
    hitungPercobaan = true,
  ) => {
    const item = antrean.get(uuid)
    if (!item) return
    item.statusSinkron = status
    if (pesan !== undefined) item.pesanGalat = pesan
    if (hitungPercobaan && (status === 'gagal' || status === 'ditolak')) {
      item.percobaan = (item.percobaan ?? 0) + 1
    }
  },
}))

const { jalankanSinkronisasi } = await import('@/lib/offline/sync')

function taruh(uuid: string, percobaan = 0): void {
  antrean.set(uuid, {
    clientUuid: uuid,
    balitaId: 'b-1',
    namaBalita: 'Balita Uji',
    posyanduId: 'p-1',
    puskesmasId: 'pk-1',
    kabupatenId: 'kb-1',
    dibuatPada: '2026-09-09T00:00:00.000Z',
    statusSinkron: 'tertunda',
    percobaan,
    masukan: {} as never,
    hasilLokal: { bbu: {}, tbu: {}, bbtb: {}, engineVersion: 'zscore-2.2.0' } as never,
  })
}

function balasan(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch
}

beforeEach(() => {
  antrean.clear()
  vi.restoreAllMocks()
})

describe('S-2 duplikat tanggal tidak boleh dilaporkan sebagai berhasil', () => {
  it('409 penimbangan ganda ditandai ditolak, bukan terkirim', async () => {
    taruh('u-1')
    globalThis.fetch = balasan(409, {
      error: 'Sudah ada penimbangan lain untuk balita ini pada tanggal tersebut.',
      kendala: 'skrining_harian_ganda',
    })

    const hasil = await jalankanSinkronisasi()

    // Inti temuan S-2: dahulu ini bernilai berhasil = 1 dan barisnya hilang.
    expect(hasil.berhasil).toBe(0)
    expect(hasil.ditolak).toBe(1)
    expect(antrean.get('u-1')?.statusSinkron).toBe('ditolak')
    expect(antrean.get('u-1')?.pesanGalat).toContain('penimbangan lain')
  })

  it('duplikat client_uuid pada jawaban ok tetap dianggap berhasil', async () => {
    taruh('u-2')
    globalThis.fetch = balasan(200, { success: true, duplikat: true })

    const hasil = await jalankanSinkronisasi()

    expect(hasil.berhasil).toBe(1)
    expect(antrean.get('u-2')?.statusSinkron).toBe('terkirim')
  })

  it('penanda duplikat pada jawaban GAGAL tidak lagi diterima', async () => {
    taruh('u-3')
    globalThis.fetch = balasan(500, { duplikat: true, error: 'galat lain' })

    const hasil = await jalankanSinkronisasi()

    expect(hasil.berhasil).toBe(0)
    expect(antrean.get('u-3')?.statusSinkron).not.toBe('terkirim')
  })
})

describe('S-4 pesan server sampai ke kader, dan putaran tanpa ujung berhenti', () => {
  it('alasan penolakan 400 dibacakan, bukan "Gagal mengirim"', async () => {
    taruh('u-4')
    globalThis.fetch = balasan(400, { error: 'Validasi gagal', issues: {} })

    const hasil = await jalankanSinkronisasi()

    expect(hasil.rincian[0]?.pesan).toContain('Validasi gagal')
    expect(hasil.rincian[0]?.pesan).not.toBe('Gagal mengirim')
    expect(hasil.rincian[0]?.terminal).toBe(true)
    expect(antrean.get('u-4')?.statusSinkron).toBe('ditolak')
  })

  it('400 tidak dicoba lagi pada sinkronisasi berikutnya', async () => {
    taruh('u-5')
    const f = balasan(400, { error: 'Catatan maksimal 500 karakter' })
    globalThis.fetch = f

    await jalankanSinkronisasi()
    const kedua = await jalankanSinkronisasi()

    expect(kedua.total).toBe(0)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('galat server 500 dicoba lagi, tetapi berhenti setelah batas percobaan', async () => {
    taruh('u-6', 4) // sudah 4 kali gagal
    globalThis.fetch = balasan(500, { error: 'kolom tidak dikenal' })

    const hasil = await jalankanSinkronisasi()

    expect(hasil.ditolak).toBe(1)
    expect(antrean.get('u-6')?.pesanGalat).toContain('5 kali gagal')
  })

  it('kegagalan JARINGAN tidak menghabiskan kuota percobaan', async () => {
    taruh('u-7', 4)
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Failed to fetch')
    }) as unknown as typeof fetch

    const hasil = await jalankanSinkronisasi()

    // Offline adalah keadaan normal di posyandu, bukan data yang salah.
    expect(hasil.gagal).toBe(1)
    expect(hasil.ditolak).toBe(0)
    expect(antrean.get('u-7')?.statusSinkron).toBe('gagal')
    expect(antrean.get('u-7')?.percobaan).toBe(4)
  })
})

describe('S-3 baris yang tertinggal pada sedang_kirim diambil kembali', () => {
  it('sedang_kirim ikut dikirim ulang, tidak ditinggalkan', async () => {
    taruh('u-8')
    antrean.get('u-8')!.statusSinkron = 'sedang_kirim'
    globalThis.fetch = balasan(200, { success: true })

    const hasil = await jalankanSinkronisasi()

    expect(hasil.total).toBe(1)
    expect(hasil.berhasil).toBe(1)
  })
})

// =========================================================================
// S-5 dan S-6: pemetaan baris database
// =========================================================================
const { hitungSkrining } = await import('@/lib/zscore')
const { keBarisSkrining, bandingkanHasil, statusLilaDb } = await import('@/lib/db/pemetaan')

const konteks = {
  clientUuid: '11111111-1111-4111-8111-111111111111',
  balitaId: 'b-1',
  tanggalPeriksa: '2026-09-09',
  posisiUkur: 'otomatis' as const,
  edema: false,
  createdBy: 'u-1',
  posyanduId: 'p-1',
  puskesmasId: 'pk-1',
  kabupatenId: 'kb-1',
  asalData: 'input_langsung' as const,
}

function skriningLila(lilaCm?: number) {
  const hasil = hitungSkrining({
    tanggalLahir: '2025-09-09',
    tanggalPeriksa: '2026-09-09',
    jenisKelamin: 'lk',
    beratKg: 7.0,
    panjangCm: 72,
    posisiUkur: 'otomatis',
    lilaCm,
  })
  return { hasil, baris: keBarisSkrining({ ...konteks, beratKg: 7.0, panjangCm: 72, lilaCm }, hasil) }
}

describe('S-5 status_lila akhirnya tertulis', () => {
  it('LILA 11,0 cm tersimpan sebagai gizi_buruk, bukan tidak_diukur', () => {
    const { hasil, baris } = skriningLila(11.0)
    expect(hasil.kodeRedFlag).toContain('lila_gizi_buruk_akut')
    // Dahulu kolom ini tidak ada di baris sama sekali, sehingga Postgres
    // menyimpan bawaannya dan rekap menghitung nol.
    expect(baris.status_lila).toBe('gizi_buruk')
  })

  it('LILA 12,0 cm tersimpan sebagai gizi_kurang', () => {
    expect(skriningLila(12.0).baris.status_lila).toBe('gizi_kurang')
  })

  it('LILA 14,0 cm tersimpan sebagai normal', () => {
    expect(skriningLila(14.0).baris.status_lila).toBe('normal')
  })

  it('LILA tidak diisi tetap tidak_diukur', () => {
    expect(skriningLila(undefined).baris.status_lila).toBe('tidak_diukur')
  })

  it('di luar umur 6-59 bulan, LILA tidak dinilai mesin sehingga tidak_diukur', () => {
    const hasil = hitungSkrining({
      tanggalLahir: '2026-07-09', // sekitar 2 bulan
      tanggalPeriksa: '2026-09-09',
      jenisKelamin: 'lk',
      beratKg: 5.0,
      panjangCm: 58,
      posisiUkur: 'otomatis',
      lilaCm: 10.0,
    })
    expect(statusLilaDb(hasil, 10.0)).toBe('tidak_diukur')
  })

  it("nilai 'risiko' tidak pernah dipakai selama ambangnya belum ditetapkan", () => {
    const semua = [9, 11, 11.5, 12, 12.5, 13, 14, 16].map(
      (l) => skriningLila(l).baris.status_lila,
    )
    expect(semua).not.toContain('risiko')
  })

  it('jejak koreksi prematuritas ikut tertulis', () => {
    const { baris } = skriningLila(14.0)
    expect(baris.umur_dikoreksi_prematur).toBe(false)
    expect(baris.umur_kronologis_hari).toBeGreaterThan(0)
    expect(baris.defisit_prematur_hari).toBe(0)
    expect(baris.usia_gestasi_minggu).toBeNull()
  })
})

describe('S-6 perbandingan klien vs server melihat perubahan klasifikasi', () => {
  const server = hitungSkrining({
    tanggalLahir: '2024-09-09',
    tanggalPeriksa: '2026-09-09',
    jenisKelamin: 'lk',
    beratKg: 9.5,
    panjangCm: 84,
    posisiUkur: 'otomatis',
  })

  it('selisih Z tepat pada toleransi tetapi status berbeda kini tertangkap', () => {
    const klien = {
      bbu: server.bbu,
      tbu: server.tbu,
      bbtb: { z: (server.bbtb.z as number) + 0.01, keterangan: '' },
      engineVersion: server.engineVersion,
      statusBBU: server.statusBBU,
      statusTBU: server.statusTBU,
      // Status yang BERBEDA, meski selisih Z masih di dalam toleransi.
      statusBBTB: 'gizi_baik' as const,
      isRedFlag: server.isRedFlag,
    }

    const hasil = bandingkanHasil(klien, server)
    expect(hasil.cocok).toBe(false)
    if (!hasil.cocok) {
      expect(hasil.selisih.join(' ')).toContain('status BB/TB')
    }
  })

  it('penanda rujukan yang berbeda tertangkap', () => {
    const klien = {
      bbu: server.bbu,
      tbu: server.tbu,
      bbtb: server.bbtb,
      engineVersion: server.engineVersion,
      statusBBU: server.statusBBU,
      statusTBU: server.statusTBU,
      statusBBTB: server.statusBBTB,
      isRedFlag: !server.isRedFlag,
    }

    const hasil = bandingkanHasil(klien, server)
    expect(hasil.cocok).toBe(false)
    if (!hasil.cocok) expect(hasil.selisih.join(' ')).toContain('penanda rujukan')
  })

  it('perangkat versi lama yang tidak mengirim status tetap diterima', () => {
    const hasil = bandingkanHasil(
      {
        bbu: server.bbu,
        tbu: server.tbu,
        bbtb: server.bbtb,
        engineVersion: server.engineVersion,
      },
      server,
    )
    expect(hasil.cocok).toBe(true)
  })
})
