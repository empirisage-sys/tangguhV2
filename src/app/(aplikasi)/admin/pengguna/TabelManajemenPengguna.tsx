'use client'

import { useState } from 'react'
import {
  adminEditPengguna,
  adminHapusPengguna,
  adminResetPasswordManual,
} from './actions'
import {
  Search,
  Filter,
  Edit2,
  Trash2,
  KeyRound,
  ShieldCheck,
  User,
  Phone,
  Building2,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatTanggal } from '@/lib/tampilan/format'
import { RUMAH_SAKIT_GORONTALO } from '@/lib/db/wilayah'

export type PeranPengguna =
  | 'kader'
  | 'dokter'
  | 'dokter_spesialis_anak'
  | 'dietisien'
  | 'admin'

export type PenggunaItem = {
  id: string
  namaLengkap: string
  role: PeranPengguna
  noHp?: string | null
  noStr?: string | null
  statusAkun: 'menunggu' | 'disetujui' | 'ditolak'
  alasanTolak?: string | null
  /** `null` berarti tidak bertugas di fasilitas mana pun. Sah bagi administrator. */
  jenisFaskes?: 'puskesmas' | 'rumah_sakit' | null
  puskesmasId?: string | null
  faskesId?: string | null
  posyanduId?: string | null
  puskesmasNama?: string | null
  kabupatenNama?: string | null
  posyanduNama?: string | null
  faskesNama?: string | null
  faskesJenis?: 'puskesmas' | 'rumah_sakit' | null
  createdAt?: string | null
}

export type OpsiWilayah = { id: string; nama: string }
export type OpsiPosyandu = {
  id: string
  nama: string
  desa: string | null
  puskesmasId: string | null
}

/** Peran yang cakupan datanya ditentukan puskesmas. */
const PERAN_PUSKESMAS: readonly PeranPengguna[] = ['dokter', 'dietisien']
/** Peran yang wajib memiliki Nomor STR. */
const PERAN_STR: readonly PeranPengguna[] = [
  'dokter',
  'dietisien',
  'dokter_spesialis_anak',
]
/** Nilai penanda pada dropdown rumah sakit: namanya diketik manual. */
const RS_BARU = 'rs_baru'

const LABEL_PERAN: Record<string, { label: string; badge: string }> = {
  admin: { label: 'Administrator', badge: 'bg-tinta-900 text-white' },
  dokter: { label: 'Dokter', badge: 'bg-aman-bg text-aman-teks border border-aman-garis' },
  dokter_spesialis_anak: {
    label: 'Dokter Spesialis Anak',
    badge: 'bg-indigo-50 text-indigo-800 border border-indigo-200',
  },
  dietisien: { label: 'Dietisien / Nutrisionis', badge: 'bg-karawo-100 text-karawo-800 border border-karawo-300' },
  kader: { label: 'Kader Posyandu', badge: 'bg-laut-50 text-laut-800 border border-laut-200' },
}

