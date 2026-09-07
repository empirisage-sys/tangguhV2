'use client'

import { useState, useMemo } from 'react'
import {
  adminTambahProdukPKMK,
  adminEditProdukPKMK,
  adminToggleStatusPKMK,
  adminHapusProdukPKMK,
} from './actions'
import { type ProdukPKMK, hitungKkalPerSendok } from '@/lib/db/pkmk'
import { BATAS as BATAS_TAKARAN, hitungTakaran, type HasilTakaran } from '@/lib/pkmk/hitung'
import { bacaSeluruhPeringatan, ringkasanTakaran } from '@/lib/pkmk/teks'
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  Milk,
  CheckCircle2,
  AlertTriangle,
  X,
  Calculator,
  Sparkles,
  Layers,
  Flame,
  Info,
  Power,
  Droplets,
  Calendar,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

type Props = {
  daftarProduk: ProdukPKMK[]
}

export function TabelManajemenPKMK({ daftarProduk }: Props) {
  const [cari, setCari] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('semua')
  const [filterDensitas, setFilterDensitas] = useState<string>('semua')

  // Modals state
  const [modalTerbuka, setModalTerbuka] = useState(false)
  const [modeModal, setModeModal] = useState<'tambah' | 'edit'>('tambah')
  const [produkAktif, setProdukAktif] = useState<ProdukPKMK | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProdukPKMK | null>(null)
  const [simulatorTarget, setSimulatorTarget] = useState<ProdukPKMK | null>(null)

  // Form states
  const [formNama, setFormNama] = useState('')
  const [formMerek, setFormMerek] = useState('')
  const [formKkalPerSaji, setFormKkalPerSaji] = useState<number>(180)
  const [formSendokPerSaji, setFormSendokPerSaji] = useState<number>(5)
  const [formDensitas, setFormDensitas] = useState<number>(1.0)
  const [formMlAirPerSendok, setFormMlAirPerSendok] = useState<number>(30)
  const [formMlPerSaji, setFormMlPerSaji] = useState<number>(180)
  const [formMinUsia, setFormMinUsia] = useState<number>(12)
  const [formMaksUsia, setFormMaksUsia] = useState<number | string>('')
  const [formProtein, setFormProtein] = useState<number | string>('')
  const [formGramSendok, setFormGramSendok] = useState<number | string>('')
  const [formAnjuran, setFormAnjuran] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)

  // Simulation state inside modal
  const [simTargetKkal, setSimTargetKkal] = useState<number>(400)
  const [simFrekuensi, setSimFrekuensi] = useState<number>(3)

  // Loading & Toast state
  const [sedangProses, setSedangProses] = useState(false)
  const [toast, setToast] = useState<{ tipe: 'sukses' | 'galat'; pesan: string } | null>(null)

  const showToast = (tipe: 'sukses' | 'galat', pesan: string) => {
    setToast({ tipe, pesan })
    setTimeout(() => setToast(null), 4500)
  }

  // Perhitungan Kkal per Sendok Real-Time di Form
  const formKkalPerSendok = useMemo(() => {
    return hitungKkalPerSendok(formKkalPerSaji, formSendokPerSaji) ?? 0
  }, [formKkalPerSaji, formSendokPerSaji])

  // ==========================================================================
  // SIMULASI TAKARAN
  //
  // Memakai `hitungTakaran` dari `src/lib/pkmk/hitung.ts`, bukan lagi
  // `hitungFormulasiPKMK` yang sudah dihapus.
  //
  // Fungsi lama membulatkan dua kali lalu mengembalikan TARGET sebagai hasil,
  // tanpa pernah menghitung energi yang benar-benar diminum anak dan tanpa satu
  // pun peringatan. Pada sapuan 500 kombinasi, 23% menyimpang lebih dari 10%
  // dari target; terburuk +300% (SGM Optigrow, target 50 kkal, 5x sehari).
  // Ia juga menampilkan dua volume cairan yang saling bertentangan dalam satu
  // kartu, karena "Volume Cairan Total" dihitung dari target ÷ densitas
  // sementara "Air Hangat / Minum" dihitung dari sendok × ml air per sendok.
  // Lihat temuan audit T-1 dan T-2.
  //
  // `hitungTakaran` menjamin invarian: energi SELALU diturunkan ulang dari
  // takaran akhir setelah pembulatan sendok, dan volume larutan hanya berasal
  // dari satu jalur.
  // ==========================================================================

  /** Membatasi masukan simulator agar tidak menghasilkan angka mustahil (T-10). */
  const targetSimValid = Number.isFinite(simTargetKkal) && simTargetKkal >= 50
  const targetSimAman = targetSimValid ? Math.min(simTargetKkal, 1500) : 0

  const previewSimulasi = useMemo<HasilTakaran | null>(() => {
    if (!formKkalPerSendok || formKkalPerSendok <= 0) return null
    if (!targetSimValid) return null

    const mlLarutanPerSaji = formMlPerSaji || 180
    const dummy: ProdukPKMK = {
      id: 'preview',
      nama: formNama || 'Produk Uji',
      merek: formMerek || 'Merek',
      sendokPerSaji: formSendokPerSaji || 5,
      kkalPerSaji: formKkalPerSaji || 180,
      mlLarutanPerSaji,
      mlPerSaji: mlLarutanPerSaji,
      // Volume larutan per sendok DITURUNKAN dari volume per saji, bukan dari
      // takaran air. Air 30 ml per sendok tidak menghasilkan larutan 30 ml
      // karena bubuk menempati ruang (T-3).
      mlLarutanPerSendok: mlLarutanPerSaji / (formSendokPerSaji || 5),
      mlAirPerSendok: formMlAirPerSendok || 30,
      densitasKkalPerMl: (formKkalPerSaji || 180) / mlLarutanPerSaji,
      kkalPerMl: (formKkalPerSaji || 180) / mlLarutanPerSaji,
      kkalPerSendok: formKkalPerSendok,
      minUsiaBulan: formMinUsia || 12,
      catatanKlinis: formAnjuran,
      anjuranKlinis: formAnjuran,
    }
    return hitungTakaran({
      produk: dummy,
      mode: 'dari_target',
      frekuensiPerHari: simFrekuensi,
      targetKkal: targetSimAman,
    })
  }, [
    formNama,
    formMerek,
    formSendokPerSaji,
    formKkalPerSaji,
    formMlPerSaji,
    formMlAirPerSendok,
    formKkalPerSendok,
    formMinUsia,
    formAnjuran,
    targetSimValid,
    targetSimAman,
    simFrekuensi,
  ])

  // Filter logic
  const filteredProduk = useMemo(() => {
    return daftarProduk.filter((item) => {
      const cocokCari =
        item.nama.toLowerCase().includes(cari.toLowerCase()) ||
        item.merek.toLowerCase().includes(cari.toLowerCase()) ||
        (item.anjuranKlinis || item.catatanKlinis || '').toLowerCase().includes(cari.toLowerCase())

      const statusItem = item.isActive === false ? 'nonaktif' : 'aktif'
      const cocokStatus = filterStatus === 'semua' || statusItem === filterStatus

      const cocokDensitas =
        filterDensitas === 'semua' ||
        (filterDensitas === 'standar' && item.densitasKkalPerMl <= 1.0) ||
        (filterDensitas === 'padat' && item.densitasKkalPerMl > 1.0)

      return cocokCari && cocokStatus && cocokDensitas
    })
  }, [daftarProduk, cari, filterStatus, filterDensitas])

  // Reset & Buka Modal Tambah
  const bukaModalTambah = () => {
    setModeModal('tambah')
    setProdukAktif(null)
    setFormNama('')
    setFormMerek('')
    setFormKkalPerSaji(180)
    setFormSendokPerSaji(5)
    setFormDensitas(1.0)
    setFormMlAirPerSendok(30)
    setFormMlPerSaji(180)
    setFormMinUsia(12)
    setFormMaksUsia('')
    setFormProtein('')
    setFormGramSendok('')
    setFormAnjuran('Periksa label kemasan untuk indikasi usia dan cara penyiapan.')
    setFormIsActive(true)
    setSimTargetKkal(400)
    setSimFrekuensi(3)
    setModalTerbuka(true)
  }

  // Buka Modal Edit
  const bukaModalEdit = (p: ProdukPKMK) => {
    setModeModal('edit')
    setProdukAktif(p)
    setFormNama(p.nama)
    setFormMerek(p.merek)
    setFormKkalPerSaji(p.kkalPerSaji)
    setFormSendokPerSaji(p.sendokPerSaji)
    setFormDensitas(p.densitasKkalPerMl)
    setFormMlAirPerSendok(p.mlAirPerSendok ?? p.mlLarutanPerSendok ?? 30)
    setFormMlPerSaji(p.mlPerSaji ?? p.mlLarutanPerSaji ?? 180)
    setFormMinUsia(p.minUsiaBulan)
    setFormMaksUsia(p.maksUsiaBulan != null ? p.maksUsiaBulan : '')
    setFormProtein(p.proteinGPer100ml != null ? p.proteinGPer100ml : '')
    setFormGramSendok(p.gramPerSendokTakar != null ? p.gramPerSendokTakar : '')
    setFormAnjuran(p.anjuranKlinis ?? p.catatanKlinis ?? '')
    setFormIsActive(p.isActive !== false)
    setSimTargetKkal(400)
    setSimFrekuensi(3)
    setModalTerbuka(true)
  }

  // Simpan Form (Tambah / Edit)
  const handleSubmitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSedangProses(true)

    const formData = new FormData()
    if (modeModal === 'edit' && produkAktif) {
      formData.append('id', produkAktif.id)
    }
    formData.append('nama', formNama)
    formData.append('merek', formMerek)
    formData.append('kkalPerSaji', String(formKkalPerSaji))
    formData.append('sendokPerSaji', String(formSendokPerSaji))
    formData.append('densitasKkalPerMl', String(formDensitas))
    formData.append('mlAirPerSendok', String(formMlAirPerSendok))
    formData.append('mlPerSaji', String(formMlPerSaji))
    formData.append('minUsiaBulan', String(formMinUsia))
    if (formMaksUsia !== '') formData.append('maksUsiaBulan', String(formMaksUsia))
    if (formProtein !== '') formData.append('proteinGPer100ml', String(formProtein))
    if (formGramSendok !== '') formData.append('gramPerSendokTakar', String(formGramSendok))
    formData.append('anjuranKlinis', formAnjuran)
    formData.append('isActive', formIsActive ? 'true' : 'false')

    const res =
      modeModal === 'tambah'
        ? await adminTambahProdukPKMK(formData)
        : await adminEditProdukPKMK(formData)

    setSedangProses(false)

    if (res.ok) {
      showToast('sukses', res.pesan)
      setModalTerbuka(false)
    } else {
      showToast('galat', res.pesan)
    }
  }

  // Toggle Status Aktif / Non-Aktif
  const handleToggleStatus = async (p: ProdukPKMK) => {
    const statusBaru = !(p.isActive !== false)
    setSedangProses(true)
    const res = await adminToggleStatusPKMK(p.id, statusBaru)
    setSedangProses(false)

    if (res.ok) {
      showToast('sukses', res.pesan)
    } else {
      showToast('galat', res.pesan)
    }
  }

  // Hapus Produk
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setSedangProses(true)
    const res = await adminHapusProdukPKMK(deleteTarget.id)
    setSedangProses(false)

    if (res.ok) {
      showToast('sukses', res.pesan)
      setDeleteTarget(null)
    } else {
      showToast('galat', res.pesan)
    }
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

      {/* Toolbar: Search, Filter, & Tambah Produk */}
      <div className="flex flex-col gap-4 rounded-2xl border border-kabut-200 bg-white p-5 shadow-[var(--shadow-kartu)] md:flex-row md:items-center md:justify-between">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-tinta-400" />
          <input
            type="text"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama susu PKMK, merek produsen, atau anjuran klinis..."
            className="h-11 w-full rounded-xl border border-kabut-200 bg-kabut-50/50 pl-10 pr-4 text-xs font-semibold text-tinta-900 placeholder:text-tinta-400 focus:border-laut-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-laut-500/20"
          />
        </div>

        {/* Dropdown Filters & Tombol Tambah */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-xl border border-kabut-200 bg-white px-3 py-2 text-xs font-bold text-tinta-700">
            <Filter className="size-3.5 text-tinta-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filter status produk PKMK"
              className="bg-transparent font-bold text-tinta-900 focus:outline-none"
            >
              <option value="semua">Semua Status</option>
              <option value="aktif">Status: Aktif</option>
              <option value="nonaktif">Status: Non-Aktif</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-kabut-200 bg-white px-3 py-2 text-xs font-bold text-tinta-700">
            <Flame className="size-3.5 text-karawo-500" />
            <select
              value={filterDensitas}
              onChange={(e) => setFilterDensitas(e.target.value)}
              aria-label="Filter densitas kalori produk"
              className="bg-transparent font-bold text-tinta-900 focus:outline-none"
            >
              <option value="semua">Semua Densitas</option>
              <option value="standar">Standar (1,0 kkal/ml)</option>
              <option value="padat">Padat Energi (&gt;1,0 kkal/ml)</option>
            </select>
          </div>

          <Button
            type="button"
            onClick={bukaModalTambah}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-laut-600 px-4 text-xs font-bold text-white shadow-md shadow-laut-600/20 hover:bg-laut-700"
          >
            <Plus className="size-4" />
            <span>Tambah Produk Susu PKMK</span>
          </Button>
        </div>
      </div>

      {/* Daftar Produk PKMK Table */}
      <div className="overflow-hidden rounded-2xl border border-kabut-200 bg-white shadow-[var(--shadow-kartu)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-kabut-200 bg-kabut-50 text-[11px] font-bold uppercase tracking-wider text-tinta-500">
              <tr>
                <th className="px-5 py-4">Produk Susu &amp; Merek</th>
                <th className="px-4 py-4 text-center">Spesifikasi Saji</th>
                <th className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Sparkles className="size-3.5 text-karawo-600" />
                    <span>Kkal / Sendok Takar</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-center">Densitas &amp; Takaran Air</th>
                <th className="px-4 py-4 text-center">Rentang Usia</th>
                <th className="px-4 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-right">Aksi Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kabut-100">
              {filteredProduk.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-tinta-500">
                    <Milk className="mx-auto mb-2 size-8 text-tinta-300" />
                    <p className="font-semibold text-tinta-700">
                      Tidak ada produk susu PKMK yang sesuai dengan filter.
                    </p>
                    <p className="mt-1 text-xs text-tinta-500">
                      Gunakan tombol &quot;Tambah Produk Susu PKMK&quot; di atas untuk mendaftarkan formula baru.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProduk.map((item) => {
                  const kkalSendok =
                    item.kkalPerSendok ||
                    hitungKkalPerSendok(item.kkalPerSaji, item.sendokPerSaji) ||
                    0
                  const isActive = item.isActive !== false

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-kabut-50/70 ${
                        !isActive ? 'bg-kabut-50/40 opacity-70' : ''
                      }`}
                    >
                      {/* Nama & Merek */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-laut-50 text-laut-700 ring-1 ring-laut-200">
                            <Milk className="size-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-tinta-900">{item.nama}</span>
                              {item.densitasKkalPerMl > 1.0 && (
                                <span className="rounded-md bg-karawo-100 px-1.5 py-0.5 text-[10px] font-bold text-karawo-700">
                                  Tinggi Kalori
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-tinta-500">
                              Merek: <span className="font-semibold text-tinta-700">{item.merek}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Spesifikasi Saji */}
                      <td className="px-4 py-4 text-center">
                        <div className="font-mono text-xs font-bold text-tinta-900">
                          {item.kkalPerSaji} kkal
                        </div>
                        <div className="text-[11px] text-tinta-500">
                          per {item.sendokPerSaji} sendok takar
                        </div>
                      </td>

                      {/* Kkal per Sendok (Highlight Utama D-5 & S-2) */}
                      <td className="px-4 py-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-laut-100 px-2.5 py-1 font-mono text-xs font-black text-laut-800 ring-1 ring-laut-200">
                            <Flame className="size-3 text-amber-500" />
                            {kkalSendok.toFixed(1)} kkal / sdk
                          </span>
                          <span className="mt-0.5 text-[10px] text-tinta-400">
                            ({item.kkalPerSaji} ÷ {item.sendokPerSaji})
                          </span>
                        </div>
                      </td>

                      {/* Densitas & Air */}
                      <td className="px-4 py-4 text-center">
                        <div className="font-mono text-xs font-semibold text-tinta-900">
                          {item.densitasKkalPerMl.toFixed(2)} kkal/ml
                        </div>
                        <div className="text-[11px] text-tinta-500">
                          {item.mlAirPerSendok} ml air / sendok
                        </div>
                      </td>

                      {/* Rentang Usia */}
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center gap-1 rounded-md bg-kabut-100 px-2 py-0.5 text-[11px] font-semibold text-tinta-700">
                          <Calendar className="size-3 text-tinta-500" />
                          ≥ {item.minUsiaBulan} bln
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              isActive ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                          />
                          {isActive ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </td>

                      {/* Aksi Admin */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Test Simulator Button */}
                          <button
                            type="button"
                            onClick={() => setSimulatorTarget(item)}
                            title="Uji Simulator Resep Susu"
                            className="rounded-lg p-2 text-tinta-600 hover:bg-laut-50 hover:text-laut-700"
                          >
                            <Calculator className="size-4" />
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => bukaModalEdit(item)}
                            title="Edit Spesifikasi Produk"
                            className="rounded-lg p-2 text-tinta-600 hover:bg-kabut-100 hover:text-tinta-900"
                          >
                            <Edit2 className="size-4" />
                          </button>

                          {/* Toggle Status Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(item)}
                            disabled={sedangProses}
                            title={isActive ? 'Nonaktifkan Produk' : 'Aktifkan Produk'}
                            className={`rounded-lg p-2 ${
                              isActive
                                ? 'text-amber-600 hover:bg-amber-50 hover:text-amber-700'
                                : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                          >
                            <Power className="size-4" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            title="Hapus Produk dari Master Data"
                            className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 className="size-4" />
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

      {/* MODAL: Tambah / Edit Produk Susu PKMK */}
      {modalTerbuka && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative my-8 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl md:p-8">
            <div className="flex items-center justify-between border-b border-kabut-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-laut-100 text-laut-800">
                  <Milk className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-tinta-900 sm:text-xl">
                    {modeModal === 'tambah'
                      ? 'Tambah Produk Susu PKMK Baru'
                      : `Edit Produk: ${produkAktif?.nama}`}
                  </h3>
                  <p className="text-xs text-tinta-500">
                    Input spesifikasi kalori (kkal), takaran sendok, dan densitas formula medis
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalTerbuka(false)}
                className="rounded-xl p-1.5 text-tinta-400 hover:bg-kabut-100 hover:text-tinta-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="mt-6 space-y-6">
              {/* Seksi 1: Identitas Produk */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-tinta-500">
                  1. Identitas Produk Susu
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-tinta-700">
                      Nama Produk Susu PKMK <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formNama}
                      onChange={(e) => setFormNama(e.target.value)}
                      placeholder="Contoh: SGM Gain 100, Nutrinidrink"
                      className="mt-1 h-11 w-full rounded-xl border border-kabut-200 bg-kabut-50/50 px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-laut-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-tinta-700">
                      Merek / Pabrikan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formMerek}
                      onChange={(e) => setFormMerek(e.target.value)}
                      placeholder="Contoh: SGM, Nutricia, Kalbe, Danone"
                      className="mt-1 h-11 w-full rounded-xl border border-kabut-200 bg-kabut-50/50 px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-laut-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Seksi 2: Spesifikasi Kalori & Takaran Sendok (FITUR UTAMA) */}
              <div className="space-y-4 rounded-2xl border border-laut-200 bg-laut-50/40 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-laut-800">
                    <Flame className="size-4 text-amber-500" />
                    <span>2. Spesifikasi Kalori &amp; Sendok Takar (D-5 &amp; S-2)</span>
                  </h4>
                  <span className="rounded-full bg-laut-200/70 px-2 py-0.5 text-[10px] font-bold text-laut-800">
                    Auto-Calculated
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-tinta-700">
                      Kalori per Saji (kkal) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={10}
                      max={2000}
                      step="any"
                      value={formKkalPerSaji}
                      onChange={(e) => setFormKkalPerSaji(Number(e.target.value))}
                      placeholder="Contoh: 180"
                      className="font-mono mt-1 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-bold text-tinta-900 focus:border-laut-500 focus:outline-none focus:ring-2 focus:ring-laut-500/20"
                    />
                    <p className="mt-1 text-[11px] text-tinta-500">
                      Total energi dalam 1 porsi saji standar kemasan.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-tinta-700">
                      Jumlah Sendok Takar per Saji <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={30}
                      value={formSendokPerSaji}
                      onChange={(e) => setFormSendokPerSaji(Number(e.target.value))}
                      placeholder="Contoh: 5"
                      className="font-mono mt-1 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-bold text-tinta-900 focus:border-laut-500 focus:outline-none focus:ring-2 focus:ring-laut-500/20"
                    />
                    <p className="mt-1 text-[11px] text-tinta-500">
                      Berapa sendok takar untuk membuat 1 porsi saji di atas.
                    </p>
                  </div>
                </div>

                {/* DISPLAY HASIL PERHITUNGAN OTOMATIS: KKAL PER SENDOK */}
                <div className="rounded-xl border border-laut-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-laut-700">
                        Hasil Perhitungan Kalori per Sendok Takar
                      </span>
                      <p className="text-xs text-tinta-500">
                        {formKkalPerSaji} kkal ÷ {formSendokPerSaji} sendok takar
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-2xl font-black text-laut-800 sm:text-3xl">
                        {formKkalPerSendok.toFixed(1)}
                      </span>
                      <span className="text-xs font-bold text-laut-700">kkal / sendok</span>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-start gap-2 border-t border-kabut-100 pt-2 text-[11px] text-tinta-600">
                    <Info className="size-3.5 shrink-0 text-laut-600 mt-0.5" />
                    <span>
                      <strong>Satu Sumber Kebenaran:</strong> Sistem menghitung angka ini secara presisi per produk untuk menghindari kesalahan dosis klinis yang terjadi pada versi purwarupa lama (angka statis 25 kkal).
                    </span>
                  </div>
                </div>

                {/* Detail Pelarutan & Densitas */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-tinta-700">
                      Densitas (kkal/ml) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={0.5}
                      max={3.0}
                      step={0.01}
                      value={formDensitas}
                      onChange={(e) => setFormDensitas(Number(e.target.value))}
                      className="font-mono mt-1 h-10 w-full rounded-xl border border-kabut-200 bg-white px-3 text-xs font-bold text-tinta-900 focus:border-laut-500 focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-tinta-500">
                      1.0 = standar, 1.5 = padat kalori
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-tinta-700">
                      Air per Sendok (ml) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={10}
                      max={100}
                      step={0.5}
                      value={formMlAirPerSendok}
                      onChange={(e) => setFormMlAirPerSendok(Number(e.target.value))}
                      className="font-mono mt-1 h-10 w-full rounded-xl border border-kabut-200 bg-white px-3 text-xs font-bold text-tinta-900 focus:border-laut-500 focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-tinta-500">
                      Air hangat per 1 sendok takar
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-tinta-700">
                      Volume per Saji (ml) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={20}
                      max={500}
                      value={formMlPerSaji}
                      onChange={(e) => setFormMlPerSaji(Number(e.target.value))}
                      className="font-mono mt-1 h-10 w-full rounded-xl border border-kabut-200 bg-white px-3 text-xs font-bold text-tinta-900 focus:border-laut-500 focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-tinta-500">
                      Total cairan jadi 1 porsi saji
                    </p>
                  </div>
                </div>
              </div>

              {/* Seksi 3: Sasaran Usia, Protein, & Bobot Sendok */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-tinta-500">
                  3. Sasaran Usia &amp; Nutrisi Tambahan
                </h4>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-semibold text-tinta-700">
                      Min Usia (bln) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={60}
                      value={formMinUsia}
                      onChange={(e) => setFormMinUsia(Number(e.target.value))}
                      className="font-mono mt-1 h-10 w-full rounded-xl border border-kabut-200 bg-kabut-50/50 px-3 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-tinta-700">
                      Maks Usia (bln)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={formMaksUsia}
                      onChange={(e) => setFormMaksUsia(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Opsi (60)"
                      className="font-mono mt-1 h-10 w-full rounded-xl border border-kabut-200 bg-kabut-50/50 px-3 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-tinta-700">
                      Protein (g/100ml)
                    </label>
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      value={formProtein}
                      onChange={(e) => setFormProtein(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Cth: 2.6"
                      className="font-mono mt-1 h-10 w-full rounded-xl border border-kabut-200 bg-kabut-50/50 px-3 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-tinta-700">
                      Gram/Sendok (g)
                    </label>
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      value={formGramSendok}
                      onChange={(e) => setFormGramSendok(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Cth: 9.2"
                      className="font-mono mt-1 h-10 w-full rounded-xl border border-kabut-200 bg-kabut-50/50 px-3 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Seksi 4: Anjuran Klinis & Status */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-tinta-500">
                  4. Anjuran Klinis &amp; Ketersediaan
                </h4>
                <div>
                  <label className="block text-xs font-semibold text-tinta-700">
                    Anjuran Klinis / Petunjuk Penyiapan
                  </label>
                  <textarea
                    rows={2}
                    value={formAnjuran}
                    onChange={(e) => setFormAnjuran(e.target.value)}
                    placeholder="Contoh: Periksa label kemasan untuk indikasi usia dan cara penyiapan."
                    className="mt-1 w-full rounded-xl border border-kabut-200 bg-kabut-50/50 p-3 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-laut-500/20"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActiveCheck"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="size-4 rounded border-kabut-300 text-laut-600 focus:ring-laut-500"
                  />
                  <label htmlFor="isActiveCheck" className="text-xs font-semibold text-tinta-800">
                    Aktifkan produk ini (tampilkan dalam dropdown modul formulasi dietisien)
                  </label>
                </div>
              </div>

              {/* Seksi 5: Live Simulator Resep Pra-Simpan */}
              {previewSimulasi && (
                <div className="rounded-2xl border border-karawo-200 bg-karawo-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-karawo-800">
                      <Calculator className="size-4 text-karawo-600" />
                      <span>Uji Coba Simulator Resep Praktis</span>
                    </span>
                    <span className="text-[10px] text-karawo-700">
                      Simulasi takaran otomatis
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-white p-2.5 text-center shadow-xs">
                      <span className="text-[10px] text-tinta-500">Target Tambahan</span>
                      <p className="font-mono text-xs font-bold text-tinta-900">
                        {previewSimulasi.targetKkal} kkal/hari
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 text-center shadow-xs">
                      <span className="text-[10px] text-tinta-500">Takaran per Minum</span>
                      <p className="font-mono text-xs font-bold text-laut-700">
                        {previewSimulasi.sendokPerSaji} sendok
                      </p>
                    </div>
                    {/* Energi NYATA, bukan target. Inilah invarian T-1. */}
                    <div className="rounded-xl bg-white p-2.5 text-center shadow-xs ring-1 ring-laut-200">
                      <span className="text-[10px] text-tinta-500">Energi Diberikan</span>
                      <p className="font-mono text-xs font-black text-laut-800">
                        {previewSimulasi.kkalDiberikan} kkal
                      </p>
                      <p className="text-[10px] text-tinta-400">
                        {previewSimulasi.persenTerhadapTarget}% target
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 text-center shadow-xs">
                      <span className="text-[10px] text-tinta-500">Larutan / Saji</span>
                      <p className="font-mono text-xs font-bold text-laut-700">
                        {previewSimulasi.mlLarutanPerSaji} ml
                      </p>
                      <p className="text-[10px] text-tinta-400">
                        {previewSimulasi.mlLarutanPerHari} ml/hari
                      </p>
                    </div>
                  </div>

                  {bacaSeluruhPeringatan(previewSimulasi).map((p) => (
                    <div
                      key={p.kode}
                      className={[
                        'mt-2 rounded-xl border p-2.5 text-[11px] leading-relaxed',
                        p.nada === 'bahaya'
                          ? 'border-rose-300 bg-rose-50 text-rose-900'
                          : 'border-amber-300 bg-amber-50 text-amber-900',
                      ].join(' ')}
                    >
                      <p className="font-bold">{p.pesan}</p>
                      <p className="mt-0.5">{p.saran}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-kabut-200 pt-4">
                <Button
                  type="button"
                  varian="sekunder"
                  onClick={() => setModalTerbuka(false)}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={sedangProses}
                  className="rounded-xl bg-laut-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-laut-700"
                >
                  {sedangProses ? 'Menyimpan...' : modeModal === 'tambah' ? 'Simpan Produk Baru' : 'Perbarui Produk'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Standalone Simulator Resep Produk */}
      {simulatorTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative my-8 w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl md:p-8">
            <div className="flex items-center justify-between border-b border-kabut-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-karawo-100 text-karawo-800">
                  <Calculator className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-tinta-900">
                    Simulator Resep: {simulatorTarget.nama}
                  </h3>
                  <p className="text-xs text-tinta-500">
                    Kkal per sendok: {simulatorTarget.kkalPerSendok} kkal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSimulatorTarget(null)}
                className="rounded-xl p-1.5 text-tinta-400 hover:bg-kabut-100 hover:text-tinta-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-tinta-700">
                    Target Kalori Tambahan (kkal)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={1500}
                    step={50}
                    value={simTargetKkal}
                    onChange={(e) => setSimTargetKkal(Number(e.target.value))}
                    className="font-mono mt-1 h-10 w-full rounded-xl border border-kabut-200 px-3 text-xs font-bold text-tinta-900 focus:border-laut-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-tinta-700">
                    Frekuensi Minum per Hari
                  </label>
                  <select
                    value={simFrekuensi}
                    onChange={(e) => setSimFrekuensi(Number(e.target.value))}
                    className="mt-1 h-10 w-full rounded-xl border border-kabut-200 bg-white px-3 text-xs font-bold text-tinta-900 focus:border-laut-500 focus:outline-none"
                  >
                    {Array.from(
                      { length: BATAS_TAKARAN.frekuensiMaks - BATAS_TAKARAN.frekuensiMin + 1 },
                      (_, i) => BATAS_TAKARAN.frekuensiMin + i,
                    ).map((f) => (
                      <option key={f} value={f}>
                        {f} kali sehari
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kartu Hasil: energi NYATA, satu jalur volume, dan peringatan */}
              {(() => {
                if (!targetSimValid) {
                  return (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
                      Masukkan target kalori tambahan minimal 50 kkal per hari untuk melihat
                      rekomendasi takaran.
                    </div>
                  )
                }

                const res = hitungTakaran({
                  produk: simulatorTarget,
                  mode: 'dari_target',
                  frekuensiPerHari: simFrekuensi,
                  targetKkal: targetSimAman,
                })
                const peringatan = bacaSeluruhPeringatan(res)

                return (
                  <div className="space-y-3 rounded-2xl border border-laut-200 bg-laut-50/60 p-4">
                    <h4 className="text-xs font-bold text-laut-800">
                      Rekomendasi Takaran Klinis:
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-white p-3 shadow-xs">
                        <span className="text-[10px] text-tinta-500">Takaran Tiap Minum</span>
                        <p className="font-mono text-base font-extrabold text-laut-800">
                          {res.sendokPerSaji} sendok takar
                        </p>
                        <p className="text-[10px] text-tinta-400">
                          {res.frekuensiPerHari}x sehari — total {res.sendokPerHari} sendok/hari
                        </p>
                      </div>

                      {/*
                        ENERGI YANG BENAR-BENAR DIBERIKAN, bukan target.
                        Versi sebelumnya tidak menampilkan angka ini sama sekali,
                        sehingga kartu bisa menyiratkan target tercapai padahal
                        takarannya menyimpang sampai +300% (temuan T-1).
                      */}
                      <div className="rounded-xl bg-white p-3 shadow-xs ring-1 ring-laut-300">
                        <span className="text-[10px] text-tinta-500">Energi Diberikan</span>
                        <p className="font-mono text-base font-black text-laut-800">
                          {res.kkalDiberikan} kkal / hari
                        </p>
                        <p className="text-[10px] text-tinta-400">
                          {res.persenTerhadapTarget}% dari target {res.targetKkal} kkal
                          {res.selisihKkal !== 0 &&
                            ` (${res.selisihKkal > 0 ? '+' : ''}${res.selisihKkal} kkal)`}
                        </p>
                      </div>

                      {/*
                        SATU jalur volume. Versi sebelumnya menampilkan
                        "Air Hangat / Minum" (sendok x ml air) berdampingan
                        dengan "Volume Cairan Total" (target / densitas) yang
                        bisa berselisih 200 ml untuk resep yang sama (temuan T-2).
                      */}
                      <div className="rounded-xl bg-white p-3 shadow-xs">
                        <span className="text-[10px] text-tinta-500">Larutan Jadi / Saji</span>
                        <p className="font-mono text-base font-extrabold text-laut-800">
                          {res.mlLarutanPerSaji} ml
                        </p>
                        <p className="text-[10px] text-tinta-400">
                          Air per sendok menurut label: {simulatorTarget.mlAirPerSendok ?? '-'} ml
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-3 shadow-xs">
                        <span className="text-[10px] text-tinta-500">Larutan Jadi / Hari</span>
                        <p className="font-mono text-base font-extrabold text-laut-800">
                          {res.mlLarutanPerHari} ml
                        </p>
                        <p className="text-[10px] text-tinta-400">
                          {res.kkalPerSendok.toFixed(1)} kkal per sendok takar
                        </p>
                      </div>
                    </div>

                    {peringatan.length > 0 && (
                      <div className="space-y-2">
                        {peringatan.map((p) => (
                          <div
                            key={p.kode}
                            className={[
                              'flex items-start gap-2 rounded-xl border p-3 text-[11px] leading-relaxed',
                              p.nada === 'bahaya'
                                ? 'border-rose-300 bg-rose-50 text-rose-900'
                                : 'border-amber-300 bg-amber-50 text-amber-900',
                            ].join(' ')}
                          >
                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                            <span>
                              <strong>{p.pesan}</strong> {p.saran}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="border-t border-laut-200 pt-2 text-[11px] leading-relaxed text-laut-900">
                      {ringkasanTakaran(res)}
                    </p>
                  </div>
                )
              })()}

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  varian="sekunder"
                  onClick={() => setSimulatorTarget(null)}
                  className="rounded-xl px-5 py-2 text-xs font-bold"
                >
                  Tutup Simulator
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Hapus Produk */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-rose-100">
                <ShieldAlert className="size-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-tinta-900">
                Hapus Produk Susu PKMK?
              </h3>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-tinta-600">
              Apakah Anda yakin ingin menghapus produk{' '}
              <strong className="text-tinta-900">&quot;{deleteTarget.nama}&quot;</strong> dari master data?
            </p>
            <p className="mt-2 rounded-xl bg-rose-50 p-3 text-[11px] text-rose-700">
              Produk yang sudah pernah tercatat pada rekam medis asuhan gizi balita tidak dapat dihapus permanen demi integritas audit klinis. Bila tidak lagi diedarkan, gunakan opsi nonaktifkan.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                type="button"
                varian="sekunder"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl px-4 py-2 text-xs font-bold"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={sedangProses}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
              >
                {sedangProses ? 'Menghapus...' : 'Ya, Hapus Produk'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
