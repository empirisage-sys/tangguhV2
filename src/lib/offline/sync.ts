import { ambilSkriningTertunda, updateStatusOutbox } from './outbox'

export type HasilSinkronisasi = {
  total: number
  berhasil: number
  gagal: number
  rincian: Array<{
    clientUuid: string
    namaBalita: string
    sukses: boolean
    pesan?: string
  }>
}

/**
 * Mengirim seluruh data skrining di outbox ke server.
 * Mengikuti aturan Sprint 10:
 * "Galat pelanggaran keunikan client_uuid diperlakukan sebagai sukses, bukan galat."
 */
export async function jalankanSinkronisasi(): Promise<HasilSinkronisasi> {
  const tertunda = await ambilSkriningTertunda()
  const hasil: HasilSinkronisasi = {
    total: tertunda.length,
    berhasil: 0,
    gagal: 0,
    rincian: [],
  }

  if (tertunda.length === 0) return hasil

  for (const item of tertunda) {
    await updateStatusOutbox(item.clientUuid, 'sedang_kirim')
    try {
      const resp = await fetch('/api/skrining/sinkron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientUuid: item.clientUuid,
          balitaId: item.balitaId,
          masukan: item.masukan,
          posyanduId: item.posyanduId,
          puskesmasId: item.puskesmasId,
          kabupatenId: item.kabupatenId,
          hasilKlien: {
            bbu: item.hasilLokal.bbu,
            tbu: item.hasilLokal.tbu,
            bbtb: item.hasilLokal.bbtb,
            engineVersion: item.hasilLokal.engineVersion,
          },
        }),
      })

      const json = await resp.json().catch(() => ({}))

      if (resp.ok || json?.duplikat) {
        await updateStatusOutbox(item.clientUuid, 'terkirim')
        hasil.berhasil++
        hasil.rincian.push({
          clientUuid: item.clientUuid,
          namaBalita: item.namaBalita,
          sukses: true,
        })
      } else {
        await updateStatusOutbox(item.clientUuid, 'gagal', json?.message || 'Gagal mengirim')
        hasil.gagal++
        hasil.rincian.push({
          clientUuid: item.clientUuid,
          namaBalita: item.namaBalita,
          sukses: false,
          pesan: json?.message,
        })
      }
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : 'Kesalahan jaringan'
      await updateStatusOutbox(item.clientUuid, 'gagal', pesan)
      hasil.gagal++
      hasil.rincian.push({
        clientUuid: item.clientUuid,
        namaBalita: item.namaBalita,
        sukses: false,
        pesan,
      })
    }
  }

  return hasil
}
