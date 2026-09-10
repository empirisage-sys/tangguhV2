'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, ChevronRight, Sparkles, AlertCircle, WifiOff, TrendingUp, AlertTriangle } from 'lucide-react'
import type { BalitaDetail } from '@/lib/db/balita'
import {
  hitungSkrining,
  hitungUmurKalender,
  hitungVelocity,
  tanggalLahirEfektif,
  tanggalValid,
} from '@/lib/zscore'
import type { HasilSkrining, PosisiUkur } from '@/lib/zscore/tipe'
import { InputAngka } from '@/components/ui/InputAngka'
import { Button } from '@/components/ui/Button'
import { KartuHasil } from '@/components/skrining/KartuHasil'
import { simpanKeOutbox } from '@/lib/offline/outbox'
import { simpanSkrining } from './actions'
import { formatTanggal, formatGramBertanda } from '@/lib/tampilan/format'
import { sumberAmbangVelocity } from '@/lib/tampilan/status'

/**
 * Formulir pencatatan skrining.
 *
 * ==========================================================================
 * TAHAP 2a: BALITA DATANG SEBAGAI PROP, BUKAN DICARI DI MEMORI
 *
 * Bentuk lama adalah halaman `'use client'` yang memanggil `cariBalitaById(id)`
 * pada `SAMPLE_BALITA_DATABASE` — senarai yang isinya `[]`. Karena itu halaman
 * ini SELALU menampilkan "Data Balita Tidak Ditemukan", dan tidak satu pun
 * skrining dapat dicatat lewat aplikasi.
 *
 * Pembacaan sekarang dilakukan komponen server `page.tsx` di folder ini, yang
 * meneruskan balitanya ke sini. Komponen ini tetap klien karena seluruh
 * perhitungan seketika dan antrean offline berjalan di perangkat kader.
 * ==========================================================================
 */
