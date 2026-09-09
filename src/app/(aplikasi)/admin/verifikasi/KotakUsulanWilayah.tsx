'use client'

import { useEffect, useState, useTransition } from 'react'
import { Link2, PlusCircle, Loader2 } from 'lucide-react'
import {
  sahkanUsulanWilayahAction,
  calonMasterWilayah,
  type CalonMaster,
  type JenisWilayahUsulan,
} from './actions'

/**
 * Kotak normalisasi satu wilayah usulan.
 *
 * TEMUAN R-8, DAN MENGAPA KOMPONEN INI ADA
 *
 * `FormulirVerifikasi` sudah lama memuat kotak normalisasi untuk fasilitas,
 * lengkap dengan pencarian master yang mirip dan tombol penautan. Kotak itu
 * TIDAK PERNAH MUNCUL, karena `v_antrean_verifikasi` tidak memuat kolom
 * `status_faskes` — sehingga nilainya selalu jatuh ke bawaan 'master'.
 * Migrasi 20260911000000 menambahkan kolom itu.
 *
 * Sekaligus ada dua jenis usulan baru yang belum tertangani sama sekali:
 * puskesmas dan posyandu. Keduanya lahir sejak migrasi 20260910000000, ketika
 * nama yang diketik pendaftar mulai benar-benar dipakai. Karena perlakuannya
 * identik, kotaknya dijadikan satu komponen alih-alih tiga salinan.
 *
 * Calon master diambil dari DATABASE lewat `calon_master_wilayah`, bukan dari
 * senarai statis di `src/lib/db/wilayah.ts`. Senarai itu tidak mengenal
 * posyandu sama sekali, dan tidak mengenal puskesmas yang lahir setelah seed.
 */
export function KotakUsulanWilayah({
  jenis,
  usulanId,
  nama,
  keterangan,
  onSelesai,
}: {
  jenis: JenisWilayahUsulan
  usulanId: string
  nama: string
  /** Keterangan tambahan, misalnya nama desa posyandu. */
  keterangan?: string
  /** Dipanggil setelah normalisasi berhasil, dengan nama barunya. */
  onSelesai: (namaBaru: string) => void
}) {
  const [calon, setCalon] = useState<CalonMaster[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [sedangProses, mulai] = useTransition()

  const SEBUTAN: Record<JenisWilayahUsulan, string> = {
    faskes: 'Rumah Sakit',
    puskesmas: 'Puskesmas',
    posyandu: 'Posyandu',
  }

  const CAKUPAN: Record<JenisWilayahUsulan, string> = {
    faskes: 'rumah sakit master di kabupaten yang sama',
    puskesmas: 'puskesmas master di kabupaten yang sama',
    posyandu: 'posyandu master di puskesmas yang sama',
  }

  useEffect(() => {
    let dibatalkan = false
    calonMasterWilayah(jenis, usulanId).then((hasil) => {
      if (!dibatalkan) setCalon(hasil)
    })
    return () => {
      dibatalkan = true
    }
  }, [jenis, usulanId])

  function sahkan(masterId: string | undefined, namaBaru: string) {
    setGalat(null)
    mulai(async () => {
      const res = await sahkanUsulanWilayahAction(jenis, usulanId, masterId)
      if (res.ok) onSelesai(namaBaru)
      else setGalat(res.pesan ?? 'Gagal menormalkan wilayah.')
    })
  }

  return (
    <div className="space-y-3 rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
            {SEBUTAN[jenis]} Usulan
          </span>
          <span className="text-sm font-bold text-amber-950">&ldquo;{nama}&rdquo;</span>
          {keterangan && (
            <span className="text-[11px] text-amber-800">{keterangan}</span>
          )}
        </div>
        <span className="text-[11px] font-semibold text-amber-800">
          Perlu dinormalkan
        </span>
      </div>

      <p className="text-[11px] text-amber-800">
        Nama ini diketik sendiri oleh pendaftar, belum ada di data master.
        Tautkan ke data yang sudah ada, atau sahkan sebagai unit baru.
      </p>

      {galat && (
        <p className="rounded-lg bg-bahaya-bg p-2 text-[11px] font-semibold text-bahaya-teks">
          {galat}
        </p>
      )}

      {calon === null ? (
        <p className="flex items-center gap-1.5 text-[11px] italic text-amber-800">
          <Loader2 className="size-3 animate-spin" />
          Mencari data master yang mirip…
        </p>
      ) : calon.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-amber-950">
            Data master yang mirip:
          </p>
          {calon.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-amber-200"
            >
              <div>
                <p className="font-bold text-tinta-900">{c.nama}</p>
                <p className="text-[10px] text-tinta-500">{c.keterangan}</p>
              </div>
              <button
                type="button"
                onClick={() => sahkan(c.id, c.nama)}
                disabled={sedangProses}
                className="inline-flex items-center gap-1.5 rounded-lg bg-laut-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-laut-700 disabled:opacity-50"
              >
                <Link2 className="size-3.5" />
                Tautkan ke sini
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] italic text-amber-800">
          Tidak ada {CAKUPAN[jenis]} yang mirip.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-200 pt-2">
        <span className="text-[11px] font-medium text-amber-900">
          Bila ini memang unit baru:
        </span>
        <button
          type="button"
          onClick={() => sahkan(undefined, nama)}
          disabled={sedangProses}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50"
        >
          <PlusCircle className="size-3.5 text-amber-700" />
          Sahkan sebagai {SEBUTAN[jenis].toLowerCase()} baru
        </button>
      </div>
    </div>
  )
}
