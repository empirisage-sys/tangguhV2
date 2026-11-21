'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Clock,
  Hospital,
  Lock,
  Send,
  Stethoscope,
  XCircle,
} from 'lucide-react'
import type { BalitaDetail } from '@/lib/db/balita'
import type { RujukanDetail, RumahSakitPilihan } from '@/lib/db/rujukan'
import { batalkanRujukan } from '@/app/(aplikasi)/rujukan/actions'
import { formatTanggal } from '@/lib/tampilan/format'
import { ModalTerbitkanRujukan } from './ModalTerbitkanRujukan'
import { ModalBalasanRujukan } from './ModalBalasanRujukan'
import type { Peran } from '@/lib/tampilan/akses'

type Props = {
  balita: BalitaDetail
  peran: Peran
  /** Rujukan terbaru yang belum dibatalkan, dibaca di server. */
  rujukan: RujukanDetail | null
  rumahSakit: RumahSakitPilihan[]
  namaPengguna?: string
}

/** Puskesmas menerbitkan dan membatalkan; rumah sakit membalas. Sama dengan policy RLS. */
const PERAN_PENERBIT: Peran[] = ['dokter', 'dietisien', 'admin']
const PERAN_PEMBALAS: Peran[] = ['dokter_spesialis_anak', 'admin']

