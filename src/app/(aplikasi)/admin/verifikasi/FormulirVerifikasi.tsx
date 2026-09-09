'use client'

import { useState, useTransition } from 'react'
import { verifikasiPengguna } from './actions'
import { AlertCircle, Check, CheckCircle2, X } from 'lucide-react'
import { KotakUsulanWilayah } from './KotakUsulanWilayah'

type Status = 'master' | 'usulan'

/**
 * Verifikasi pendaftaran oleh admin, beserta normalisasi wilayah usulan.
 *
 * TIGA JENIS WILAYAH, BUKAN SATU
 *
 * Bentuk lama komponen ini hanya mengenal fasilitas (`faskes`). Kotak
 * normalisasinya pun tidak pernah muncul, karena `v_antrean_verifikasi` tidak
 * memuat kolom `status_faskes` sehingga nilainya selalu jatuh ke bawaan
 * 'master'. Lihat temuan audit R-8.
 *
 * Medan `namaPosyandu` dan `statusPosyandu` bahkan sudah diterima sebagai
 * prop, tetapi tidak dipakai satu kali pun di dalam badan komponen.
 *
 * Sejak migrasi 20260910000000, nama puskesmas dan posyandu yang diketik
 * pendaftar benar-benar tersimpan sebagai baris usulan. Karena itu ketiganya
 * kini ditangani, dan persetujuan akun ditahan sampai TIDAK ADA lagi wilayah
 * yang berstatus usulan — sebab menyetujui akun yang wilayahnya belum
 * dinormalkan berarti mengunci pengguna itu pada data yang belum sah.
 */
