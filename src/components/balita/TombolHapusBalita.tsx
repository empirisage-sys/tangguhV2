'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { hapusBalita } from '@/app/(aplikasi)/balita/[id]/actions'

/**
 * Tombol dan konfirmasi "Hapus Balita".
 *
 * Penghapusan bersifat lunak (data ditandai terhapus, tidak dibuang), tetapi
 * tetap menghilangkan balita dari seluruh layar dan rekap. Karena itu petugas
 * wajib mengetik ulang nama balita dan menuliskan alasannya.
 */
export function TombolHapusBalita({ balitaId, namaBalita }: { balitaId: string; namaBalita: string }) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [konfirmasiNama, setKonfirmasiNama] = useState('')
  const [alasan, setAlasan] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [sedangHapus, mulaiHapus] = useTransition()

  const namaCocok = konfirmasiNama.trim().toLowerCase() === namaBalita.trim().toLowerCase()
  const bolehKirim = namaCocok && alasan.trim().length >= 10 && !sedangHapus

  const buka = () => {
    setTerbuka(true)
    setKonfirmasiNama('')
    setAlasan('')
    setGalat(null)
  }

  const hapus = () => {
    setGalat(null)
    mulaiHapus(async () => {
      const hasil = await hapusBalita(balitaId, alasan)
      if (!hasil.ok) {
        setGalat(hasil.pesan ?? 'Balita belum dapat dihapus.')
        return
      }
      router.replace('/balita')
      router.refresh()
    })
  }

  const kelas =
    'mt-1 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-sm text-tinta-900 focus:border-bahaya-garis focus:outline-none'

  return (
    <>
      <button
        type="button"
        onClick={buka}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-bahaya-teks ring-1 ring-bahaya-garis hover:bg-bahaya-bg"
      >
        <Trash2 className="size-4" />
        Hapus Balita
      </button>

      {terbuka && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="judul-hapus-balita"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-kabut-200 pb-4">
              <div className="flex size-9 items-center justify-center rounded-xl bg-bahaya-bg text-bahaya-teks">
                <AlertTriangle className="size-5" />
              </div>
              <h3 id="judul-hapus-balita" className="font-bold text-tinta-900">Hapus data balita</h3>
            </div>
            <div className="mt-4 space-y-4 text-sm text-tinta-700">
              <p>
                <strong>{namaBalita}</strong> beserta seluruh riwayat penimbangannya akan hilang dari
                daftar, dasbor, dan rekapitulasi. Data tidak dibuang dari server; penghapusan
                tercatat atas nama Anda beserta alasannya.
              </p>
              <div>
                <label htmlFor="hapus-nama" className="block text-xs font-semibold text-tinta-700">
                  Ketik ulang nama balita untuk konfirmasi
                </label>
                <input id="hapus-nama" value={konfirmasiNama} autoComplete="off"
                  onChange={(e) => setKonfirmasiNama(e.target.value)} className={`${kelas} h-11`} />
              </div>
              <div>
                <label htmlFor="hapus-alasan" className="block text-xs font-semibold text-tinta-700">
                  Alasan penghapusan (minimal 10 karakter)
                </label>
                <textarea id="hapus-alasan" rows={3} value={alasan} maxLength={500}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Misal: data ganda, sudah terdaftar di Posyandu Melati"
                  className={`${kelas} py-2`} />
              </div>
              {galat && (
                <p role="alert" className="rounded-xl bg-bahaya-bg p-3 text-xs font-semibold text-bahaya-teks ring-1 ring-bahaya-garis">
                  {galat}
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-kabut-200 pt-4">
              <Button type="button" varian="sekunder" onClick={() => setTerbuka(false)} disabled={sedangHapus}>
                Batal
              </Button>
              <button
                type="button"
                onClick={hapus}
                disabled={!bolehKirim}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="size-4" />
                {sedangHapus ? 'Menghapus...' : 'Hapus Balita'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
