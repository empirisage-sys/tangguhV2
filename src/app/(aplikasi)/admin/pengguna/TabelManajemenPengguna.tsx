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

export type PenggunaItem = {
  id: string
  namaLengkap: string
  role: 'kader' | 'dokter' | 'dietisien' | 'admin'
  noHp?: string | null
  noStr?: string | null
  statusAkun: 'menunggu' | 'disetujui' | 'ditolak'
  puskesmasNama?: string | null
  kabupatenNama?: string | null
  posyanduNama?: string | null
  createdAt?: string | null
}

const LABEL_PERAN: Record<string, { label: string; badge: string }> = {
  admin: { label: 'Administrator', badge: 'bg-tinta-900 text-white' },
  dokter: { label: 'Dokter', badge: 'bg-aman-bg text-aman-teks border border-aman-garis' },
  dietisien: { label: 'Dietisien / Nutrisionis', badge: 'bg-karawo-100 text-karawo-800 border border-karawo-300' },
  kader: { label: 'Kader Posyandu', badge: 'bg-laut-50 text-laut-800 border border-laut-200' },
}

const LABEL_STATUS: Record<string, { label: string; badge: string }> = {
  disetujui: { label: 'Aktif / Disetujui', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  menunggu: { label: 'Menunggu Verifikasi', badge: 'bg-amber-50 text-amber-800 border border-amber-200' },
  ditolak: { label: 'Ditolak', badge: 'bg-rose-50 text-rose-700 border border-rose-200' },
}

export function TabelManajemenPengguna({ daftar }: { daftar: PenggunaItem[] }) {
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
    const formData = new FormData(e.currentTarget)
    const res = await adminEditPengguna(formData)
    setSedangProses(false)

    if (res.ok) {
      showToast('sukses', res.pesan ?? 'Profil berhasil diperbarui.')
      setEditTarget(null)
    } else {
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
                            <p className="font-semibold text-tinta-800">
                              {item.puskesmasNama || 'Fasilitas Terdaftar'}
                            </p>
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

            <form onSubmit={handleEditSubmit} className="mt-5 space-y-4">
              <input type="hidden" name="penggunaId" value={editTarget.id} />

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                  Nama Lengkap &amp; Gelar
                </label>
                <input
                  type="text"
                  name="namaLengkap"
                  defaultValue={editTarget.namaLengkap}
                  required
                  className="mt-1.5 h-11 w-full rounded-xl border border-kabut-200 px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                    Peran Pengguna
                  </label>
                  <select
                    name="role"
                    defaultValue={editTarget.role}
                    className="mt-1.5 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                  >
                    <option value="kader">Kader Posyandu</option>
                    <option value="dokter">Dokter</option>
                    <option value="dietisien">Dietisien / Nutrisionis</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                    Status Akun
                  </label>
                  <select
                    name="statusAkun"
                    defaultValue={editTarget.statusAkun}
                    className="mt-1.5 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                  >
                    <option value="disetujui">Disetujui (Aktif Penuh)</option>
                    <option value="menunggu">Menunggu Verifikasi</option>
                    <option value="ditolak">Ditolak</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                    Nomor WhatsApp / HP
                  </label>
                  <input
                    type="tel"
                    name="noHp"
                    defaultValue={editTarget.noHp ?? ''}
                    placeholder="081234567890"
                    className="mt-1.5 h-11 w-full rounded-xl border border-kabut-200 px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                    Nomor STR (Khusus Dokter/Nakes)
                  </label>
                  <input
                    type="text"
                    name="noStr"
                    defaultValue={editTarget.noStr ?? ''}
                    placeholder="Nomor STR resmi..."
                    className="mt-1.5 h-11 w-full rounded-xl border border-kabut-200 px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2.5 pt-4 border-t border-kabut-200">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-tinta-600 hover:bg-kabut-100"
                >
                  Batal
                </button>
                <Button type="submit" varian="utama" sedangProses={sedangProses}>
                  Simpan Perubahan
                </Button>
              </div>
            </form>
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
