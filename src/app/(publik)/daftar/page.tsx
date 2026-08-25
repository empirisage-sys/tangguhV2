'use client'

import { useState } from 'react'
import Link from 'next/link'
import { daftar, type HasilTindakan } from './actions'
import { Button } from '@/components/ui/Button'
import {
  PROVINSI_INDONESIA,
  KABUPATEN_GORONTALO,
  getPuskesmasByKabupaten,
  getKabupatenByProvinsi,
} from '@/lib/db/wilayah'
import {
  PERAN_PENDAFTARAN,
  LABEL_PERAN,
  type PeranPendaftaran,
  type JenisFaskesPendaftaran,
} from '@/lib/validasi/pendaftaran'
import { Building2, Hospital, ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react'

export default function HalamanDaftar() {
  const [sedangProses, setSedangProses] = useState(false)
  const [hasil, setHasil] = useState<HasilTindakan | null>(null)

  // State Pilihan Pendaftaran Bertingkat
  const [peran, setPeran] = useState<PeranPendaftaran>('kader')
  const [provinsiId, setProvinsiId] = useState<string>('prov-75') // Default: Gorontalo
  const [kabupatenId, setKabupatenId] = useState<string>('kab-7571') // Default: Kota Gorontalo
  const [kabupatenManual, setKabupatenManual] = useState<string>('')

  const [jenisFaskes, setJenisFaskes] = useState<JenisFaskesPendaftaran>('puskesmas')
  const [faskesId, setFaskesId] = useState<string>('pus-7571-01')
  const [faskesManual, setFaskesManual] = useState<string>('')
  const [posyanduManual, setPosyanduManual] = useState<string>('')

  const isGorontalo = provinsiId === 'prov-75'
  const daftarKabupaten = getKabupatenByProvinsi(provinsiId)
  const daftarPuskesmas = isGorontalo && kabupatenId ? getPuskesmasByKabupaten(kabupatenId) : []

  // Handler Perubahan Provinsi
  const handleProvinsiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const prov = e.target.value
    setProvinsiId(prov)
    if (prov === 'prov-75') {
      setKabupatenId('kab-7571')
      setKabupatenManual('')
      const pus = getPuskesmasByKabupaten('kab-7571')
      setFaskesId(pus[0]?.id || 'lainnya')
    } else {
      setKabupatenId('')
      setKabupatenManual('')
      setFaskesId('')
    }
  }

  // Handler Perubahan Kabupaten
  const handleKabupatenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const kab = e.target.value
    setKabupatenId(kab)
    if (kab && isGorontalo) {
      const pus = getPuskesmasByKabupaten(kab)
      setFaskesId(pus[0]?.id || 'lainnya')
    } else {
      setFaskesId('')
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSedangProses(true)
    setHasil(null)

    const formData = new FormData(e.currentTarget)
    formData.set('provinsiId', provinsiId)
    formData.set('jenisFaskes', jenisFaskes)
    formData.set('peran', peran)

    const res = await daftar(formData)
    if (res && !res.ok) {
      setHasil(res)
      setSedangProses(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-kabut-50 px-4 py-12 sm:px-6">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header Branding */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-laut-500 to-laut-700 text-2xl font-black text-white shadow-lg shadow-laut-500/25">
              T
            </div>
          </Link>
          <h1 className="font-display mt-4 text-2xl font-extrabold text-tinta-900 sm:text-3xl">
            Pendaftaran Tenaga Kesehatan &amp; Kader
          </h1>
          <p className="mt-1.5 text-sm text-tinta-600">
            Aplikasi Deteksi Dini Stunting &amp; Intervensi Gizi Terintegrasi
          </p>
        </div>

        {/* Card Form */}
        <div className="rounded-3xl bg-white p-6 shadow-[var(--shadow-kartu)] sm:p-8">
          {hasil?.pesan && (
            <div className="mb-5 flex items-center gap-3 rounded-xl bg-bahaya-bg p-3.5 text-sm font-semibold text-bahaya-teks ring-1 ring-bahaya-garis">
              <ShieldAlert className="size-5 shrink-0" />
              <span>{hasil.pesan}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 1. PILIHAN PERAN */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                Peran Bertugas <span className="text-bahaya-teks">*</span>
              </label>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:gap-3">
                {PERAN_PENDAFTARAN.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeran(p)}
                    className={[
                      'min-h-12 rounded-xl p-2.5 text-center text-xs font-bold transition-all',
                      peran === p
                        ? 'bg-laut-600 text-white shadow-md shadow-laut-600/20'
                        : 'border border-kabut-200 bg-white text-tinta-700 hover:bg-kabut-100',
                    ].join(' ')}
                  >
                    {LABEL_PERAN[p]}
                  </button>
                ))}
              </div>
              <input type="hidden" name="peran" value={peran} />
            </div>

            {/* 2. JENJANG WILAYAH: PROVINSI & KABUPATEN/KOTA */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="provinsiId" className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                  1. Provinsi <span className="text-bahaya-teks">*</span>
                </label>
                <select
                  id="provinsiId"
                  name="provinsiId"
                  value={provinsiId}
                  onChange={handleProvinsiChange}
                  className="mt-1.5 h-12 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                >
                  {PROVINSI_INDONESIA.map((prov) => (
                    <option key={prov.id} value={prov.id}>
                      {prov.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="kabupatenId" className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                  2. Kabupaten / Kota <span className="text-bahaya-teks">*</span>
                </label>
                {isGorontalo ? (
                  <select
                    id="kabupatenId"
                    name="kabupatenId"
                    value={kabupatenId}
                    onChange={handleKabupatenChange}
                    className="mt-1.5 h-12 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                  >
                    {daftarKabupaten.map((kab) => (
                      <option key={kab.id} value={kab.id}>
                        {kab.nama}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <input
                      id="kabupatenManual"
                      name="kabupatenManual"
                      type="text"
                      value={kabupatenManual}
                      onChange={(e) => setKabupatenManual(e.target.value)}
                      placeholder="Tuliskan nama Kabupaten / Kota..."
                      className="mt-1.5 h-12 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                      required={!isGorontalo}
                    />
                    <p className="mt-1 text-[11px] text-tinta-500">
                      Kabupaten/kota Anda akan diperiksa admin saat verifikasi.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 3. JENIS FASILITAS: KARTU BESAR (Puskesmas vs Rumah Sakit) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                3. Jenis Fasilitas Kesehatan <span className="text-bahaya-teks">*</span>
              </label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setJenisFaskes('puskesmas')}
                  className={[
                    'flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl p-3 text-xs font-bold transition-all cursor-pointer',
                    jenisFaskes === 'puskesmas'
                      ? 'border-2 border-laut-600 bg-laut-50/80 text-laut-900 shadow-sm ring-2 ring-laut-500/20'
                      : 'border border-kabut-200 bg-white text-tinta-700 hover:bg-kabut-50',
                  ].join(' ')}
                >
                  <Building2 className="size-5 text-laut-600" />
                  <span>Puskesmas</span>
                </button>

                <button
                  type="button"
                  onClick={() => setJenisFaskes('rumah_sakit')}
                  className={[
                    'flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl p-3 text-xs font-bold transition-all cursor-pointer',
                    jenisFaskes === 'rumah_sakit'
                      ? 'border-2 border-laut-600 bg-laut-50/80 text-laut-900 shadow-sm ring-2 ring-laut-500/20'
                      : 'border border-kabut-200 bg-white text-tinta-700 hover:bg-kabut-50',
                  ].join(' ')}
                >
                  <Hospital className="size-5 text-laut-600" />
                  <span>Rumah Sakit</span>
                </button>
              </div>
              <input type="hidden" name="jenisFaskes" value={jenisFaskes} />
            </div>

            {/* 4. NAMA FASILITAS KESEHATAN */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                4. Nama Fasilitas ({jenisFaskes === 'puskesmas' ? 'Puskesmas' : 'Rumah Sakit'}){' '}
                <span className="text-bahaya-teks">*</span>
              </label>

              {/* Kasus A: Rumah Sakit -> SELALU Isian Manual */}
              {jenisFaskes === 'rumah_sakit' && (
                <div className="mt-1.5 space-y-1">
                  <input
                    type="text"
                    name="faskesManual"
                    value={faskesManual}
                    onChange={(e) => setFaskesManual(e.target.value)}
                    placeholder="Tuliskan nama Rumah Sakit (misal: RSUD Prof. Dr. Aloei Saboe)..."
                    className="h-12 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                    required
                  />
                  <p className="text-[11px] text-tinta-500">
                    Dokter spesialis/nakes rumah sakit akan mengelola data pasien yang dicatat sendiri atau melalui rujukan.
                  </p>
                </div>
              )}

              {/* Kasus B: Puskesmas di Gorontalo -> Dropdown Master + Pilihan "Lainnya" */}
              {jenisFaskes === 'puskesmas' && isGorontalo && (
                <div className="mt-1.5 space-y-2">
                  <select
                    name="faskesId"
                    value={faskesId}
                    onChange={(e) => setFaskesId(e.target.value)}
                    className="h-12 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                  >
                    {daftarPuskesmas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama}
                      </option>
                    ))}
                    <option value="lainnya">Lainnya, tidak ada dalam daftar</option>
                  </select>

                  {faskesId === 'lainnya' && (
                    <input
                      type="text"
                      name="faskesManual"
                      value={faskesManual}
                      onChange={(e) => setFaskesManual(e.target.value)}
                      placeholder="Ketik nama Puskesmas Anda yang tidak tercantum..."
                      className="h-12 w-full rounded-xl border border-amber-300 bg-amber-50/50 px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                      required
                    />
                  )}
                </div>
              )}

              {/* Kasus C: Puskesmas di Luar Gorontalo -> Isian Manual */}
              {jenisFaskes === 'puskesmas' && !isGorontalo && (
                <div className="mt-1.5 space-y-1">
                  <input
                    type="text"
                    name="faskesManual"
                    value={faskesManual}
                    onChange={(e) => setFaskesManual(e.target.value)}
                    placeholder="Tuliskan nama Puskesmas tempat Anda bertugas..."
                    className="h-12 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                    required
                  />
                  <p className="text-[11px] text-tinta-500">
                    Fasilitas usulan akan dinormalkan oleh admin saat verifikasi akun.
                  </p>
                </div>
              )}
            </div>

            {/* 5. NAMA POSYANDU (KHUSUS KADER, SELALU ISIAN MANUAL) */}
            {peran === 'kader' && jenisFaskes !== 'rumah_sakit' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                  5. Nama Posyandu <span className="text-bahaya-teks">*</span>
                </label>
                <input
                  type="text"
                  name="posyanduManual"
                  value={posyanduManual}
                  onChange={(e) => setPosyanduManual(e.target.value)}
                  placeholder="Tuliskan nama Posyandu (misal: Posyandu Melati Dulalowo)..."
                  className="mt-1.5 h-12 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                  required
                />
                <p className="mt-1 text-[11px] text-tinta-500">
                  Nama posyandu selalu diisi manual dan akan diverifikasi serta dinormalkan oleh admin.
                </p>
              </div>
            )}

            {/* 6. IDENTITAS PRIBADI: NAMA, EMAIL, NO HP, STR */}
            <div className="space-y-4 border-t border-kabut-200 pt-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                  Nama Lengkap &amp; Gelar <span className="text-bahaya-teks">*</span>
                </label>
                <input
                  type="text"
                  name="namaLengkap"
                  placeholder="Contoh: dr. Fadel Mohammad / Siti Rahma, S.Gz / Amina (Kader)"
                  className="mt-1.5 h-12 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                    Alamat Email Aktif <span className="text-bahaya-teks">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    placeholder="nama@puskesmas.go.id"
                    className="mt-1.5 h-12 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                    Nomor WhatsApp / HP <span className="text-bahaya-teks">*</span>
                  </label>
                  <input
                    type="tel"
                    name="noHp"
                    placeholder="081234567890"
                    className="mt-1.5 h-12 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Nomor STR khusus Dokter dan Dietisien */}
              {peran !== 'kader' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                    Nomor STR (Surat Tanda Registrasi) <span className="text-bahaya-teks">*</span>
                  </label>
                  <input
                    type="text"
                    name="noStr"
                    placeholder="Nomor STR resmi tenaga kesehatan..."
                    className="mt-1.5 h-12 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                    required
                  />
                  <p className="mt-1 text-[11px] text-tinta-500">
                    Admin akan memverifikasi nomor STR sebelum akun diaktifkan.
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                    Kata Sandi <span className="text-bahaya-teks">*</span>
                  </label>
                  <input
                    type="password"
                    name="sandi"
                    placeholder="Minimal 8 karakter..."
                    className="mt-1.5 h-12 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                    Ulangi Kata Sandi <span className="text-bahaya-teks">*</span>
                  </label>
                  <input
                    type="password"
                    name="ulangiSandi"
                    placeholder="Ketik ulang kata sandi..."
                    className="mt-1.5 h-12 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Persetujuan Pengolahan Data UU PDP */}
            <div className="rounded-xl bg-kabut-50 p-3.5 ring-1 ring-kabut-200">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-tinta-700">
                <input
                  type="checkbox"
                  name="setujuKetentuan"
                  className="mt-0.5 size-4 rounded text-laut-600 focus:ring-laut-500"
                  required
                />
                <span>
                  Saya menyetujui pengolahan data pribadi dan data kesehatan balita sesuai standar kerahasiaan medis dan peraturan perundang-undangan (UU PDP).
                </span>
              </label>
            </div>

            {/* Tombol Submit */}
            <Button type="submit" varian="utama" lebarPenuh sedangProses={sedangProses}>
              <UserCheck className="size-4" />
              Daftar Akun Tenaga Kesehatan / Kader
            </Button>
          </form>

          {/* Footer Link ke Login */}
          <p className="mt-6 text-center text-xs text-tinta-600">
            Sudah memiliki akun resmi?{' '}
            <Link href="/masuk" className="font-bold text-laut-600 hover:text-laut-700">
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