export function FormulirSkriningBaru({ balita }: { balita: BalitaDetail }) {
  const router = useRouter()

  const [langkah, setLangkah] = useState<1 | 2 | 3>(1)
  const [tanggalPeriksa, setTanggalPeriksa] = useState<string>(
    new Date().toISOString().slice(0, 10),
  )

  const [beratKg, setBeratKg] = useState<string>('8.0')
  const [panjangCm, setPanjangCm] = useState<string>('78.0')
  const [posisiUkur, setPosisiUkur] = useState<PosisiUkur>('otomatis')
  const [lilaCm, setLilaCm] = useState<string>('')
  const [lingkarKepalaCm, setLingkarKepalaCm] = useState<string>('')
  const [edema, setEdema] = useState<boolean>(false)
  const [catatan, setCatatan] = useState<string>('')

  const [clientUuid, setClientUuid] = useState<string>('')
  const [hasilInstan, setHasilInstan] = useState<HasilSkrining | null>(null)
  const [sedangSimpan, setSedangSimpan] = useState<boolean>(false)
  const [pesanGalat, setPesanGalat] = useState<string | null>(null)

  useEffect(() => {
    // Generate UUID idempoten di browser
    if (!clientUuid) {
      setClientUuid(crypto.randomUUID())
    }
  }, [clientUuid])

  if (!balita) {
    // Tidak akan tercapai: `page.tsx` sudah memanggil notFound(). Dipertahankan
    // sebagai jaring pengaman tipe saja.
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-[var(--shadow-kartu)] space-y-3">
        <p className="text-base font-bold text-tinta-900">Data Balita Tidak Ditemukan</p>
        <p className="text-xs text-tinta-600">Pastikan ID balita yang Anda akses sudah terdaftar di sistem.</p>
        <Link href="/balita" className="inline-block rounded-xl bg-laut-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-laut-700 transition-colors">
          Kembali ke Data Balita
        </Link>
      </div>
    )
  }

  // Dihitung sekali, dengan penjaga, lalu dipakai di JSX.
  const umurSaatDitimbang = tanggalValid(tanggalPeriksa)
    ? hitungUmurKalender(balita.tanggalLahir, tanggalPeriksa)
    : null

  const hitungHasilLokal = () => {
    const b = Number(beratKg.replace(',', '.'))
    const p = Number(panjangCm.replace(',', '.'))
    const l = lilaCm ? Number(lilaCm.replace(',', '.')) : undefined
    const lk = lingkarKepalaCm ? Number(lingkarKepalaCm.replace(',', '.')) : undefined

    if (isNaN(b) || isNaN(p) || b <= 0 || p <= 0) {
      setPesanGalat('Masukkan angka berat dan panjang badan yang valid.')
      return null
    }

    try {
      // ==================================================================
      // TEMUAN AUDIT T-2: JALUR NAKES TIDAK PERNAH MEMAKAI USIA GESTASI
      //
      // `usia_gestasi_minggu` dicatat saat pendaftaran balita dan tersimpan di
      // database, tetapi tidak satu pun jalur skrining pernah membacanya.
      // Akibatnya bayi prematur dinilai dengan umur kronologis penuh.
      //
      // Bayi umur 6 bulan yang lahir 32 minggu, 6,5 kg, 63 cm:
      //   dengan koreksi   -> Z TB/U -0,623  status NORMAL
      //   tanpa koreksi    -> Z TB/U -2,191  status PENDEK
      //
      // Selisih 1,57 SD, dan arahnya menghasilkan diagnosis stunting PALSU
      // pada bayi prematur — pada aplikasi yang tugasnya mendeteksi stunting.
      // ==================================================================
      const res = hitungSkrining({
        tanggalLahir: balita.tanggalLahir,
        tanggalPeriksa,
        jenisKelamin: balita.jenisKelamin === 'L' ? 'lk' : 'pr',
        beratKg: b,
        panjangCm: p,
        posisiUkur,
        lilaCm: l,
        edema,
        usiaGestasiMinggu: balita.usiaGestasiMinggu,
      })
      setHasilInstan(res)
      setPesanGalat(null)
      return res
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghitung Z-Score'
      setPesanGalat(msg)
      return null
    }
  }

  const lanjutKeLangkah2 = () => {
    if (!tanggalPeriksa) {
      setPesanGalat('Pilih tanggal pemeriksaan.')
      return
    }
    if (!tanggalValid(tanggalPeriksa)) {
      setPesanGalat('Tanggal pemeriksaan belum lengkap atau tidak masuk akal. Periksa kembali tahunnya.')
      return
    }
    setPesanGalat(null)
    setLangkah(2)
  }

  const lanjutKeLangkah3 = () => {
    const res = hitungHasilLokal()
    if (res) {
      setLangkah(3)
    }
  }

  const handleSimpan = async () => {
    setSedangSimpan(true)
    setPesanGalat(null)

    const b = Number(beratKg.replace(',', '.'))
    const p = Number(panjangCm.replace(',', '.'))
    const l = lilaCm ? Number(lilaCm.replace(',', '.')) : undefined
    const lk = lingkarKepalaCm ? Number(lingkarKepalaCm.replace(',', '.')) : undefined

    const hasil = hasilInstan || hitungHasilLokal()
    if (!hasil) {
      setSedangSimpan(false)
      return
    }

    // Satu tempat penyusunan baris antrean, dipakai jalur offline maupun jalur
    // penyelamatan setelah server gagal (temuan audit S-1).
    const keOutbox = () =>
      simpanKeOutbox({
        clientUuid,
        balitaId: balita.id,
        namaBalita: balita.nama,
        posyanduId: balita.posyanduId,
        puskesmasId: balita.puskesmasId,
        kabupatenId: balita.kabupatenId,
        masukan: {
          balitaId: balita.id,
          tanggalPeriksa,
          beratKg: b,
          panjangCm: p,
          posisiUkur,
          lilaCm: l,
          lingkarKepalaCm: lk,
          edema,
          catatan,
          clientUuid,
        },
        hasilLokal: hasil,
      })

    // Jika offline, simpan langsung ke outbox IndexedDB
    if (!navigator.onLine) {
      try {
        await keOutbox()
        router.push(`/balita/${balita.id}`)
        return
      } catch {
        setPesanGalat('Gagal menyimpan ke penyimpanan lokal offline.')
        setSedangSimpan(false)
        return
      }
    }

    // Jika online, kirim ke Server Action
    const formData = new FormData()
    formData.set('balitaId', balita.id)
    formData.set('tanggalPeriksa', tanggalPeriksa)
    formData.set('beratKg', String(b))
    formData.set('panjangCm', String(p))
    formData.set('posisiUkur', posisiUkur)
    if (l) formData.set('lilaCm', String(l))
    if (lk) formData.set('lingkarKepalaCm', String(lk))
    formData.set('edema', String(edema))
    if (catatan) formData.set('catatan', catatan)
    formData.set('clientUuid', clientUuid)

    try {
      const res = await simpanSkrining(formData)
      if (res && !res.ok) {
        // Kegagalan yang masih dapat diselamatkan: simpan ke antrean perangkat
        // agar hasil penimbangan tidak hilang. Tanpa ini, `navigator.onLine`
        // yang bernilai true pada jaringan tanpa rute keluar membuat data
        // dibuang begitu saja (temuan audit S-1).
        if (res.simpanKeOutbox) {
          try {
            await keOutbox()
            setPesanGalat(
              `${res.pesan ?? 'Server tidak dapat dihubungi.'} Data sudah disimpan di perangkat ` +
                'dan akan dikirim sendiri saat jaringan kembali.',
            )
            setSedangSimpan(false)
            return
          } catch {
            setPesanGalat(
              `${res.pesan ?? 'Server tidak dapat dihubungi.'} Penyimpanan di perangkat juga ` +
                'gagal, jadi data ini BELUM tersimpan. Catat angkanya di kertas sebelum ' +
                'meninggalkan halaman ini.',
            )
            setSedangSimpan(false)
            return
          }
        }

        setPesanGalat(res.pesan || 'Gagal menyimpan ke server.')
        setSedangSimpan(false)
      }
    } catch {
      // Pada saat redirect, Server Action melempar NEXT_REDIRECT
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/balita/${balita.id}`}
          className="flex size-10 items-center justify-center rounded-xl bg-white text-tinta-600 ring-1 ring-kabut-200 hover:bg-kabut-100"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-tinta-900">
            Pencatatan Antropometri
          </h1>
          <p className="text-xs text-tinta-600">
            Balita: <span className="font-bold text-tinta-900">{balita.nama}</span> ({balita.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'})
          </p>
        </div>
      </div>

      {/* 3-Step Wizard Indicator */}
      <div className="flex items-center justify-between rounded-2xl bg-white p-3.5 shadow-[var(--shadow-kartu)]">
        <div
          onClick={() => setLangkah(1)}
          className={[
            'flex cursor-pointer items-center gap-2 text-xs font-bold transition-colors',
            langkah === 1 ? 'text-laut-700' : 'text-tinta-400',
          ].join(' ')}
        >
          <span
            className={[
              'flex size-6 items-center justify-center rounded-full text-[11px]',
              langkah === 1
                ? 'bg-laut-600 text-white'
                : langkah > 1
                  ? 'bg-aman-bg text-aman-teks ring-1 ring-aman-garis'
                  : 'bg-kabut-100 text-tinta-600',
            ].join(' ')}
          >
            {langkah > 1 ? '✓' : '1'}
          </span>
          <span className="hidden sm:inline">Tanggal & Balita</span>
        </div>

        <div className="h-0.5 flex-1 bg-kabut-200 mx-2" />

        <div
          onClick={() => (tanggalPeriksa ? setLangkah(2) : null)}
          className={[
            'flex cursor-pointer items-center gap-2 text-xs font-bold transition-colors',
            langkah === 2 ? 'text-laut-700' : 'text-tinta-400',
          ].join(' ')}
        >
          <span
            className={[
              'flex size-6 items-center justify-center rounded-full text-[11px]',
              langkah === 2
                ? 'bg-laut-600 text-white'
                : langkah > 2
                  ? 'bg-aman-bg text-aman-teks ring-1 ring-aman-garis'
                  : 'bg-kabut-100 text-tinta-600',
            ].join(' ')}
          >
            {langkah > 2 ? '✓' : '2'}
          </span>
          <span className="hidden sm:inline">Pengukuran</span>
        </div>

        <div className="h-0.5 flex-1 bg-kabut-200 mx-2" />

        <div
          className={[
            'flex items-center gap-2 text-xs font-bold transition-colors',
            langkah === 3 ? 'text-laut-700' : 'text-tinta-400',
          ].join(' ')}
        >
          <span
            className={[
              'flex size-6 items-center justify-center rounded-full text-[11px]',
              langkah === 3 ? 'bg-laut-600 text-white' : 'bg-kabut-100 text-tinta-600',
            ].join(' ')}
          >
            3
          </span>
          <span className="hidden sm:inline">Hasil Instan</span>
        </div>
      </div>

      {pesanGalat && (
        <div className="flex items-center gap-3 rounded-xl bg-bahaya-bg p-4 text-sm font-semibold text-bahaya-teks ring-1 ring-bahaya-garis">
          <AlertCircle className="size-5 shrink-0" />
          <span>{pesanGalat}</span>
        </div>
      )}

      {/* STEP 1: Tanggal & Identitas */}
      {langkah === 1 && (
        <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] sm:p-8 space-y-5">
          <h2 className="font-display text-lg font-bold text-tinta-900">
            Langkah 1: Tanggal Pemeriksaan
          </h2>

          <div>
            <label htmlFor="tanggalPeriksa" className="block text-sm font-semibold text-tinta-900">
              Tanggal Penimbangan di Posyandu <span className="text-bahaya-teks">*</span>
            </label>
            <input
              id="tanggalPeriksa"
              type="date"
              value={tanggalPeriksa}
              onChange={(e) => setTanggalPeriksa(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="mt-1.5 h-12 w-full rounded-xl bg-white px-4 text-sm text-tinta-900 ring-1 ring-kabut-200 focus:ring-2 focus:ring-laut-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-tinta-400">
              Tanggal penimbangan tidak boleh melewati hari ini.
            </p>
          </div>

          <div className="rounded-xl bg-kabut-50 p-4 space-y-2 text-xs">
            <p className="font-bold text-tinta-900">Konfirmasi Data Balita</p>
            <div className="grid grid-cols-2 gap-2 text-tinta-600">
              <div>Nama: <span className="font-semibold text-tinta-900">{balita.nama}</span></div>
              <div>Jenis Kelamin: <span className="font-semibold text-tinta-900">{balita.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</span></div>
              <div>Tanggal Lahir: <span className="font-semibold text-tinta-900">{formatTanggal(balita.tanggalLahir)}</span></div>
              <div>Posyandu: <span className="font-semibold text-tinta-900">{balita.namaPosyandu}</span></div>
              <div className="col-span-2 pt-1 border-t border-kabut-200">
                Umur saat Ditimbang:{' '}
                {/*
                  Dihitung SETELAH tanggalnya dipastikan sah. `tanggalPeriksa`
                  adalah medan tanggal yang dapat dikosongkan atau diketik
                  ulang oleh kader; `hitungUmurKalender` melempar galat untuk
                  nilai setengah ketik, dan lemparan di dalam JSX mematikan
                  seluruh halaman. Cacat yang sama sudah terjadi di halaman
                  skrining tamu di produksi.
                */}
                <span className="font-bold text-laut-800">
                  {umurSaatDitimbang
                    ? `${umurSaatDitimbang.teks} (${umurSaatDitimbang.totalHari} Hari)`
                    : 'Lengkapi tanggal pemeriksaan'}
                </span>
              </div>
            </div>
          </div>

          <Button type="button" onClick={lanjutKeLangkah2} varian="utama" lebarPenuh>
            Lanjut ke Pengukuran
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* STEP 2: Pengukuran Antropometri */}
      {langkah === 2 && (
        <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] sm:p-8 space-y-5">
          <h2 className="font-display text-lg font-bold text-tinta-900">
            Langkah 2: Hasil Pengukuran Antropometri
          </h2>

          <div className="space-y-4">
            <InputAngka
              id="beratKg"
              label="Berat Badan"
              satuan="kg"
              nilai={beratKg}
              onUbah={setBeratKg}
              bantuan="Contoh: 8,4 atau 8.4 (menerima koma)"
              wajib
            />

            <InputAngka
              id="panjangCm"
              label="Panjang / Tinggi Badan"
              satuan="cm"
              nilai={panjangCm}
              onUbah={setPanjangCm}
              bantuan="Rentang valid: 30–140 cm"
              wajib
            />

            <div>
              <label className="block text-sm font-semibold text-tinta-900">
                Posisi Saat Mengukur <span className="text-bahaya-teks">*</span>
              </label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {[
                  { id: 'otomatis', label: 'Standar Umur' },
                  { id: 'terlentang', label: 'Telentang' },
                  { id: 'berdiri', label: 'Berdiri' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPosisiUkur(p.id as PosisiUkur)}
                    className={[
                      'h-11 rounded-xl text-xs font-bold transition-all',
                      posisiUkur === p.id
                        ? 'bg-laut-600 text-white shadow-sm'
                        : 'bg-white text-tinta-600 ring-1 ring-kabut-200 hover:bg-kabut-50',
                    ].join(' ')}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-tinta-400">
                Standar: &lt; 24 bulan telentang, ≥ 24 bulan berdiri. Koreksi ±0,7 cm diterapkan otomatis bila posisi tidak standar.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InputAngka
                id="lilaCm"
                label="LILA (Lingkar Lengan Atas)"
                satuan="cm"
                nilai={lilaCm}
                onUbah={setLilaCm}
                bantuan="Untuk usia 6–59 bulan (opsional)"
                wajib={false}
              />

              <InputAngka
                id="lingkarKepalaCm"
                label="Lingkar Kepala"
                satuan="cm"
                nilai={lingkarKepalaCm}
                onUbah={setLingkarKepalaCm}
                bantuan="Opsional"
                wajib={false}
              />
            </div>

            {/* Edema Bilateral Toggle */}
            <div className="flex items-center justify-between rounded-xl bg-kabut-50 p-4">
              <div>
                <p className="text-sm font-semibold text-tinta-900">Edema Bilateral (+ / ++ / +++)</p>
                <p className="text-xs text-tinta-400">Pembengkakan kedua punggung kaki saat ditekan</p>
              </div>
              <button
                type="button"
                onClick={() => setEdema(!edema)}
                className={[
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                  edema ? 'bg-bahaya-teks' : 'bg-kabut-200',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    edema ? 'translate-x-5' : 'translate-x-0',
                  ].join(' ')}
                />
              </button>
            </div>

            <div>
              <label htmlFor="catatan" className="block text-sm font-semibold text-tinta-900">
                Catatan Pemeriksaan
              </label>
              <textarea
                id="catatan"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                rows={2}
                placeholder="Keluhan balita, nafsu makan, dll..."
                className="mt-1.5 w-full rounded-xl bg-white p-3 text-sm text-tinta-900 ring-1 ring-kabut-200 focus:ring-2 focus:ring-laut-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <Button type="button" onClick={() => setLangkah(1)} varian="sekunder">
              Kembali
            </Button>
            <Button type="button" onClick={lanjutKeLangkah3} varian="utama" lebarPenuh>
              Hitung & Lihat Hasil Instan
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Konfirmasi & Hasil Instan */}
      {langkah === 3 && hasilInstan && (
        <div className="space-y-6">
          <KartuHasil hasil={hasilInstan} namaBalita={balita.nama} />

          {/* Evaluasi Weight Increment jika ada penimbangan sebelumnya */}
          {(() => {
            const prev = balita.riwayat.length > 0 ? balita.riwayat[balita.riwayat.length - 1] : null
            const b = Number(beratKg.replace(',', '.'))
            if (!prev || isNaN(b) || b <= 0) return null

            const vel = hitungVelocity({
              // Koreksi prematuritas lewat tanggal lahir efektif (T-2).
              tanggalLahir: tanggalLahirEfektif(
                balita.tanggalLahir,
                prev.tanggal,
                balita.usiaGestasiMinggu,
              ),
              jenisKelamin: balita.jenisKelamin === 'L' ? 'lk' : 'pr',
              tanggalAwal: prev.tanggal,
              beratAwalKg: prev.beratKg,
              tanggalAkhir: tanggalPeriksa,
              beratAkhirKg: b,
            })

            return (
              <div
                className={[
                  'rounded-2xl p-5 shadow-sm ring-1 transition-all',
                  vel.status === 'naik'
                    ? 'bg-emerald-50/70 ring-emerald-200'
                    : vel.status === 'growth_faltering'
                      ? 'bg-amber-50/80 ring-amber-300'
                      : 'bg-rose-50/80 ring-rose-300',
                ].join(' ')}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        'flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm',
                        vel.status === 'naik'
                          ? 'bg-emerald-600'
                          : vel.status === 'growth_faltering'
                            ? 'bg-amber-500'
                            : 'bg-rose-600',
                      ].join(' ')}
                    >
                      <TrendingUp className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-sm font-bold text-tinta-900">
                          Weight Increment vs Penimbangan Sebelumnya
                        </h3>
                        <span
                          className={[
                            'rounded-full px-2 py-0.5 text-[10px] font-black uppercase',
                            vel.status === 'naik'
                              ? 'bg-emerald-200 text-emerald-900'
                              : vel.status === 'growth_faltering'
                                ? 'bg-amber-200 text-amber-900'
                                : 'bg-rose-200 text-rose-900',
                          ].join(' ')}
                        >
                          {vel.status === 'naik'
                            ? 'Naik (N)'
                            : vel.status === 'growth_faltering'
                              ? 'Growth Faltering (T)'
                              : 'Tidak Naik (T)'}
                        </span>
                      </div>
                      <p className="text-[11px] text-tinta-600">
                        {formatTanggal(prev.tanggal)} ({prev.beratKg} kg) ➔ {formatTanggal(tanggalPeriksa)} ({b} kg)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="rounded-lg bg-white/90 px-3 py-1.5 ring-1 ring-black/5 text-center">
                      <span className="text-[10px] text-tinta-500 block">Kenaikan Riil</span>
                      <span
                        className={[
                          'angka font-black',
                          vel.kenaikanAktualGram > 0
                            ? 'text-emerald-700'
                            : vel.kenaikanAktualGram === 0
                              ? 'text-tinta-800'
                              : 'text-rose-700',
                        ].join(' ')}
                      >
                        {vel.kenaikanAktualGram > 0 ? `+${vel.kenaikanAktualGram}` : vel.kenaikanAktualGram} g
                      </span>
                    </div>

                    <div className="rounded-lg bg-white/90 px-3 py-1.5 ring-1 ring-black/5 text-center">
                      <span className="text-[10px] text-tinta-500 block">
                        {sumberAmbangVelocity(vel.metode).judul}
                      </span>
                      <span className="angka font-black text-laut-700">
                        {formatGramBertanda(vel.kenaikanMinimalGram)}
                      </span>
                    </div>
                  </div>
                </div>

                {vel.status === 'growth_faltering' && (
                  <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-amber-100/90 p-2 text-xs text-amber-900">
                    <AlertTriangle className="size-4 shrink-0 text-amber-700 mt-0.5" />
                    <span>
                      <strong>Growth Faltering:</strong> Kenaikan berat ({formatGramBertanda(vel.kenaikanAktualGram)}) belum memenuhi {sumberAmbangVelocity(vel.metode).dalamKalimat} ({formatGramBertanda(vel.kenaikanMinimalGram)}). Waspadai risiko gagal tumbuh.
                      {sumberAmbangVelocity(vel.metode).perkiraan && (
                        <span className="mt-1 block font-semibold">
                          {sumberAmbangVelocity(vel.metode).keterangan}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )
          })()}

          <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-laut-700">
              <Sparkles className="size-4 text-karawo-500" />
              <span>Kalkulasi Z-Score Instan Perangkat Selesai</span>
            </div>
            <p className="text-xs leading-relaxed text-tinta-600">
              Data siap disimpan. Saat online, data akan dikirim ke database Supabase dan dihitung ulang di server untuk verifikasi keutuhan data medis.
            </p>

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button
                type="button"
                onClick={() => setLangkah(2)}
                varian="sekunder"
                className="sm:w-1/3"
              >
                Koreksi Angka
              </Button>
              <Button
                type="button"
                onClick={handleSimpan}
                varian="utama"
                lebarPenuh
                sedangProses={sedangSimpan}
              >
                Simpan & Selesaikan Skrining
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