export function BannerRujukanBalita({ balita, peran, rujukan, rumahSakit, namaPengguna }: Props) {
  const router = useRouter()
  const [modalTerbitBuka, setModalTerbitBuka] = useState<boolean>(false)
  const [modalBalasBuka, setModalBalasBuka] = useState<boolean>(false)
  const [galatBatal, setGalatBatal] = useState<string | null>(null)
  const [pesanBerhasil, setPesanBerhasil] = useState<string | null>(null)
  const [sedangBatal, mulaiBatal] = useTransition()

  const bolehTerbit = PERAN_PENERBIT.includes(peran)
  const bolehBalas = PERAN_PEMBALAS.includes(peran)
  const perbarui = () => router.refresh()

  const batalkan = () => {
    if (!rujukan) return
    setGalatBatal(null)
    mulaiBatal(async () => {
      const hasil = await batalkanRujukan(rujukan.id)
      if (!hasil.ok) setGalatBatal(hasil.pesan ?? 'Rujukan gagal dibatalkan.')
      else {
        setPesanBerhasil(hasil.pesan ?? 'Rujukan dibatalkan.')
        perbarui()
      }
    })
  }

  const skriningTerakhir = balita.riwayat[balita.riwayat.length - 1]
  const isGiziBuruk =
    skriningTerakhir?.statusBBTB === 'gizi_buruk' ||
    (skriningTerakhir?.z_bbtb !== null && (skriningTerakhir?.z_bbtb ?? 0) < -3) ||
    (skriningTerakhir?.z_tbu !== null && (skriningTerakhir?.z_tbu ?? 0) < -3)

  return (
    <div className="space-y-4">
      {pesanBerhasil && (
        <div role="status" aria-live="polite"
          className="flex items-start justify-between gap-3 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
          <span>{pesanBerhasil}</span>
          <button type="button" onClick={() => setPesanBerhasil(null)} className="font-bold text-emerald-800">
            Tutup
          </button>
        </div>
      )}
      {/* Kasus 1: Rujukan Aktif Sudah Diterbitkan */}
      {rujukan && (
        <div className="rounded-2xl border-2 border-laut-200 bg-white p-5 shadow-[var(--shadow-kartu)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-kabut-200 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-laut-100 text-laut-700">
                <Hospital className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-base font-bold text-tinta-900">
                    Status Rujukan Medis Berjenjang (Puskesmas ⇄ RSUD)
                  </h3>
                  <span
                    className={[
                      'rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
                      rujukan.status === 'diajukan'
                        ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                        : rujukan.status === 'diterima'
                        ? 'bg-sky-100 text-sky-800 ring-1 ring-sky-300'
                        : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300',
                    ].join(' ')}
                  >
                    {rujukan.status === 'diajukan'
                      ? '⏳ Menunggu Respon RSUD'
                      : rujukan.status === 'diterima'
                      ? '🏥 Sedang Ditangani RSUD'
                      : '✅ Selesai (Rujuk Balik)'}
                  </span>
                </div>
                <p className="text-xs text-tinta-600">
                  Tujuan: <span className="font-bold text-tinta-900">{rujukan.namaRsTujuan}</span> • Diajukan {formatTanggal(rujukan.tanggalPengajuan)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-kabut-100 px-3 py-1.5 text-xs font-semibold text-tinta-700">
                <Lock className="size-3.5 text-amber-600" />
                {rujukan.aksesAktif
                  ? `Akses RS aktif s.d. ${formatTanggal(rujukan.aksesBerakhir)}`
                  : 'Akses RS 90 hari telah berakhir'}
              </span>

              {bolehTerbit && rujukan.status === 'diajukan' && (
                <button
                  type="button"
                  onClick={batalkan}
                  disabled={sedangBatal}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-kabut-200 bg-white px-3.5 py-1.5 text-xs font-bold text-tinta-700 hover:bg-kabut-100 disabled:opacity-50"
                >
                  <XCircle className="size-3.5" />
                  {sedangBatal ? 'Membatalkan...' : 'Batalkan Rujukan'}
                </button>
              )}

              {bolehTerbit && rujukan.status === 'selesai' && (
                <button
                  type="button"
                  onClick={() => setModalTerbitBuka(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-laut-200 bg-white px-3.5 py-1.5 text-xs font-bold text-laut-800 hover:bg-laut-50"
                >
                  <Send className="size-3.5" />
                  Rujuk Kembali
                </button>
              )}

              {/* Balasan hanya oleh dokter spesialis anak rumah sakit tujuan */}
              {bolehBalas && (
                <button
                  type="button"
                  onClick={() => setModalBalasBuka(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-laut-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-laut-700 transition-colors"
                >
                  <Stethoscope className="size-3.5" />
                  {rujukan.status === 'selesai' ? 'Ubah Catatan Balasan RS' : 'Isi Balasan / Rujuk Balik'}
                </button>
              )}
            </div>
          </div>

          {galatBatal && (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-2.5 text-xs text-red-900 ring-1 ring-red-200">
              <AlertTriangle className="size-4 text-red-600" />
              {galatBatal}
            </p>
          )}

          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <div className="rounded-xl bg-kabut-50 p-3 ring-1 ring-kabut-200 space-y-1">
              <span className="font-bold uppercase tracking-wider text-tinta-400 text-[10px]">
                Diagnosis Awal Puskesmas
              </span>
              <p className="font-bold text-tinta-900">{rujukan.diagnosisAwal}</p>
              <p className="text-tinta-600">{rujukan.alasanRujukan}</p>
              <p className="text-[11px] text-tinta-400 pt-1">
                Pengaju: {rujukan.diajukanOlehNama} ({rujukan.namaPuskesmas})
              </p>
            </div>

            {/* Catatan Balasan RSUD (Jika Ada) */}
            {rujukan.status === 'selesai' && rujukan.catatanBalasan ? (
              <div className="rounded-xl bg-emerald-50/80 p-3 ring-1 ring-emerald-200 space-y-1 text-emerald-950">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-emerald-700 text-[10px]">
                    Hasil Rujuk Balik Dokter Spesialis RSUD
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700">
                    {rujukan.tanggalSelesai ? formatTanggal(rujukan.tanggalSelesai) : 'Selesai'}
                  </span>
                </div>
                <p className="font-bold text-emerald-900">
                  {rujukan.namaDokterSpesialis}: {rujukan.diagnosisDefinitifRS}
                </p>
                <p className="text-emerald-800">{rujukan.catatanBalasan}</p>
                {rujukan.rekomendasiPKMK && (
                  <div className="mt-2 rounded-lg bg-white/80 p-2 text-[11px] ring-1 ring-emerald-300">
                    <span className="font-bold text-emerald-900">Rekomendasi PKMK:</span>{' '}
                    {rujukan.rekomendasiPKMK}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-amber-50/60 p-3 ring-1 ring-amber-200 text-amber-900 flex items-center gap-3">
                <Clock className="size-5 shrink-0 text-amber-600" />
                <div className="text-xs">
                  <p className="font-bold">Menunggu Pemeriksaan Dokter Spesialis di Rumah Sakit</p>
                  <p className="text-amber-800 text-[11px] mt-0.5">
                    Seluruh rekam medis dan kurva pertumbuhan telah dibuka untuk RSUD {rujukan.namaRsTujuan}.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Kasus 2: Belum Dirujuk, Tetapi Kondisi Balita Butuh Rujukan (Red Flag / Stunting Berat) */}
      {!rujukan && (
        <div
          className={[
            'rounded-2xl p-4 shadow-sm border',
            isGiziBuruk
              ? 'border-red-300 bg-gradient-to-r from-red-50 to-rose-50 ring-1 ring-red-200'
              : 'border-laut-200 bg-white ring-1 ring-kabut-200',
          ].join(' ')}
        >
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div
                className={[
                  'flex size-10 shrink-0 items-center justify-center rounded-xl',
                  isGiziBuruk ? 'bg-red-600 text-white shadow-md' : 'bg-laut-100 text-laut-700',
                ].join(' ')}
              >
                <Hospital className="size-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-tinta-900 sm:text-base">
                  {isGiziBuruk
                    ? 'Balita Memerlukan Rujukan ke Dokter Spesialis Anak RSUD'
                    : 'Layanan Rujukan Medis Berjenjang Puskesmas ke RSUD'}
                </h3>
                <p className="text-xs text-tinta-600">
                  {isGiziBuruk
                    ? 'Hasil penimbangan menunjukkan status gizi buruk/kritis. Dokter puskesmas dapat menerbitkan rujukan langsung ke RSUD se-Gorontalo.'
                    : 'Terbitkan rujukan untuk pemeriksaan dokter spesialis anak di RSUD bila ditemukan gagal tumbuh atau penyakit penyerta.'}
                </p>
              </div>
            </div>

            {bolehTerbit && (
              <button
                type="button"
                onClick={() => setModalTerbitBuka(true)}
                className={[
                  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shrink-0',
                  isGiziBuruk
                    ? 'bg-red-600 text-white shadow-md hover:bg-red-700 active:scale-95'
                    : 'bg-laut-600 text-white shadow-sm hover:bg-laut-700',
                ].join(' ')}
              >
                <Send className="size-4" />
                Terbitkan Rujukan RSUD
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <ModalTerbitkanRujukan
        balita={balita}
        terbuka={modalTerbitBuka}
        onTutup={() => setModalTerbitBuka(false)}
        onSukses={(pesan) => {
          setPesanBerhasil(pesan)
          perbarui()
        }}
        rumahSakit={rumahSakit}
      />

      {rujukan && (
        <ModalBalasanRujukan
          key={rujukan.id + rujukan.status}
          rujukan={rujukan}
          terbuka={modalBalasBuka}
          onTutup={() => setModalBalasBuka(false)}
          onSukses={perbarui}
          namaSpesialis={namaPengguna}
        />
      )}
    </div>
  )
}
