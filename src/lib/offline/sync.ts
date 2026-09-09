import { ambilSkriningTertunda, updateStatusOutbox, BATAS_PERCOBAAN } from './outbox'

export type HasilSinkronisasi = {
  total: number
  berhasil: number
  gagal: number
  /** Baris yang ditolak permanen dan tidak akan dicoba lagi. */
  ditolak: number
  rincian: Array<{
    clientUuid: string
    namaBalita: string
    sukses: boolean
    /** `true` bila baris ini tidak akan pernah terkirim tanpa campur tangan kader. */
    terminal?: boolean
    pesan?: string
  }>
}

/**
 * Mengirim seluruh data skrining di outbox ke server.
 *
 * ==========================================================================
 * TIGA TEMUAN AUDIT YANG DIPERBAIKI DI BERKAS INI
 *
 * S-2  Setiap galat 23505 dahulu dilaporkan ke perangkat sebagai "sudah
 *      tersinkron". Padahal DUA kendala unik dapat memicu 23505: `client_uuid`
 *      (idempotensi yang memang kita inginkan) dan `uq_skrining_harian`
 *      (balita_id + tanggal_periksa). Bila kader mencatat penimbangan kedua
 *      pada hari yang sama karena timbangan salah baca, baris koreksi itu
 *      ditolak database, lalu ditandai `terkirim` dan dihapus dari antrean
 *      sambil layar berkata "1 data berhasil dikirim". Pengukuran koreksinya
 *      musnah. Sekarang server yang membedakan keduanya, dan hanya duplikat
 *      `client_uuid` yang dianggap sukses.
 *
 * S-4a Pesan galat server tidak pernah sampai. Route mengembalikan `error`,
 *      berkas ini membaca `message`, sehingga `pesanGalat` selalu tepat
 *      berbunyi "Gagal mengirim" dan `rincian[].pesan` selalu undefined.
 *
 * S-4b Baris yang ditolak permanen dikirim ulang tanpa ujung. Jalur offline
 *      tidak memvalidasi apa pun sebelum menyimpan, sehingga catatan 600
 *      karakter atau berat 45 kg masuk antrean lalu ditolak `skemaSkrining`
 *      pada setiap percobaan, selamanya.
 * ==========================================================================
 */
export async function jalankanSinkronisasi(): Promise<HasilSinkronisasi> {
  const tertunda = await ambilSkriningTertunda()
  const hasil: HasilSinkronisasi = {
    total: tertunda.length,
    berhasil: 0,
    gagal: 0,
    ditolak: 0,
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
            statusBBU: item.hasilLokal.statusBBU,
            statusTBU: item.hasilLokal.statusTBU,
            statusBBTB: item.hasilLokal.statusBBTB,
            isRedFlag: item.hasilLokal.isRedFlag,
            engineVersion: item.hasilLokal.engineVersion,
          },
        }),
      })

      const json = await resp.json().catch(() => ({}))

      // `duplikat` hanya sah pada jawaban ok. Bentuk lama menerimanya pada
      // jawaban gagal juga, memperlebar cacat S-2.
      if (resp.ok && json?.duplikat === true) {
        await updateStatusOutbox(item.clientUuid, 'terkirim')
        hasil.berhasil++
        hasil.rincian.push({
          clientUuid: item.clientUuid,
          namaBalita: item.namaBalita,
          sukses: true,
          pesan: 'Sudah ada di server, tidak dikirim ulang.',
        })
        continue
      }

      if (resp.ok) {
        await updateStatusOutbox(item.clientUuid, 'terkirim')
        hasil.berhasil++
        hasil.rincian.push({
          clientUuid: item.clientUuid,
          namaBalita: item.namaBalita,
          sukses: true,
        })
        continue
      }

      const pesanServer =
        (typeof json?.error === 'string' && json.error) ||
        (typeof json?.message === 'string' && json.message) ||
        `Server menolak dengan kode ${resp.status}.`

      // 400 dan 409 adalah penolakan yang TIDAK akan berubah bila dicoba lagi:
      // data tidak lolos validasi, atau sudah ada penimbangan lain pada tanggal
      // yang sama. Mengulangnya hanya menyembunyikan masalahnya dari kader.
      const terminal = resp.status === 400 || resp.status === 409 || resp.status === 404
      const percobaanKe = (item.percobaan ?? 0) + 1
      const habisPercobaan = percobaanKe >= BATAS_PERCOBAAN

      if (terminal || habisPercobaan) {
        const pesan = terminal
          ? `${pesanServer} Data ini tidak akan dikirim ulang — perbaiki atau catat ulang penimbangannya.`
          : `${pesanServer} Sudah ${percobaanKe} kali gagal, pengiriman otomatis dihentikan.`
        await updateStatusOutbox(item.clientUuid, 'ditolak', pesan)
        hasil.ditolak++
        hasil.rincian.push({
          clientUuid: item.clientUuid,
          namaBalita: item.namaBalita,
          sukses: false,
          terminal: true,
          pesan,
        })
        continue
      }

      await updateStatusOutbox(item.clientUuid, 'gagal', pesanServer)
      hasil.gagal++
      hasil.rincian.push({
        clientUuid: item.clientUuid,
        namaBalita: item.namaBalita,
        sukses: false,
        pesan: pesanServer,
      })
    } catch (err: unknown) {
      // Kegagalan jaringan. Ini justru keadaan yang WAJIB dicoba lagi, jadi
      // tidak pernah dihitung sebagai penolakan permanen.
      const pesan = err instanceof Error ? err.message : 'Kesalahan jaringan'
      await updateStatusOutbox(item.clientUuid, 'gagal', pesan, false)
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