export function FormulirVerifikasi({
  penggunaId,
  nama,
  faskesId,
  namaFaskes,
  statusFaskes = 'master',
  jenisFaskes = 'puskesmas',
  puskesmasId,
  namaPuskesmas,
  statusPuskesmas = 'master',
  posyanduId,
  namaPosyandu,
  desa,
  statusPosyandu = 'master',
}: {
  penggunaId: string
  nama: string
  faskesId?: string
  namaFaskes?: string
  statusFaskes?: Status
  jenisFaskes?: 'puskesmas' | 'rumah_sakit'
  puskesmasId?: string
  namaPuskesmas?: string
  statusPuskesmas?: Status
  posyanduId?: string
  namaPosyandu?: string
  desa?: string
  statusPosyandu?: Status
}) {
  const [modeTolak, setModeTolak] = useState(false)
  const [alasan, setAlasan] = useState('')
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null)
  const [sedangProses, mulai] = useTransition()

  // Keadaan tiap wilayah disimpan terpisah agar normalisasi satu jenis tidak
  // menghapus penanda jenis lain yang masih menunggu.
  const [stFaskes, setStFaskes] = useState<Status>(statusFaskes)
  const [stPuskesmas, setStPuskesmas] = useState<Status>(statusPuskesmas)
  const [stPosyandu, setStPosyandu] = useState<Status>(statusPosyandu)
  const [nmFaskes, setNmFaskes] = useState(namaFaskes ?? '')
  const [nmPuskesmas, setNmPuskesmas] = useState(namaPuskesmas ?? '')
  const [nmPosyandu, setNmPosyandu] = useState(namaPosyandu ?? '')

  // Fasilitas hanya perlu kotaknya sendiri bila ia BUKAN puskesmas. Untuk
  // peran puskesmas, `faskes_id` dan `puskesmas_id` menunjuk baris dengan id
  // yang sama, sehingga menampilkan dua kotak untuk satu unit hanya
  // membingungkan — dan menormalkan salah satunya sudah mengurus keduanya.
  const faskesTerpisah = jenisFaskes === 'rumah_sakit' && faskesId !== puskesmasId

  const usulanFaskes = faskesTerpisah && stFaskes === 'usulan' && Boolean(faskesId)
  const usulanPuskesmas = stPuskesmas === 'usulan' && Boolean(puskesmasId)
  const usulanPosyandu = stPosyandu === 'usulan' && Boolean(posyanduId)
  const adaUsulan = usulanFaskes || usulanPuskesmas || usulanPosyandu

  function kirim(setujui: boolean) {
    if (setujui && adaUsulan) {
      setPesan({
        ok: false,
        teks:
          'Masih ada wilayah berstatus usulan. Normalkan dulu semuanya, ' +
          'agar akun ini tidak terkunci pada data yang belum sah.',
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

  if (pesan?.ok && !modeTolak && !adaUsulan) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-aman-bg p-3.5 text-xs font-semibold text-aman-teks ring-1 ring-aman-garis">
        <CheckCircle2 className="size-4" />
        <span>{pesan.teks}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-xs">
      {pesan && !pesan.ok && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-bahaya-bg p-3 font-semibold text-bahaya-teks ring-1 ring-bahaya-garis"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{pesan.teks}</span>
        </div>
      )}

      {pesan?.ok && adaUsulan && (
        <div className="flex items-start gap-2 rounded-xl bg-aman-bg p-3 font-semibold text-aman-teks ring-1 ring-aman-garis">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>{pesan.teks}</span>
        </div>
      )}

      {usulanPuskesmas && (
        <KotakUsulanWilayah
          jenis="puskesmas"
          usulanId={puskesmasId as string}
          nama={nmPuskesmas}
          onSelesai={(baru) => {
            setNmPuskesmas(baru)
            setStPuskesmas('master')
            // Untuk peran puskesmas, barisnya sama dengan faskes.
            if (!faskesTerpisah) setStFaskes('master')
            setPesan({ ok: true, teks: `Puskesmas dinormalkan menjadi "${baru}".` })
          }}
        />
      )}

      {usulanFaskes && (
        <KotakUsulanWilayah
          jenis="faskes"
          usulanId={faskesId as string}
          nama={nmFaskes}
          onSelesai={(baru) => {
            setNmFaskes(baru)
            setStFaskes('master')
            setPesan({ ok: true, teks: `Rumah sakit dinormalkan menjadi "${baru}".` })
          }}
        />
      )}

      {usulanPosyandu && (
        <KotakUsulanWilayah
          jenis="posyandu"
          usulanId={posyanduId as string}
          nama={nmPosyandu}
          keterangan={desa ? `Desa ${desa}` : undefined}
          onSelesai={(baru) => {
            setNmPosyandu(baru)
            setStPosyandu('master')
            setPesan({ ok: true, teks: `Posyandu dinormalkan menjadi "${baru}".` })
          }}
        />
      )}

      {modeTolak ? (
        <div className="space-y-3 rounded-xl bg-kabut-50 p-4 ring-1 ring-kabut-200">
          <label
            htmlFor={`alasan-${penggunaId}`}
            className="block text-xs font-bold uppercase tracking-wider text-tinta-700"
          >
            Alasan Penolakan Pendaftaran <span className="text-bahaya-teks">*</span>
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
            placeholder="Contoh: Nomor STR tidak ditemukan pada pangkalan data resmi, atau posyandu yang disebut tidak berada di wilayah puskesmas tersebut."
            className="w-full rounded-xl bg-white p-3 text-xs font-medium leading-relaxed ring-1 ring-kabut-200 outline-none focus:ring-2 focus:ring-laut-500"
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
              className="min-h-10 rounded-xl bg-bahaya-teks px-4 font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {sedangProses ? 'Menyimpan...' : 'Kirim Penolakan'}
            </button>
            <button
              type="button"
              onClick={() => setModeTolak(false)}
              disabled={sedangProses}
              className="min-h-10 rounded-xl px-4 font-bold text-tinta-600 transition-colors hover:bg-kabut-200"
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
            disabled={sedangProses || adaUsulan}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-aman-teks px-5 text-xs font-bold text-white shadow-md shadow-aman-teks/20 transition-all hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
            title={
              adaUsulan
                ? 'Normalkan seluruh wilayah usulan terlebih dahulu'
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
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-kabut-200 bg-white px-4 text-xs font-bold text-bahaya-teks transition-colors hover:bg-red-50"
          >
            <X className="size-4" />
            Tolak Pendaftaran
          </button>
        </div>
      )}
    </div>
  )
}
