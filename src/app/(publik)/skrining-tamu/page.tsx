'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Calculator,
  ChevronRight,
  Printer,
  RotateCcw,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Scale,
  CheckCircle2,
} from 'lucide-react'
import {
  hitungSkrining,
  hitungUsiaKoreksi,
  hitungVelocity,
  apakahPerluPKMK,
  type HasilSkrining,
  type HasilVelocity,
  type PosisiUkur,
} from '@/lib/zscore'
import { tampilanBBTB, tampilanBBU, tampilanTBU, tampilanVelocity } from '@/lib/tampilan/status'
import { LencanaStatus } from '@/components/ui/LencanaStatus'
import { PitaZScore } from '@/components/skrining/PitaZScore'
import { PanelKurva } from '@/components/grafik/PanelKurva'
import { FormulasiPKMKSection } from '@/components/dietisien/FormulasiPKMKSection'
import { formatTanggal, formatZ } from '@/lib/tampilan/format'
import { Button } from '@/components/ui/Button'
import type { KunjunganRiwayat } from '@/lib/grafik/seri'

/* ─── Helper: format umur kalender ───────────────────────────────────────── */
function formatUmurKalender(tanggalLahir: string, tanggalPeriksa: string): string {
  try {
    const lahir = new Date(tanggalLahir + 'T00:00:00Z')
    const periksa = new Date(tanggalPeriksa + 'T00:00:00Z')
    let y = periksa.getUTCFullYear() - lahir.getUTCFullYear()
    let m = periksa.getUTCMonth() - lahir.getUTCMonth()
    let d = periksa.getUTCDate() - lahir.getUTCDate()
    if (d < 0) { const prev = new Date(Date.UTC(periksa.getUTCFullYear(), periksa.getUTCMonth(), 0)); d += prev.getUTCDate(); m-- }
    if (m < 0) { m += 12; y-- }
    const totalHari = Math.round((periksa.getTime() - lahir.getTime()) / 86_400_000)
    const parts: string[] = []
    if (y > 0) parts.push(`${y} Thn`)
    if (m > 0 || y > 0) parts.push(`${m} Bln`)
    parts.push(`${d} Hr`)
    return `${parts.join(' ')} (${totalHari} Hari)`
  } catch {
    return '—'
  }
}

/* ─── Helper: hitung tanggal lahir koreksi ───────────────────────────────── */
function tanggalLahirKoreksi(tanggalLahir: string, defisitHari: number): string {
  try {
    const ms = new Date(tanggalLahir + 'T00:00:00Z').getTime()
    return new Date(ms + defisitHari * 86_400_000).toISOString().slice(0, 10)
  } catch {
    return tanggalLahir
  }
}

