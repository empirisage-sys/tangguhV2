'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertOctagon } from 'lucide-react'
import { ambilSkriningDitolak, hitungAntreanTertunda } from '@/lib/offline/outbox'
import { jalankanSinkronisasi } from '@/lib/offline/sync'
import type { SkriningOutboxItem } from '@/lib/offline/db'

/**
 * Penunjuk keadaan jaringan dan antrean offline.
 *
 * ==========================================================================
 * TEMUAN AUDIT S-3 dan S-4: ANTREAN YANG TIDAK TERLIHAT
 *
 * Penunjuk ini dahulu menghitung hanya baris `tertunda` dan `gagal`, sehingga
 * baris yang tertinggal pada keadaan `sedang_kirim` — karena tab ditutup saat
 * POST berjalan — tidak terkirim DAN tidak terhitung. Kader melihat "tidak ada
 * yang menunggu" untuk penimbangan yang sebenarnya belum sampai ke server.
 *
 * Sekarang `sedang_kirim` ikut dihitung oleh `hitungAntreanTertunda`, dan baris
 * yang DITOLAK PERMANEN ditampilkan tersendiri dengan alasannya. Baris ditolak
 * tidak akan terkirim sendiri; menyembunyikannya sama dengan menghilangkan
 * penimbangan tanpa jejak.
 * ==========================================================================
 */
export function IndikatorOffline() {
  const [online, setOnline] = useState<boolean>(true)
  const [tertunda, setTertunda] = useState<number>(0)
  const [ditolak, setDitolak] = useState<SkriningOutboxItem[]>([])
  const [sedangSinkron, setSedangSinkron] = useState<boolean>(false)
  const [pesanSukses, setPesanSukses] = useState<string | null>(null)

  // Penjaga dibaca dari ref, bukan dari nilai tangkapan closure. Pendengar
  // `online` dipasang sekali saat mount, sehingga versi lama selalu melihat
  // `sedangSinkron` bernilai false dan sinkronisasi otomatis dapat berjalan
  // bersamaan dengan tombol "Kirim".
  const sedangSinkronRef = useRef(false)

  const periksaStatus = useCallback(async () => {
    if (typeof window === 'undefined') return
    setOnline(navigator.onLine)
    try {
      setTertunda(await hitungAntreanTertunda())
      setDitolak(await ambilSkriningDitolak())
    } catch {
      // abaikan jika idb belum siap
    }
  }, [])

  const sinkronkan = useCallback(async () => {
    if (!navigator.onLine || sedangSinkronRef.current) return
    sedangSinkronRef.current = true
    setSedangSinkron(true)
    try {
      const hasil = await jalankanSinkronisasi()
      await periksaStatus()
      if (hasil.berhasil > 0) {
        setPesanSukses(`${hasil.berhasil} data berhasil dikirim ke server!`)
        setTimeout(() => setPesanSukses(null), 4000)
      }
    } finally {
      sedangSinkronRef.current = false
      setSedangSinkron(false)
    }
  }, [periksaStatus])

  useEffect(() => {
    void periksaStatus()

    const handleOnline = () => {
      setOnline(true)
      void sinkronkan()
    }
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    const interval = setInterval(() => void periksaStatus(), 10000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [periksaStatus, sinkronkan])

  if (online && tertunda === 0 && ditolak.length === 0 && !pesanSukses) {
    return null
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 space-y-2 md:bottom-6 md:left-auto md:right-6 md:max-w-md">
      {ditolak.length > 0 && (
        <div className="rounded-2xl bg-bahaya-bg p-3.5 text-bahaya-teks shadow-xl ring-1 ring-bahaya-garis">
          <div className="flex items-start gap-2.5">
            <AlertOctagon className="mt-0.5 size-5 shrink-0" />
            <div className="text-xs">
              <p className="font-bold">
                {ditolak.length} skrining ditolak server dan TIDAK akan dikirim ulang
              </p>
              <ul className="mt-1 space-y-1">
                {ditolak.slice(0, 3).map((d) => (
                  <li key={d.clientUuid}>
                    <span className="font-semibold">{d.namaBalita}</span>
                    {d.pesanGalat ? `: ${d.pesanGalat}` : ''}
                  </li>
                ))}
              </ul>
              {ditolak.length > 3 && (
                <p className="mt-1 font-semibold">dan {ditolak.length - 3} lainnya.</p>
              )}
              <p className="mt-1.5">
                Catat ulang penimbangan ini setelah masalahnya diperbaiki. Angkanya masih
                tersimpan di perangkat.
              </p>
            </div>
          </div>
        </div>
      )}

      {(!online || tertunda > 0 || pesanSukses) && (
        <div
          className={[
            'flex items-center justify-between gap-3 rounded-2xl p-3.5 shadow-xl transition-all',
            !online
              ? 'bg-tinta-900 text-white ring-1 ring-white/10'
              : tertunda > 0
                ? 'bg-karawo-100 text-karawo-700 ring-1 ring-karawo-400'
                : 'bg-aman-bg text-aman-teks ring-1 ring-aman-garis',
          ].join(' ')}
        >
          <div className="flex items-center gap-2.5">
            {!online ? (
              <WifiOff className="size-5 shrink-0 text-bahaya-garis" />
            ) : tertunda > 0 ? (
              <Wifi className="size-5 shrink-0 text-karawo-500" />
            ) : (
              <CheckCircle2 className="size-5 shrink-0 text-aman-garis" />
            )}

            <div className="text-xs">
              {!online ? (
                <div>
                  <p className="font-bold">Mode Offline Aktif</p>
                  <p className="text-white/80">
                    {tertunda > 0
                      ? `${tertunda} skrining tersimpan di perangkat`
                      : 'Dapat mencatat tanpa sinyal'}
                  </p>
                </div>
              ) : tertunda > 0 ? (
                <div>
                  <p className="font-bold">Data Siap Dikirim</p>
                  <p>{tertunda} skrining menunggu sinkronisasi</p>
                </div>
              ) : (
                <p className="font-semibold">{pesanSukses}</p>
              )}
            </div>
          </div>

          {online && tertunda > 0 && (
            <button
              onClick={() => void sinkronkan()}
              disabled={sedangSinkron}
              className="flex items-center gap-1.5 rounded-xl bg-karawo-500 px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={['size-3.5', sedangSinkron ? 'animate-spin' : ''].join(' ')} />
              {sedangSinkron ? 'Mengirim...' : 'Kirim'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
