'use client'

import { useState, useTransition } from 'react'
import { verifikasiPengguna, sahkanUsulanFaskesAction } from './actions'
import { AlertCircle, Check, CheckCircle2, Link2, PlusCircle, ShieldAlert, X } from 'lucide-react'
import { cariFaskesMiripLokal, type FaskesData } from '@/lib/db/wilayah'

/**
 * Komponen Verifikasi Pendaftaran oleh Admin.
 *
 * Mendukung normalisasi fasilitas usulan:
 * 1. Tautkan ke fasilitas master yang sudah ada
 * 2. Sahkan sebagai fasilitas master baru
 * 3. Tolak pendaftaran disertai alasan minimal 10 karakter
 */
export function FormulirVerifikasi({
  penggunaId,
  nama,
  faskesId,
  namaFaskes,
  statusFaskes = 'master',
  kabupatenId,
  jenisFaskes = 'puskesmas',
  namaPosyandu,
  statusPosyandu = 'master',
}: {
  penggunaId: string
  nama: string
  faskesId?: string
  namaFaskes?: string
  statusFaskes?: 'master' | 'usulan'
  kabupatenId?: string
  jenisFaskes?: 'puskesmas' | 'rumah_sakit'
  namaPosyandu?: string
  statusPosyandu?: 'master' | 'usulan'
}) {
  const [modeTolak, setModeTolak] = useState(false)
  const [alasan, setAlasan] = useState('')
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null)
  const [statusFaskesState, setStatusFaskesState] = useState<'master' | 'usulan'>(statusFaskes)
  const [namaFaskesState, setNamaFaskesState] = useState<string>(namaFaskes || '')
  const [sedangProses, mulai] = useTransition()

  // Cari faskes master yang mirip jika faskes berstatus usulan
  const saranMirip: FaskesData[] =
    statusFaskesState === 'usulan' && namaFaskesState
      ? cariFaskesMiripLokal(namaFaskesState, kabupatenId, jenisFaskes)
      : []

  function kirim(setujui: boolean) {
    if (setujui && statusFaskesState === 'usulan') {
      setPesan({
        ok: false,
        teks: 'Fasilitas kesehatan masih berstatus USULAN. Harap tautkan ke master atau sahkan terlebih dahulu sebelum menyetujui akun.',
      })
      return
    }

    const data = new FormData()
    data.set('penggunaId', penggunaId)
    data.set('setujui', setujui ? 'setuju' : 'tolak')
    if (!setujui) data.set('alasan', alasan)

    mulai(async () => {
      const hasil = await verifikasiPengguna(data)
      setPesan({ ok: hasil.ok, teks: hasil.pesan ?? '' })
      if (hasil.ok) {
        setModeTolak(false)
        setAlasan('')
      }
    })
  }

  function handleSahkanFaskes(masterId?: string, namaMaster?: string) {
    if (!faskesId) return

    mulai(async () => {
      const res = await sahkanUsulanFaskesAction(faskesId, masterId)
      if (res.ok) {
        setStatusFaskesState('master')
        if (namaMaster) setNamaFaskesState(namaMaster)
        setPesan({
          ok: true,
          teks: masterId
            ? `Fasilitas berhasil ditautkan ke master: ${namaMaster}`
            : 'Fasilitas usulan berhasil disahkan menjadi master baru.',
        })
      } else {
        setPesan({ ok: false, teks: res.pesan || 'Gagal mengesahkan fasilitas.' })
      }
    })
  }

  if (pesan?.ok && !modeTolak) {
    return (
      <div className="rounded-xl bg-aman-bg p-3.5 text-xs font-semibold text-aman-teks ring-1 ring-aman-garis flex items-center gap-2">
        <CheckCircle2 className="size-4" />
        <span>{pesan.teks}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-xs">
      {pesan && !pesan.ok && (
        <div role="alert" className="rounded-xl bg-bahaya-bg p-3 font-semibold text-bahaya-teks ring-1 ring-bahaya-garis flex items-start gap-2">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{pesan.teks}</span>
        </div>
      )}

      {/* Kotak Fasilitas yang Diusulkan Manual */}
      {statusFaskesState === 'usulan' && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                Fasilitas Usulan Manual
              </span>
              <span className="font-bold text-amber-950 text-sm">
                &ldquo;{namaFaskesState}&rdquo;
              </span>
            </div>
            <span className="text-[11px] text-amber-800 font-semibold">
              Perlu Dinormalkan Admin
            </span>
          </div>

          <p className="text-[11px] text-amber-800">
            Pendaftar mengetik nama fasilitas secara manual. Pilih salah satu opsi normalisasi di bawah ini:
          </p>

          {/* Daftar Saran Fasilitas Master yang Mirip */}
          {saranMirip.length > 0 ? (
            <div className="space-y-2">
              <p className="font-bold text-amber-950 text-[11px]">
                Fasilitas Master yang Mirip Ditemukan:
              </p>
              <div className="space-y-1.5">
                {saranMirip.map((saran) => (
                  <div
                    key={saran.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-amber-200"
                  >
                    <div>
                      <p className="font-bold text-tinta-900">{saran.nama}</p>
                      <p className="text-[10px] text-tinta-500 capitalize">{saran.jenis} • Master Resmi</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSahkanFaskes(saran.id, saran.nama)}
                      disabled={sedangProses}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-laut-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-laut-700 transition-colors disabled:opacity-50"
                    >
                      <Link2 className="size-3.5" />
                      Tautkan ke fasilitas ini
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] italic text-amber-800">
              Tidak ada fasilitas master yang mirip di kabupaten ini.
            </p>
          )}

          {/* Opsi Sahkan Menjadi Master Baru */}
          <div className="border-t border-amber-200 pt-2 flex items-center justify-between">
            <span className="text-[11px] text-amber-900 font-medium">
              Bila fasilitas ini memang unit baru:
            </span>
            <button
              type="button"
              onClick={() => handleSahkanFaskes(undefined, namaFaskesState)}
              disabled={sedangProses}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              <PlusCircle className="size-3.5 text-amber-700" />
              Sahkan sebagai fasilitas baru
            </button>
          </div>
        </div>
      )}

      {/* Mode Penolakan vs Persetujuan */}
      {modeTolak ? (
        <div className="space-y-3 rounded-xl bg-kabut-50 p-4 ring-1 ring-kabut-200">
          <label htmlFor={`alasan-${penggunaId}`} className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
            Alasan Penolakan Pendaftaran <span className="text-red-500">*</span>
            <span className="ml-1 font-normal lowercase text-tinta-400">
              (ditampilkan kepada pendaftar {nama.split(' ')[0]})
            </span>
          </label>
          <textarea
            id={`alasan-${penggunaId}`}
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Contoh: Nomor STR tidak valid pada pangkalan data Kemenkes, atau wilayah posyandu tidak sesuai pembagian desa."
            className="w-full rounded-xl bg-white p-3 text-xs font-medium ring-1 ring-kabut-200 outline-none focus:ring-2 focus:ring-laut-500 leading-relaxed"
          />
          <p className="text-[11px] text-tinta-400">
            {alasan.trim().length < 10
              ? `Minimal 10 karakter, baru ${alasan.trim().length}.`
              : `${alasan.trim().length} karakter.`}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => kirim(false)}
              disabled={sedangProses || alasan.trim().length < 10}
              className="min-h-10 rounded-xl bg-bahaya-teks px-4 font-bold text-white disabled:opacity-50 hover:bg-red-700 transition-colors"
            >
              {sedangProses ? 'Menyimpan...' : 'Kirim Penolakan'}
            </button>
            <button
              type="button"
              onClick={() => setModeTolak(false)}
              disabled={sedangProses}
              className="min-h-10 rounded-xl px-4 font-bold text-tinta-600 hover:bg-kabut-200 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => kirim(true)}
            disabled={sedangProses || statusFaskesState === 'usulan'}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-aman-teks px-5 text-xs font-bold text-white shadow-md shadow-aman-teks/20 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title={
              statusFaskesState === 'usulan'
                ? 'Normalkan fasilitas usulan terlebih dahulu sebelum menyetujui akun'
                : 'Setujui pendaftaran akun'
            }
          >
            <Check className="size-4" />
            {sedangProses ? 'Memproses...' : 'Setujui Akun'}
          </button>

          <button
            type="button"
            onClick={() => setModeTolak(true)}
            disabled={sedangProses}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-kabut-200 bg-white px-4 text-xs font-bold text-bahaya-teks hover:bg-red-50 transition-colors"
          >
            <X className="size-4" />
            Tolak Pendaftaran
          </button>
        </div>
      )}
    </div>
  )
}