/* ─── Komponen Utama ─────────────────────────────────────────────────────── */
export default function HalamanSkriningTamu() {
  const [langkah, setLangkah] = useState<1 | 2 | 3>(1)
  const [error, setError] = useState<string | null>(null)

  // Identitas
  const [nama, setNama] = useState('')
  const [jenisKelamin, setJenisKelamin] = useState<'lk' | 'pr'>('lk')
  const [tanggalLahir, setTanggalLahir] = useState('')
  // Inisialisasi kosong untuk hindari hydration mismatch SSR vs client
  const [tanggalPeriksa, setTanggalPeriksa] = useState('')

  // Set tanggal hari ini hanya di client setelah mount
  useEffect(() => {
    if (!tanggalPeriksa) {
      setTanggalPeriksa(new Date().toISOString().slice(0, 10))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Prematuritas
  const [isPrematur, setIsPrematur] = useState(false)
  const [usiaGestasiMinggu, setUsiaGestasiMinggu] = useState(32)

  // Antropometri
  const [beratKg, setBeratKg] = useState('')
  const [panjangCm, setPanjangCm] = useState('')
  const [posisiUkur, setPosisiUkur] = useState<PosisiUkur>('otomatis')
  const [lilaCm, setLilaCm] = useState('')
  const [lingkarKepalaCm, setLingkarKepalaCm] = useState('')
  const [edema, setEdema] = useState(false)

  // Hasil
  const [hasil, setHasil] = useState<HasilSkrining | null>(null)
  const [riwayat, setRiwayat] = useState<KunjunganRiwayat[]>([])

  // Evaluasi Weight Increment (Opsional untuk Tamu)
  const [sertakanVelocity, setSertakanVelocity] = useState(false)
  const [tanggalSebelumnya, setTanggalSebelumnya] = useState('')
  const [beratSebelumnyaKg, setBeratSebelumnyaKg] = useState('')
  const [hasilVelocity, setHasilVelocity] = useState<HasilVelocity | null>(null)

  // Kalkulasi prematur realtime (hanya untuk tampilan info)
  const defisitMinggu = isPrematur ? Math.max(0, 40 - usiaGestasiMinggu) : 0
  const defisitHari = defisitMinggu * 7

  // Umur kronologis (untuk tampilan di step 1)
  const teksUmurKronologis = tanggalLahir && tanggalPeriksa
    ? formatUmurKalender(tanggalLahir, tanggalPeriksa)
    : '—'

  // Umur koreksi (untuk tampilan di step 1)
  const tglEfektif = isPrematur && defisitHari > 0
    ? tanggalLahirKoreksi(tanggalLahir, defisitHari)
    : tanggalLahir
  const teksUmurKoreksi = tanggalLahir && tanggalPeriksa && isPrematur
    ? formatUmurKalender(tglEfektif, tanggalPeriksa)
    : null

  const pindahLangkah = useCallback((target: 1 | 2 | 3) => {
    setError(null)
    setLangkah(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleHitung = useCallback(() => {
    setError(null)

    // Validasi input
    if (!tanggalLahir) { setError('Tanggal lahir belum diisi.'); return }
    if (!tanggalPeriksa) { setError('Tanggal periksa belum diisi.'); return }

    const bb = parseFloat(beratKg.replace(',', '.'))
    const tb = parseFloat(panjangCm.replace(',', '.'))

    if (!beratKg || isNaN(bb) || bb <= 0) { setError('Masukkan berat badan yang valid (contoh: 9.2)'); return }
    if (!panjangCm || isNaN(tb) || tb <= 0) { setError('Masukkan panjang/tinggi badan yang valid (contoh: 78.5)'); return }

    // Hitung tanggal efektif (dengan koreksi prematur jika berlaku)
    const tglLahirEfektif = isPrematur && defisitHari > 0
      ? tanggalLahirKoreksi(tanggalLahir, defisitHari)
      : tanggalLahir

    try {
      const res = hitungSkrining({
        tanggalLahir: tglLahirEfektif,
        tanggalPeriksa,
        jenisKelamin,
        beratKg: bb,
        panjangCm: tb,
        posisiUkur,
        lilaCm: lilaCm ? parseFloat(lilaCm.replace(',', '.')) : undefined,
        edema,
      })

      setHasil(res)
      setRiwayat([{
        tanggalPeriksa,
        umurBulan: res.umurBulan,
        beratKg: bb,
        panjangTerkoreksiCm: res.panjangTerkoreksiCm,
        standarPanjang: res.standarPanjang,
        zBbu: res.bbu.z,
        zTbu: res.tbu.z,
        zBbtb: res.bbtb.z,
      }])

      // Hitung velocity jika diaktifkan
      if (sertakanVelocity && tanggalSebelumnya && beratSebelumnyaKg) {
        const bPrev = parseFloat(beratSebelumnyaKg.replace(',', '.'))
        if (!isNaN(bPrev) && bPrev > 0) {
          const vel = hitungVelocity({
            tanggalLahir: tglLahirEfektif,
            jenisKelamin,
            tanggalAwal: tanggalSebelumnya,
            beratAwalKg: bPrev,
            tanggalAkhir: tanggalPeriksa,
            beratAkhirKg: bb,
          })
          setHasilVelocity(vel)
        } else {
          setHasilVelocity(null)
        }
      } else {
        setHasilVelocity(null)
      }

      pindahLangkah(3)
    } catch (err) {
      setError(
        err instanceof Error
          ? `Gagal menghitung: ${err.message}`
          : 'Gagal menghitung status gizi. Periksa kembali data yang dimasukkan.',
      )
    }
  }, [
    tanggalLahir,
    tanggalPeriksa,
    jenisKelamin,
    beratKg,
    panjangCm,
    posisiUkur,
    lilaCm,
    edema,
    isPrematur,
    defisitHari,
    sertakanVelocity,
    tanggalSebelumnya,
    beratSebelumnyaKg,
    pindahLangkah,
  ])

  const statusTB = hasil ? tampilanTBU(hasil.statusTBU) : null
  const statusBB = hasil ? tampilanBBTB(hasil.statusBBTB) : null
  const statusBBU = hasil ? tampilanBBU(hasil.statusBBU) : null

  const perluPKMK = hasil
    ? apakahPerluPKMK({
        statusBBTB: hasil.statusBBTB,
        statusTBU: hasil.statusTBU,
        statusBBU: hasil.statusBBU,
        statusVelocity: hasilVelocity?.status,
        edema,
      })
    : false

  return (
    <div className="min-h-screen bg-kabut-50 pb-16 text-tinta-900">
      {/* Navbar */}
      <header className="sticky top-0 z-30 border-b border-kabut-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-laut-500 to-laut-700 text-base font-black text-white shadow-md shadow-laut-500/20">
              T
            </div>
            <div>
              <span className="font-display text-base font-extrabold tracking-tight text-laut-900">TANGGUH</span>
              <span className="ml-1.5 rounded-full bg-karawo-100 px-2 py-0.5 text-[10px] font-bold text-karawo-700">Mode Tamu</span>
            </div>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden font-semibold text-tinta-400 sm:inline">Tanpa Perlu Registrasi</span>
            <Link href="/masuk" className="rounded-xl border border-kabut-200 bg-white px-3.5 py-1.5 font-bold text-laut-700 hover:bg-kabut-100">
              Masuk sebagai Dokter/Nakes
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-4xl px-4 sm:px-6">
        {/* Banner */}
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-laut-700 via-laut-600 to-cyan-600 p-5 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
              <Sparkles className="size-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold sm:text-xl">Kalkulator Skrining Antropometri &amp; Analisis Pertumbuhan</h1>
              <p className="text-xs text-white/90">Akses publik gratis standar baku WHO 2006 dan Kemenkes RI untuk deteksi dini stunting, wasting, dan evaluasi nutrisi klinis.</p>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-200">
            <span className="text-lg leading-none">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Step Tabs */}
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-white p-3 shadow-[var(--shadow-kartu)] ring-1 ring-kabut-200">
          {[
            { id: 1 as const, label: 'Identitas Balita' },
            { id: 2 as const, label: 'Pengukuran' },
            { id: 3 as const, label: 'Hasil & Analisis' },
          ].map((step, idx) => (
            <div key={step.id} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => {
                  if (step.id === 3 && !hasil) {
                    setError('Silakan lengkapi pengukuran terlebih dahulu, lalu klik "Hitung Status Gizi".')
                    return
                  }
                  pindahLangkah(step.id)
                }}
                className={[
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all',
                  langkah === step.id ? 'bg-laut-600 text-white shadow-sm' : 'text-tinta-600 hover:bg-kabut-50',
                ].join(' ')}
              >
                <span className={[
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                  langkah === step.id ? 'bg-white/20 text-white' : 'bg-kabut-200 text-tinta-700',
                ].join(' ')}>{step.id}</span>
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{step.id}</span>
              </button>
              {idx < 2 && <ChevronRight className="mx-1 size-4 shrink-0 text-kabut-300" />}
            </div>
          ))}
        </div>

        {/* ── LANGKAH 1 ─────────────────────────────────────── */}
        {langkah === 1 && (
          <div className="space-y-6 rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] sm:p-8">
            <div>
              <h2 className="font-display text-lg font-bold text-tinta-900">Langkah 1: Identitas &amp; Tanggal Pemeriksaan</h2>
              <p className="text-xs text-tinta-600">Masukkan tanggal lahir anak untuk menentukan umur kronologis dan standar baku WHO</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Nama */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">Nama Balita (Opsional)</label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Misal: Ananda Putri"
                  className="mt-1 h-12 w-full rounded-xl border border-kabut-200 bg-white px-4 text-sm font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                />
              </div>

              {/* Jenis Kelamin */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">Jenis Kelamin</label>
                <div className="mt-1 grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setJenisKelamin('lk')}
                    className={['flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all',
                      jenisKelamin === 'lk' ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-300' : 'border border-kabut-200 bg-white text-tinta-700 hover:bg-sky-50',
                    ].join(' ')}>👦 Laki-laki</button>
                  <button type="button" onClick={() => setJenisKelamin('pr')}
                    className={['flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all',
                      jenisKelamin === 'pr' ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-300' : 'border border-kabut-200 bg-white text-tinta-700 hover:bg-rose-50',
                    ].join(' ')}>👧 Perempuan</button>
                </div>
              </div>

              {/* Tanggal Lahir */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                  Tanggal Lahir <span className="text-red-500">*</span>
                </label>
                <input type="date" value={tanggalLahir}
                  onChange={(e) => setTanggalLahir(e.target.value)}
                  max={tanggalPeriksa}
                  className="mt-1 h-12 w-full rounded-xl border border-kabut-200 bg-white px-4 text-sm font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                />
              </div>

              {/* Tanggal Periksa */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">Tanggal Periksa / Penimbangan</label>
                <input type="date" value={tanggalPeriksa}
                  onChange={(e) => setTanggalPeriksa(e.target.value)}
                  className="mt-1 h-12 w-full rounded-xl border border-kabut-200 bg-white px-4 text-sm font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                />
              </div>

              {/* Prematuritas */}
              <div className="sm:col-span-2 rounded-xl border border-kabut-200 bg-kabut-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="prematurCheckbox" className="flex items-center gap-2 text-xs font-bold text-tinta-900 cursor-pointer">
                    <input id="prematurCheckbox" type="checkbox" checked={isPrematur}
                      onChange={(e) => setIsPrematur(e.target.checked)}
                      className="size-4 rounded text-laut-600 focus:ring-laut-500" />
                    Bayi Lahir Prematur (&lt; 37 Minggu Kehamilan)?
                  </label>
                  {isPrematur && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">Koreksi Aktif</span>
                  )}
                </div>

                {isPrematur && (
                  <div className="border-t border-kabut-200 pt-3">
                    <label className="block text-xs font-semibold text-tinta-700">Usia Kehamilan saat Lahir (Minggu Gestasi)</label>
                    <div className="mt-1 flex items-center gap-3">
                      <input type="number" min="24" max="36" value={usiaGestasiMinggu}
                        onChange={(e) => setUsiaGestasiMinggu(Math.max(24, Math.min(36, Number(e.target.value) || 32)))}
                        className="angka h-11 w-28 rounded-xl border border-kabut-200 bg-white px-3 text-sm font-bold text-tinta-900 focus:border-laut-500 focus:outline-none"
                      />
                      <span className="text-xs font-semibold text-tinta-600">
                        minggu — Defisit: <strong>{defisitMinggu} minggu / {defisitHari} hari</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Info Umur */}
            {tanggalLahir && tanggalPeriksa && (
              <div className="rounded-xl bg-laut-50 p-4 ring-1 ring-laut-200 space-y-2">
                <div className="flex flex-col justify-between gap-1 text-xs sm:flex-row sm:items-center">
                  <span className="font-semibold text-laut-800">Umur Kronologis:</span>
                  <span className="angka font-black text-laut-900">{teksUmurKronologis}</span>
                </div>
                {isPrematur && teksUmurKoreksi && (
                  <div className="flex flex-col justify-between gap-1 text-xs border-t border-laut-200 pt-2 sm:flex-row sm:items-center">
                    <span className="font-bold text-amber-800">Usia Koreksi (untuk Z-Score WHO):</span>
                    <span className="angka font-black text-amber-900">{teksUmurKoreksi}</span>
                  </div>
                )}
                <p className="text-[11px] text-laut-700">
                  {isPrematur
                    ? 'Z-Score & kurva pertumbuhan dievaluasi berdasarkan Usia Koreksi sesuai standar WHO/IDAI hingga usia 2 tahun.'
                    : 'Standar WHO 2006 berlaku untuk balita usia 0 hingga 60 bulan.'}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button type="button" onClick={() => pindahLangkah(2)} varian="utama">
                Lanjut ke Input Pengukuran
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── LANGKAH 2 ─────────────────────────────────────── */}
        {langkah === 2 && (
          <div className="space-y-6 rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] sm:p-8">
            <div>
              <h2 className="font-display text-lg font-bold text-tinta-900">Langkah 2: Pengukuran Antropometri</h2>
              <p className="text-xs text-tinta-600">Hasil penimbangan berat badan dan pengukuran panjang/tinggi badan</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Berat Badan */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                  Berat Badan (kg) <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <input type="number" step="0.01" min="0.5" max="40"
                    value={beratKg}
                    onChange={(e) => setBeratKg(e.target.value)}
                    placeholder="Contoh: 9.2"
                    className="angka h-12 w-full rounded-xl border border-kabut-200 bg-white px-4 pr-12 text-base font-bold text-tinta-900 focus:border-laut-500 focus:outline-none"
                  />
                  <span className="pointer-events-none absolute right-4 top-3.5 text-xs font-bold text-tinta-400">kg</span>
                </div>
              </div>

              {/* Panjang/Tinggi */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                  Panjang / Tinggi Badan (cm) <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <input type="number" step="0.1" min="30" max="140"
                    value={panjangCm}
                    onChange={(e) => setPanjangCm(e.target.value)}
                    placeholder="Contoh: 78.5"
                    className="angka h-12 w-full rounded-xl border border-kabut-200 bg-white px-4 pr-12 text-base font-bold text-tinta-900 focus:border-laut-500 focus:outline-none"
                  />
                  <span className="pointer-events-none absolute right-4 top-3.5 text-xs font-bold text-tinta-400">cm</span>
                </div>
              </div>

              {/* Posisi Ukur */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">Posisi Pengukuran</label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {(['otomatis', 'terlentang', 'berdiri'] as PosisiUkur[]).map((pos) => (
                    <button key={pos} type="button" onClick={() => setPosisiUkur(pos)}
                      className={['h-11 rounded-xl text-xs font-bold transition-all',
                        posisiUkur === pos ? 'bg-laut-600 text-white shadow-sm' : 'border border-kabut-200 bg-white text-tinta-700 hover:bg-kabut-50',
                      ].join(' ')}>
                      {pos === 'otomatis' ? 'Otomatis Standar' : pos === 'terlentang' ? 'Terlentang (PB)' : 'Berdiri (TB)'}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-tinta-400">Koreksi posisi ukur 0,7 cm dihitung otomatis bila posisi tidak sesuai standar usia.</p>
              </div>

              {/* LiLA */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">Lingkar Lengan Atas / LiLA (cm)</label>
                <input type="number" step="0.1" value={lilaCm} onChange={(e) => setLilaCm(e.target.value)} placeholder="Contoh: 13.5"
                  className="angka mt-1 h-12 w-full rounded-xl border border-kabut-200 bg-white px-4 text-sm font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none" />
              </div>

              {/* Lingkar Kepala */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">Lingkar Kepala (cm)</label>
                <input type="number" step="0.1" value={lingkarKepalaCm} onChange={(e) => setLingkarKepalaCm(e.target.value)} placeholder="Contoh: 46.0"
                  className="angka mt-1 h-12 w-full rounded-xl border border-kabut-200 bg-white px-4 text-sm font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none" />
              </div>

              {/* Edema */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">Edema Bilateral (Bengkak Kedua Punggung Kaki)</label>
                <div className="mt-2 flex items-center gap-6">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-tinta-700">
                    <input type="radio" name="edema" checked={!edema} onChange={() => setEdema(false)} className="size-4 text-laut-600" />
                    Tidak Ada Edema
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-red-600">
                    <input type="radio" name="edema" checked={edema} onChange={() => setEdema(true)} className="size-4 text-red-600" />
                    Ada Edema Bilateral (+)
                  </label>
                </div>
              </div>

              {/* Evaluasi Weight Increment Opsional */}
              <div className="sm:col-span-2 rounded-2xl border-2 border-dashed border-laut-200 bg-gradient-to-r from-laut-50/60 to-cyan-50/60 p-4 sm:p-5 transition-all">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-laut-600 text-white shadow-sm">
                      <TrendingUp className="size-5" />
                    </div>
                    <div>
                      <label htmlFor="velocityCheckbox" className="flex items-center gap-2 text-sm font-bold text-tinta-900 cursor-pointer">
                        <input
                          id="velocityCheckbox"
                          type="checkbox"
                          checked={sertakanVelocity}
                          onChange={(e) => setSertakanVelocity(e.target.checked)}
                          className="size-4 rounded text-laut-600 focus:ring-laut-500"
                        />
                        Evaluasi Kenaikan Berat Badan (Weight Increment WHO)?
                      </label>
                      <p className="text-xs text-tinta-600 mt-0.5">
                        Centang jika balita memiliki catatan berat badan sebelumnya untuk mendeteksi <em>Growth Faltering</em> (N/T).
                      </p>
                    </div>
                  </div>

                  {sertakanVelocity && (
                    <span className="self-start rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 ring-1 ring-emerald-300">
                      ✓ Fitur Aktif
                    </span>
                  )}
                </div>

                {sertakanVelocity && (
                  <div className="mt-4 border-t border-laut-200/80 pt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                        Tanggal Penimbangan Sebelumnya <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={tanggalSebelumnya}
                        onChange={(e) => setTanggalSebelumnya(e.target.value)}
                        max={tanggalPeriksa}
                        className="mt-1 h-12 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-tinta-700">
                        Berat Badan Sebelumnya (kg) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative mt-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.5"
                          max="40"
                          value={beratSebelumnyaKg}
                          onChange={(e) => setBeratSebelumnyaKg(e.target.value)}
                          placeholder="Contoh: 6.8"
                          className="angka h-12 w-full rounded-xl border border-kabut-200 bg-white px-3.5 pr-10 text-xs font-bold text-tinta-900 focus:border-laut-500 focus:outline-none"
                        />
                        <span className="pointer-events-none absolute right-3.5 top-3.5 text-xs font-bold text-tinta-400">kg</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button type="button" onClick={() => pindahLangkah(1)} varian="sekunder">
                <ArrowLeft className="size-4" />
                Kembali
              </Button>
              <Button type="button" onClick={handleHitung} varian="utama">
                <Calculator className="size-4" />
                Hitung Status Gizi &amp; Analisis Pertumbuhan
              </Button>
            </div>
          </div>
        )}

        {/* ── LANGKAH 3 ─────────────────────────────────────── */}
        {langkah === 3 && !hasil && (
          <div className="rounded-2xl bg-white p-8 shadow-[var(--shadow-kartu)] text-center space-y-4">
            <p className="text-lg">⚠️</p>
            <p className="font-bold text-tinta-900">Data belum dihitung</p>
            <p className="text-sm text-tinta-600">Silakan isi data pengukuran terlebih dahulu, lalu klik "Hitung Status Gizi &amp; Analisis Pertumbuhan".</p>
            <Button type="button" onClick={() => pindahLangkah(2)} varian="utama">
              Ke Form Pengukuran
            </Button>
          </div>
        )}

        {langkah === 3 && hasil && (
          <div className="space-y-6">
            {/* Kartu Hasil */}
            <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] sm:p-8">
              <div className="flex flex-col justify-between gap-3 border-b border-kabut-200 pb-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl font-bold text-tinta-900">Hasil Analisis Antropometri WHO</h2>
                    <span className="rounded-full bg-laut-100 px-2.5 py-0.5 text-xs font-bold text-laut-800">
                      {nama || 'Balita'} — {jenisKelamin === 'lk' ? 'Laki-laki' : 'Perempuan'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-tinta-600">
                    {isPrematur ? '⭐ Berbasis Usia Koreksi Prematuritas — ' : ''}
                    Standar Baku WHO Child Growth Standards 2006
                  </p>
                  {tanggalLahir && tanggalPeriksa && (
                    <p className="text-xs text-tinta-500">
                      Umur Kronologis: <strong>{teksUmurKronologis}</strong>
                      {isPrematur && teksUmurKoreksi && (
                        <> — Usia Koreksi: <strong className="text-amber-800">{teksUmurKoreksi}</strong></>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-kabut-200 bg-white px-3.5 py-2 text-xs font-bold text-tinta-700 shadow-sm hover:bg-kabut-100">
                    <Printer className="size-4" /> Cetak
                  </button>
                  <button type="button" onClick={() => { setHasil(null); pindahLangkah(1) }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-kabut-200 bg-white px-3.5 py-2 text-xs font-bold text-tinta-700 shadow-sm hover:bg-kabut-100">
                    <RotateCcw className="size-4" /> Skrining Ulang
                  </button>
                </div>
              </div>

              {/* 3 Status Indikator */}
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {[
                  { label: 'Panjang/Tinggi menurut Umur (TB/U)', status: statusTB, z: hasil.tbu.z },
                  { label: 'Berat menurut Panjang/Tinggi (BB/TB)', status: statusBB, z: hasil.bbtb.z },
                  { label: 'Berat Badan menurut Umur (BB/U)', status: statusBBU, z: hasil.bbu.z },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-kabut-200 bg-kabut-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-tinta-600">{item.label}</p>
                    <div className="mt-2">{item.status && <LencanaStatus status={item.status} />}</div>
                    <p className="angka mt-2 text-sm font-bold text-tinta-900">Z-Score: {formatZ(item.z)} SD</p>
                  </div>
                ))}
              </div>

              {/* Pita Z-Score */}
              <div className="mt-6">
                <PitaZScore indikator="bbtb" z={hasil.bbtb.z} label="Pita Z-Score BB/TB (Status Gizi Akut)" />
              </div>

              {/* Energi */}
              <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl bg-laut-50 p-4 text-xs ring-1 ring-laut-200 sm:grid-cols-4">
                <div><p className="text-laut-700">Berat Terukur</p><p className="angka text-base font-bold text-laut-900">{beratKg} kg</p></div>
                <div><p className="text-laut-700">Tinggi Terkoreksi</p><p className="angka text-base font-bold text-laut-900">{hasil.panjangTerkoreksiCm} cm</p></div>
                <div><p className="text-laut-700">Energi Pemeliharaan</p><p className="angka text-base font-bold text-laut-900">{hasil.gizi?.kaloriPemeliharaanKkal ?? '—'} kkal/hari</p></div>
                <div><p className="text-laut-700">Target Tumbuh Kejar</p><p className="angka text-base font-bold text-amber-800">{hasil.gizi?.kaloriCatchUpKkal ?? '—'} kkal/hari</p></div>
              </div>
            </div>

            {/* Kartu Evaluasi Weight Increment (Mode Tamu) */}
            {hasilVelocity && (
              <div
                className={[
                  'rounded-2xl p-6 shadow-sm ring-1 transition-all',
                  hasilVelocity.status === 'naik'
                    ? 'bg-emerald-50/70 ring-emerald-300'
                    : hasilVelocity.status === 'growth_faltering'
                      ? 'bg-amber-50/80 ring-amber-300'
                      : 'bg-rose-50/80 ring-rose-300',
                ].join(' ')}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        'flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm',
                        hasilVelocity.status === 'naik'
                          ? 'bg-emerald-600'
                          : hasilVelocity.status === 'growth_faltering'
                            ? 'bg-amber-500'
                            : 'bg-rose-600',
                      ].join(' ')}
                    >
                      <TrendingUp className="size-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-base font-bold text-tinta-900">
                          Evaluasi Weight Increment &amp; Growth Faltering (WHO)
                        </h3>
                        <span
                          className={[
                            'rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase',
                            hasilVelocity.status === 'naik'
                              ? 'bg-emerald-200 text-emerald-900'
                              : hasilVelocity.status === 'growth_faltering'
                                ? 'bg-amber-200 text-amber-900'
                                : 'bg-rose-200 text-rose-900',
                          ].join(' ')}
                        >
                          {hasilVelocity.status === 'naik'
                            ? 'Naik (N)'
                            : hasilVelocity.status === 'growth_faltering'
                              ? 'Growth Faltering (T)'
                              : 'Tidak Naik (T)'}
                        </span>
                      </div>
                      <p className="text-xs text-tinta-600 mt-0.5">
                        Membandingkan penimbangan {formatTanggal(tanggalSebelumnya)} ({beratSebelumnyaKg} kg) ➔ {formatTanggal(tanggalPeriksa)} ({beratKg} kg)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="rounded-xl bg-white/90 px-3.5 py-2 ring-1 ring-black/5 text-center">
                      <span className="text-[11px] text-tinta-500 block">Kenaikan Riil</span>
                      <span
                        className={[
                          'angka text-sm font-black',
                          hasilVelocity.kenaikanAktualGram > 0
                            ? 'text-emerald-700'
                            : hasilVelocity.kenaikanAktualGram === 0
                              ? 'text-tinta-800'
                              : 'text-rose-700',
                        ].join(' ')}
                      >
                        {hasilVelocity.kenaikanAktualGram > 0 ? `+${hasilVelocity.kenaikanAktualGram}` : hasilVelocity.kenaikanAktualGram} g
                      </span>
                    </div>

                    <div className="rounded-xl bg-white/90 px-3.5 py-2 ring-1 ring-black/5 text-center">
                      <span className="text-[11px] text-tinta-500 block">Target Min (P5)</span>
                      <span className="angka text-sm font-black text-laut-700">
                        {hasilVelocity.kenaikanMinimalGram !== null ? `+${hasilVelocity.kenaikanMinimalGram} g` : '-'}
                      </span>
                    </div>

                    <div className="rounded-xl bg-white/90 px-3.5 py-2 ring-1 ring-black/5 text-center">
                      <span className="text-[11px] text-tinta-500 block">Jarak Waktu</span>
                      <span className="angka text-sm font-black text-tinta-900">
                        {hasilVelocity.selisihHari} hari
                      </span>
                    </div>
                  </div>
                </div>

                {hasilVelocity.status === 'growth_faltering' && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-100/90 p-2.5 text-xs text-amber-900">
                    <AlertTriangle className="size-4 shrink-0 text-amber-700 mt-0.5" />
                    <span>
                      <strong>Peringatan Dini:</strong> Kenaikan berat badan (+{hasilVelocity.kenaikanAktualGram} g) masih di bawah batas minimal baku WHO (+{hasilVelocity.kenaikanMinimalGram} g). Waspadai tanda awal gagal tumbuh sebelum berlanjut ke wasting atau stunting.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Kurva WHO */}
            <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] sm:p-8">
              <h2 className="font-display text-lg font-bold text-tinta-900 mb-1">Kurva Pertumbuhan WHO</h2>
              <p className="text-xs text-tinta-600 mb-4">Posisi titik hasil ukur pada kurva standar baku WHO {isPrematur && '(Berdasarkan Usia Koreksi)'}</p>
              <PanelKurva riwayat={riwayat} jenisKelaminAwal={jenisKelamin} peran="dokter" />
            </div>

            {/* Formulasi PKMK atau Edukasi Gizi Seimbang */}
            {perluPKMK ? (
              <FormulasiPKMKSection
                namaBalita={nama || 'Balita'}
                umurBulan={hasil.umurBulan}
                beratKg={parseFloat(beratKg) || 8}
                targetEnergiDefaultKkal={hasil.gizi?.kaloriCatchUpKkal || 770}
              />
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-emerald-950">
                      Status Pertumbuhan Baik — Tidak Memerlukan Tata Laksana PKMK
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                      Berdasarkan panduan klinis Kemenkes RI dan standar IDAI, balita dengan status pertumbuhan ini <strong>tidak memerlukan intervensi Pangan Olahan untuk Keperluan Medis Khusus (PKMK)</strong>.
                    </p>
                    <div className="mt-3 rounded-xl bg-white/80 p-3.5 ring-1 ring-emerald-200/80 text-xs text-tinta-700 space-y-1.5">
                      <p className="font-bold text-emerald-900">Rekomendasi Pemeliharaan Gizi &amp; Pola Asuh:</p>
                      <ul className="list-disc pl-4 space-y-1 text-tinta-600">
                        <li>Cukupi kebutuhan kalori dan mikronutrien harian melalui makanan keluarga bergizi seimbang yang kaya protein hewani (telur, ikan, daging, ayam).</li>
                        <li>Lanjutkan pemberian ASI optimal hingga usia 2 tahun atau lebih sesuai usia balita.</li>
                        <li>Pantau penimbangan dan pengukuran panjang/tinggi badan rutin setiap bulan di Posyandu untuk memastikan grafik pertumbuhan terus naik (N).</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CTA Registrasi */}
            <div className="rounded-2xl border border-kabut-200 bg-white p-6 text-center shadow-sm">
              <h3 className="font-display text-base font-bold text-tinta-900">Ingin Menyimpan Riwayat &amp; Pemantauan Bulanan?</h3>
              <p className="mx-auto mt-1 max-w-xl text-xs text-tinta-600">Aplikasi TANGGUH terhubung langsung dengan kader posyandu dan puskesmas di 6 kabupaten/kota se-Provinsi Gorontalo.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Link href="/daftar" className="rounded-xl bg-laut-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-laut-700">Registrasi Akun Petugas</Link>
                <Link href="/masuk" className="rounded-xl border border-kabut-200 bg-white px-5 py-2.5 text-xs font-bold text-laut-700 hover:bg-kabut-100">Masuk sebagai Dokter/Nakes</Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