const LABEL_STATUS: Record<string, { label: string; badge: string }> = {
  disetujui: { label: 'Aktif / Disetujui', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  menunggu: { label: 'Menunggu Verifikasi', badge: 'bg-amber-50 text-amber-800 border border-amber-200' },
  ditolak: { label: 'Ditolak', badge: 'bg-rose-50 text-rose-700 border border-rose-200' },
}

export function TabelManajemenPengguna({
  daftar,
  daftarPuskesmas = [],
  daftarRumahSakit = [],
  daftarPosyandu = [],
}: {
  daftar: PenggunaItem[]
  daftarPuskesmas?: OpsiWilayah[]
  daftarRumahSakit?: OpsiWilayah[]
  daftarPosyandu?: OpsiPosyandu[]
}) {
  const [cari, setCari] = useState('')
  const [filterPeran, setFilterPeran] = useState<string>('semua')
  const [filterStatus, setFilterStatus] = useState<string>('semua')

  // Modals state
  const [editTarget, setEditTarget] = useState<PenggunaItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PenggunaItem | null>(null)
  const [resetTarget, setResetTarget] = useState<PenggunaItem | null>(null)

  // Reset password form state
  const [sandiBaru, setSandiBaru] = useState('')
  const [tampilkanSandi, setTampilkanSandi] = useState(false)
  const [tersalin, setTersalin] = useState(false)

  // Loading & Toast state
  const [sedangProses, setSedangProses] = useState(false)
  const [toast, setToast] = useState<{ tipe: 'sukses' | 'galat'; pesan: string } | null>(null)
  const [galatMedan, setGalatMedan] = useState<Record<string, string>>({})

  const showToast = (tipe: 'sukses' | 'galat', pesan: string) => {
    setToast({ tipe, pesan })
    setTimeout(() => setToast(null), 4500)
  }

  // Filter logic
  const filteredDaftar = daftar.filter((item) => {
    const cocokCari =
      item.namaLengkap.toLowerCase().includes(cari.toLowerCase()) ||
      (item.noHp && item.noHp.includes(cari)) ||
      (item.noStr && item.noStr.toLowerCase().includes(cari.toLowerCase())) ||
      (item.puskesmasNama && item.puskesmasNama.toLowerCase().includes(cari.toLowerCase())) ||
      (item.kabupatenNama && item.kabupatenNama.toLowerCase().includes(cari.toLowerCase()))

    const cocokPeran = filterPeran === 'semua' || item.role === filterPeran
    const cocokStatus = filterStatus === 'semua' || item.statusAkun === filterStatus

    return cocokCari && cocokPeran && cocokStatus
  })

  // Handlers
  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSedangProses(true)
    setGalatMedan({})
    const formData = new FormData(e.currentTarget)
    const res = await adminEditPengguna(formData)
    setSedangProses(false)

    if (res.ok) {
      showToast('sukses', res.pesan ?? 'Profil berhasil diperbarui.')
      setEditTarget(null)
    } else {
      // Galat per medan ditampilkan tepat di bawah medannya, bukan hanya
      // sebagai toast yang lewat. Sebelumnya administrator hanya menerima
      // satu kalimat mengambang tanpa petunjuk medan mana yang salah.
      setGalatMedan(res.galatMedan ?? {})
      showToast('galat', res.pesan ?? 'Gagal memperbarui profil.')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setSedangProses(true)
    const res = await adminHapusPengguna(deleteTarget.id)
    setSedangProses(false)

    if (res.ok) {
      showToast('sukses', res.pesan ?? 'Akun berhasil dihapus.')
      setDeleteTarget(null)
    } else {
      showToast('galat', res.pesan ?? 'Gagal menghapus akun.')
    }
  }

  const handleResetSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!resetTarget) return
    if (sandiBaru.length < 8) {
      showToast('galat', 'Kata sandi baru minimal 8 karakter.')
      return
    }

    setSedangProses(true)
    const res = await adminResetPasswordManual(resetTarget.id, sandiBaru)
    setSedangProses(false)

    if (res.ok) {
      showToast('sukses', res.pesan ?? 'Kata sandi berhasil diatur ulang.')
      setResetTarget(null)
      setSandiBaru('')
    } else {
      showToast('galat', res.pesan ?? 'Gagal mereset kata sandi.')
    }
  }

  const salinSandi = () => {
    if (!sandiBaru) return
    navigator.clipboard.writeText(sandiBaru)
    setTersalin(true)
    setTimeout(() => setTersalin(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl p-4 shadow-xl backdrop-blur-md transition-all ${
            toast.tipe === 'sukses'
              ? 'bg-emerald-900/90 text-white ring-1 ring-emerald-500/50'
              : 'bg-rose-900/90 text-white ring-1 ring-rose-500/50'
          }`}
        >
          {toast.tipe === 'sukses' ? (
            <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="size-5 shrink-0 text-rose-400" />
          )}
          <span className="text-sm font-semibold">{toast.pesan}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)] md:flex-row md:items-center md:justify-between">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-tinta-400" />
          <input
            type="text"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama, faskes, no HP, atau no STR..."
            className="h-11 w-full rounded-xl border border-kabut-200 bg-kabut-50/50 pl-10 pr-4 text-xs font-semibold text-tinta-900 placeholder:text-tinta-400 focus:border-laut-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-laut-500/20"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-xl border border-kabut-200 bg-white px-3 py-2 text-xs font-bold text-tinta-700">
            <Filter className="size-3.5 text-tinta-400" />
            <select
              value={filterPeran}
              onChange={(e) => setFilterPeran(e.target.value)}
              aria-label="Saring berdasarkan peran pengguna"
              className="bg-transparent font-bold text-tinta-900 focus:outline-none"
            >
              <option value="semua">Semua Peran</option>
              <option value="dokter">Dokter</option>
              <option value="dokter_spesialis_anak">Dokter Spesialis Anak</option>
              <option value="dietisien">Dietisien</option>
              <option value="kader">Kader Posyandu</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-kabut-200 bg-white px-3 py-2 text-xs font-bold text-tinta-700">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Saring berdasarkan status verifikasi akun"
              className="bg-transparent font-bold text-tinta-900 focus:outline-none"
            >
              <option value="semua">Semua Status</option>
              <option value="disetujui">Disetujui (Aktif)</option>
              <option value="menunggu">Menunggu</option>
              <option value="ditolak">Ditolak</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-kartu)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-kabut-200 bg-kabut-50 text-[11px] font-bold uppercase tracking-wider text-tinta-500">
              <tr>
                <th className="px-5 py-4">Nama Pengguna</th>
                <th className="px-4 py-4">Peran &amp; STR</th>
                <th className="px-4 py-4">Fasilitas / Wilayah</th>
                <th className="px-4 py-4">Kontak</th>
                <th className="px-4 py-4">Status Akun</th>
                <th className="px-5 py-4 text-right">Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kabut-100">
              {filteredDaftar.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-tinta-500">
                    <User className="mx-auto mb-2 size-8 text-tinta-300" />
                    <p className="font-semibold text-tinta-700">Tidak ada akun yang sesuai dengan pencarian / filter.</p>
                  </td>
                </tr>
              ) : (
                filteredDaftar.map((item) => {
                  const peranInfo = LABEL_PERAN[item.role] || { label: item.role, badge: 'bg-gray-100 text-gray-800' }
                  const statusInfo = LABEL_STATUS[item.statusAkun] || { label: item.statusAkun, badge: 'bg-gray-100' }

                  return (
                    <tr key={item.id} className="hover:bg-kabut-50/70 transition-colors">
                      {/* Nama & Avatar */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-laut-100 font-black text-laut-700">
                            {item.namaLengkap.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-tinta-900 sm:text-sm">{item.namaLengkap}</p>
                            <p className="text-[11px] text-tinta-400">
                              {item.createdAt ? `Daftar: ${formatTanggal(item.createdAt.slice(0, 10))}` : 'Terdaftar'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Peran & STR */}
                      <td className="px-4 py-4">
                        <span className={`inline-block rounded-lg px-2.5 py-1 text-[11px] font-bold ${peranInfo.badge}`}>
                          {peranInfo.label}
                        </span>
                        {item.noStr && (
                          <p className="mt-1 font-mono text-[11px] text-tinta-500">
                            STR: {item.noStr}
                          </p>
                        )}
                      </td>

                      {/* Fasilitas / Wilayah */}
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-1.5">
                          <Building2 className="mt-0.5 size-3.5 shrink-0 text-tinta-400" />
                          <div>
                            {/*
                              Dua keadaan di bawah ini dahulu tidak terjangkau,
                              karena setiap pendaftar selalu memperoleh sebuah
                              puskesmas cadangan. Keduanya menjadi nyata setelah
                              administrator boleh tanpa wilayah dan spesialis
                              anak bertugas di rumah sakit — dan sel ini
                              menampilkan 'Fasilitas Terdaftar', sebuah kalimat
                              yang tidak berarti apa-apa. Terlihat saat
                              pengujian otomatis Uji B.
                            */}
                            {item.jenisFaskes === 'rumah_sakit' && item.faskesNama ? (
                              <>
                                <p className="font-semibold text-tinta-800">
                                  {item.faskesNama}
                                </p>
                                <p className="text-[11px] text-indigo-700">Rumah Sakit</p>
                              </>
                            ) : item.puskesmasNama ? (
                              <p className="font-semibold text-tinta-800">
                                {item.puskesmasNama}
                              </p>
                            ) : (
                              <p className="italic text-tinta-400">
                                Tidak bertugas di wilayah tertentu
                              </p>
                            )}
                            {item.posyanduNama && (
                              <p className="text-[11px] text-tinta-500">
                                Posyandu: {item.posyanduNama}
                              </p>
                            )}
                            {item.kabupatenNama && (
                              <p className="text-[11px] text-tinta-400">
                                {item.kabupatenNama}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Kontak */}
                      <td className="px-4 py-4">
                        {item.noHp ? (
                          <div className="flex items-center gap-1.5 font-medium text-tinta-700">
                            <Phone className="size-3.5 text-tinta-400" />
                            <span>{item.noHp}</span>
                          </div>
                        ) : (
                          <span className="text-tinta-400">-</span>
                        )}
                      </td>

                      {/* Status Akun */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusInfo.badge}`}>
                          <span className={`size-1.5 rounded-full ${item.statusAkun === 'disetujui' ? 'bg-emerald-500' : item.statusAkun === 'menunggu' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Tombol Aksi */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => setEditTarget(item)}
                            title="Edit Data & Hak Akses Akun"
                            className="flex size-8 items-center justify-center rounded-lg border border-kabut-200 bg-white text-tinta-700 hover:bg-laut-50 hover:text-laut-700 hover:border-laut-300 transition-colors"
                          >
                            <Edit2 className="size-3.5" />
                          </button>

                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => {
                              setResetTarget(item)
                              setSandiBaru('')
                            }}
                            title="Reset Kata Sandi Manual"
                            className="flex size-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100 hover:border-amber-400 transition-colors"
                          >
                            <KeyRound className="size-3.5" />
                          </button>

                          {/* Hapus */}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            title="Hapus Akun Pengguna"
                            className="flex size-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50/70 text-rose-700 hover:bg-rose-100 hover:border-rose-400 transition-colors"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. MODAL EDIT AKUN                                                        */}
      {/* ========================================================================= */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-kabut-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-laut-100 text-laut-700">
                  <Edit2 className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-tinta-900">Edit Profil &amp; Hak Akses</h3>
                  <p className="text-xs text-tinta-500">{editTarget.namaLengkap}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="rounded-lg p-1.5 text-tinta-400 hover:bg-kabut-100 hover:text-tinta-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <MedanEditPengguna
              key={editTarget.id}
              target={editTarget}
              daftarPuskesmas={daftarPuskesmas}
              daftarRumahSakit={daftarRumahSakit}
              daftarPosyandu={daftarPosyandu}
              galatMedan={galatMedan}
              sedangProses={sedangProses}
              onSubmit={handleEditSubmit}
              onBatal={() => setEditTarget(null)}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MODAL RESET PASSWORD MANUAL                                            */}
      {/* ========================================================================= */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-kabut-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <KeyRound className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-tinta-900">Reset Kata Sandi Manual</h3>
                  <p className="text-xs text-tinta-500">{resetTarget.namaLengkap}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="rounded-lg p-1.5 text-tinta-400 hover:bg-kabut-100 hover:text-tinta-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleResetSubmit} className="mt-5 space-y-4">
              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
                <p className="font-semibold">Perhatian Administrator:</p>
                <p className="mt-0.5">
                  Kata sandi baru akan langsung aktif. Harap sampaikan kata sandi ini kepada pengguna setelah direset.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                  Kata Sandi Baru <span className="text-bahaya-teks">* (Min. 8 karakter)</span>
                </label>
                <div className="relative mt-1.5 flex items-center">
                  <Lock className="pointer-events-none absolute left-3.5 size-4 text-tinta-400" />
                  <input
                    type={tampilkanSandi ? 'text' : 'password'}
                    value={sandiBaru}
                    onChange={(e) => setSandiBaru(e.target.value)}
                    placeholder="Ketik kata sandi baru (min 8 karakter)..."
                    required
                    className="h-11 w-full rounded-xl border border-kabut-200 pl-10 pr-20 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTampilkanSandi(!tampilkanSandi)}
                      className="rounded-lg p-1 text-tinta-400 hover:text-tinta-700"
                      title={tampilkanSandi ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                    >
                      {tampilkanSandi ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                    {sandiBaru && (
                      <button
                        type="button"
                        onClick={salinSandi}
                        className="rounded-lg p-1 text-tinta-400 hover:text-tinta-700"
                        title="Salin kata sandi"
                      >
                        {tersalin ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2.5 pt-4 border-t border-kabut-200">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-tinta-600 hover:bg-kabut-100"
                >
                  Batal
                </button>
                <Button type="submit" varian="utama" sedangProses={sedangProses}>
                  Tetapkan Kata Sandi Baru
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL HAPUS AKUN (KONFIRMASI BAHAYA)                                   */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-tinta-900">Konfirmasi Hapus Akun</h3>
                <p className="text-xs text-rose-600 font-semibold">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-rose-50/70 p-4 ring-1 ring-rose-200/80">
              <p className="text-xs text-tinta-700 leading-relaxed">
                Apakah Anda yakin ingin menghapus akun pengguna{' '}
                <strong className="font-bold text-tinta-900">{deleteTarget.namaLengkap}</strong>?
              </p>
              <p className="mt-2 text-[11px] text-tinta-500">
                Hak akses dan profil pengguna ini akan dihapus secara permanen dari basis data sistem.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-tinta-600 hover:bg-kabut-100"
              >
                Batal
              </button>
              <Button
                type="button"
                varian="bahaya"
                sedangProses={sedangProses}
                onClick={handleDeleteConfirm}
              >
                Ya, Hapus Akun Sekarang
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Medan formulir edit akun.
 *
 * Dipisahkan menjadi komponen sendiri agar keadaannya (peran, jenis fasilitas,
 * pilihan wilayah) dapat saling bergantung tanpa penyelarasan manual: pemanggil
 * memberi `key={target.id}`, sehingga membuka akun lain memulai keadaan yang
 * bersih. Sebelum ini seluruh medan memakai `defaultValue` tanpa keadaan, yang
 * tidak mungkin dipakai untuk menyembunyikan atau menyaring medan lain.
 *
 * ATURAN YANG DITEGAKKAN DI SINI HANYA URUSAN TAMPILAN. Kebenarannya diperiksa
 * ulang oleh `skemaEditPenggunaAdmin` di server, lalu oleh batasan CHECK di
 * Postgres. Menyembunyikan sebuah medan bukan pengamanan.
 */
function MedanEditPengguna({
  target,
  daftarPuskesmas,
  daftarRumahSakit,
  daftarPosyandu,
  galatMedan,
  sedangProses,
  onSubmit,
  onBatal,
}: {
  target: PenggunaItem
  daftarPuskesmas: OpsiWilayah[]
  daftarRumahSakit: OpsiWilayah[]
  daftarPosyandu: OpsiPosyandu[]
  galatMedan: Record<string, string>
  sedangProses: boolean
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onBatal: () => void
}) {
  const [peran, setPeran] = useState<PeranPengguna>(target.role)
  const [statusAkun, setStatusAkun] = useState(target.statusAkun)
  const [jenisFaskes, setJenisFaskes] = useState<'' | 'puskesmas' | 'rumah_sakit'>(
    target.jenisFaskes ?? (target.role === 'admin' ? '' : 'puskesmas'),
  )
  const [puskesmasId, setPuskesmasId] = useState(target.puskesmasId ?? '')
  const [rumahSakitId, setRumahSakitId] = useState(
    target.faskesJenis === 'rumah_sakit' ? (target.faskesId ?? '') : '',
  )
  const [namaRsBaru, setNamaRsBaru] = useState('')
  const [posyanduId, setPosyanduId] = useState(target.posyanduId ?? '')

  const perluStr = PERAN_STR.includes(peran)
  const perluPosyandu = peran === 'kader'
  const bolehTanpaWilayah = peran === 'admin'
  const wajibRs = peran === 'dokter_spesialis_anak'
  const wajibPuskesmas = PERAN_PUSKESMAS.includes(peran) || peran === 'kader'

  // Posyandu disaring pada puskesmas yang dipilih, supaya administrator tidak
  // dapat memasangkan kader ke posyandu di luar puskesmasnya.
  const posyanduTersaring = puskesmasId
    ? daftarPosyandu.filter((p) => p.puskesmasId === puskesmasId)
    : daftarPosyandu

  /**
   * Mengubah peran ikut menentukan jenis fasilitas, karena database menuntutnya:
   * spesialis anak selalu rumah sakit, dokter/dietisien/kader selalu puskesmas.
   * Administrator satu-satunya yang boleh tanpa wilayah.
   */
  const ubahPeran = (nilai: PeranPengguna) => {
    setPeran(nilai)
    if (nilai === 'dokter_spesialis_anak') setJenisFaskes('rumah_sakit')
    else if (nilai === 'admin') setJenisFaskes(target.jenisFaskes ?? '')
    else setJenisFaskes('puskesmas')
    if (nilai !== 'kader') setPosyanduId('')
  }

  const kelasMedan =
    'mt-1.5 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none'
  const kelasLabel =
    'block text-xs font-bold uppercase tracking-wider text-tinta-700'

  const Galat = ({ medan }: { medan: string }) =>
    galatMedan[medan] ? (
      <p className="mt-1 text-[11px] font-semibold text-bahaya-teks">
        {galatMedan[medan]}
      </p>
    ) : null

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <input type="hidden" name="penggunaId" value={target.id} />

      <div>
        <label className={kelasLabel}>Nama Lengkap &amp; Gelar</label>
        <input
          type="text"
          name="namaLengkap"
          defaultValue={target.namaLengkap}
          required
          className={kelasMedan}
        />
        <Galat medan="namaLengkap" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={kelasLabel}>Peran Pengguna</label>
          <select
            name="role"
            value={peran}
            onChange={(e) => ubahPeran(e.target.value as PeranPengguna)}
            className={kelasMedan}
          >
            <option value="kader">Kader Posyandu</option>
            <option value="dokter">Dokter</option>
            <option value="dokter_spesialis_anak">Dokter Spesialis Anak (RS)</option>
            <option value="dietisien">Dietisien / Nutrisionis</option>
            <option value="admin">Administrator</option>
          </select>
          <Galat medan="role" />
        </div>

        <div>
          <label className={kelasLabel}>Status Akun</label>
          <select
            name="statusAkun"
            value={statusAkun}
            onChange={(e) => setStatusAkun(e.target.value as PenggunaItem['statusAkun'])}
            className={kelasMedan}
          >
            <option value="disetujui">Disetujui (Aktif Penuh)</option>
            <option value="menunggu">Menunggu Verifikasi</option>
            <option value="ditolak">Ditolak</option>
          </select>
          <Galat medan="statusAkun" />
        </div>
      </div>

      {statusAkun === 'ditolak' && (
        <div>
          <label className={kelasLabel}>
            Alasan Penolakan <span className="text-bahaya-teks">*</span>
          </label>
          <textarea
            name="alasanTolak"
            rows={2}
            defaultValue={target.alasanTolak ?? ''}
            placeholder="Minimal 10 karakter, agar pendaftar tahu apa yang harus diperbaiki..."
            className="mt-1.5 w-full rounded-xl border border-kabut-200 bg-white p-3 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
          />
          <Galat medan="alasanTolak" />
        </div>
      )}

      {/* ===================== WILAYAH TEMPAT BERTUGAS ===================== */}
      <div className="rounded-xl bg-kabut-50 p-4 ring-1 ring-kabut-200">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-laut-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-tinta-700">
            Wilayah Tempat Bertugas
          </h4>
        </div>

        <div className="mt-3 space-y-3">
          <div>
            <label className={kelasLabel}>Jenis Fasilitas</label>
            {/*
              MEDAN YANG DINONAKTIFKAN TIDAK IKUT TERKIRIM.

              Ditemukan saat pengujian otomatis pada produksi: mengubah peran
              menjadi Dokter Spesialis Anak membuat medan ini terbaca
              'Rumah Sakit' di layar, namun `formData.get('jenisFaskes')`
              mengembalikan kosong, sehingga validasi justru meminta
              administrator "ubah Jenis Fasilitas menjadi Rumah Sakit" atas
              medan yang SUDAH bernilai itu. Penyebabnya aturan HTML: kontrol
              dengan atribut `disabled` tidak disertakan dalam pengiriman
              formulir.

              Tampilannya tetap terkunci, tetapi nilainya dititipkan pada
              medan tersembunyi di bawah ini.
            */}
            <select
              name={wajibRs ? undefined : 'jenisFaskes'}
              value={jenisFaskes}
              disabled={wajibRs}
              onChange={(e) =>
                setJenisFaskes(e.target.value as '' | 'puskesmas' | 'rumah_sakit')
              }
              className={`${kelasMedan} disabled:bg-kabut-100 disabled:text-tinta-500`}
            >
              {bolehTanpaWilayah && (
                <option value="">Tidak bertugas di wilayah mana pun</option>
              )}
              {!wajibRs && <option value="puskesmas">Puskesmas</option>}
              <option value="rumah_sakit">Rumah Sakit</option>
            </select>
            {wajibRs && <input type="hidden" name="jenisFaskes" value={jenisFaskes} />}
            {wajibRs && (
              <p className="mt-1 text-[11px] text-tinta-600">
                Dokter spesialis anak berada di ujung rantai rujukan Posyandu →
                Puskesmas → Rumah Sakit, sehingga jenis fasilitasnya tidak dapat
                diubah.
              </p>
            )}
            {bolehTanpaWilayah && jenisFaskes === '' && (
              <p className="mt-1 text-[11px] text-tinta-600">
                Administrator melihat seluruh data tanpa batas wilayah, sehingga
                puskesmas dan posyandu tidak perlu diisi.
              </p>
            )}
            <Galat medan="jenisFaskes" />
          </div>

          {jenisFaskes === 'rumah_sakit' && (
            <>
              <div>
                <label className={kelasLabel}>
                  Rumah Sakit <span className="text-bahaya-teks">*</span>
                </label>
                <select
                  name="rumahSakitId"
                  value={rumahSakitId}
                  onChange={(e) => setRumahSakitId(e.target.value)}
                  className={kelasMedan}
                >
                  <option value="">— Pilih rumah sakit —</option>
                  {daftarRumahSakit.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nama}
                    </option>
                  ))}
                  <option value={RS_BARU}>Rumah sakit lain — ketik namanya</option>
                </select>
                {daftarRumahSakit.length === 0 && (
                  <p className="mt-1 text-[11px] text-tinta-600">
                    Belum ada rumah sakit terdaftar. Pilih &quot;Rumah sakit lain&quot;
                    lalu tuliskan namanya; data itu langsung tersimpan sebagai
                    fasilitas baru.
                  </p>
                )}
                <Galat medan="rumahSakitId" />
              </div>

              {rumahSakitId === RS_BARU && (
                <div>
                  <label className={kelasLabel}>
                    Nama Rumah Sakit <span className="text-bahaya-teks">*</span>
                  </label>
                  <input
                    type="text"
                    name="namaRsBaru"
                    list="saran-rumah-sakit"
                    value={namaRsBaru}
                    onChange={(e) => setNamaRsBaru(e.target.value)}
                    placeholder="Ketik atau pilih dari saran..."
                    className={kelasMedan}
                  />
                  {/*
                    Saran diambil dari RUMAH_SAKIT_GORONTALO di
                    src/lib/db/wilayah.ts, yaitu daftar yang sudah ada di
                    dalam proyek ini. Tidak ada satu pun nama yang
                    ditanamkan ke database sampai administrator memilihnya
                    dan menyimpan.
                  */}
                  <datalist id="saran-rumah-sakit">
                    {RUMAH_SAKIT_GORONTALO.map((r) => (
                      <option key={r.id} value={r.nama} />
                    ))}
                  </datalist>
                  <Galat medan="namaRsBaru" />
                </div>
              )}
            </>
          )}

          {(jenisFaskes === 'puskesmas' || wajibPuskesmas) && (
            <div>
              <label className={kelasLabel}>
                Puskesmas{' '}
                {wajibPuskesmas && <span className="text-bahaya-teks">*</span>}
              </label>
              <select
                name="puskesmasId"
                value={puskesmasId}
                onChange={(e) => {
                  setPuskesmasId(e.target.value)
                  setPosyanduId('')
                }}
                className={kelasMedan}
              >
                <option value="">— Pilih puskesmas —</option>
                {daftarPuskesmas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
              <Galat medan="puskesmasId" />
            </div>
          )}

          {perluPosyandu && (
            <div>
              <label className={kelasLabel}>
                Posyandu <span className="text-bahaya-teks">*</span>
              </label>
              <select
                name="posyanduId"
                value={posyanduId}
                onChange={(e) => setPosyanduId(e.target.value)}
                className={kelasMedan}
              >
                <option value="">— Pilih posyandu —</option>
                {posyanduTersaring.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.desa ? `${p.nama} — ${p.desa}` : p.nama}
                  </option>
                ))}
              </select>
              {puskesmasId && posyanduTersaring.length === 0 && (
                <p className="mt-1 text-[11px] text-tinta-600">
                  Belum ada posyandu di bawah puskesmas ini.
                </p>
              )}
              <Galat medan="posyanduId" />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={kelasLabel}>Nomor WhatsApp / HP</label>
          <input
            type="tel"
            name="noHp"
            defaultValue={target.noHp ?? ''}
            placeholder="081234567890"
            className={kelasMedan}
          />
          <Galat medan="noHp" />
        </div>

        <div>
          <label className={kelasLabel}>
            Nomor STR {perluStr && <span className="text-bahaya-teks">*</span>}
          </label>
          <input
            type="text"
            name="noStr"
            defaultValue={target.noStr ?? ''}
            placeholder={perluStr ? 'Wajib, minimal 5 karakter' : 'Tidak wajib untuk peran ini'}
            className={kelasMedan}
          />
          <Galat medan="noStr" />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2.5 border-t border-kabut-200 pt-4">
        <button
          type="button"
          onClick={onBatal}
          className="rounded-xl px-4 py-2.5 text-xs font-bold text-tinta-600 hover:bg-kabut-100"
        >
          Batal
        </button>
        <Button type="submit" varian="utama" sedangProses={sedangProses}>
          Simpan Perubahan
        </Button>
      </div>
    </form>
  )
}
