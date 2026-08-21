'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'
import { hitungAntreanTertunda } from '@/lib/offline/outbox'
import { jalankanSinkronisasi } from '@/lib/offline/sync'

export function IndikatorOffline() {
  const [online, setOnline] = useState<boolean>(true)
  const [tertunda, setTertunda] = useState<number>(0)
  const [sedangSinkron, setSedangSinkron] = useState<boolean>(false)
  const [pesanSukses, setPesanSukses] = useState<string | null>(null)

  const periksaStatus = async () => {
    if (typeof window !== 'undefined') {
      setOnline(navigator.onLine)
      try {
        const jml = await hitungAntreanTertunda()
        setTertunda(jml)
      } catch {
        // abaikan jika idb belum siap
      }
    }
  }

  useEffect(() => {
    periksaStatus()

    const handleOnline = () => {
      setOnline(true)
      // Auto sync saat kembali online
      sinkronkan()
    }
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    const interval = setInterval(periksaStatus, 10000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  const sinkronkan = async () => {
    if (!navigator.onLine || sedangSinkron) return
    setSedangSinkron(true)
    try {
      const hasil = await jalankanSinkronisasi()
      await periksaStatus()
      if (hasil.berhasil > 0) {
        setPesanSukses(`${hasil.berhasil} data berhasil dikirim ke server!`)
        setTimeout(() => setPesanSukses(null), 4000)
      }
    } finally {
      setSedangSinkron(false)
    }
  }

  if (online && tertunda === 0 && !pesanSukses) {
    return null
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 md:bottom-6 md:left-auto md:right-6 md:max-w-md">
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
                  {tertunda > 0 ? `${tertunda} skrining tersimpan di perangkat` : 'Dapat mencatat tanpa sinyal'}
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
            onClick={sinkronkan}
            disabled={sedangSinkron}
            className="flex items-center gap-1.5 rounded-xl bg-karawo-500 px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={['size-3.5', sedangSinkron ? 'animate-spin' : ''].join(' ')} />
            {sedangSinkron ? 'Mengirim...' : 'Kirim'}
          </button>
        )}
      </div>
    </div>
  )
}
