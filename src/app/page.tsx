import Link from 'next/link'
import {
  Activity,
  Baby,
  BarChart3,
  Calculator,
  CheckCircle2,
  ChevronRight,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User,
  Utensils,
  WifiOff,
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-kabut-50 text-tinta-900">
      {/* Top Header */}
      <header className="border-b border-kabut-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-laut-500 to-laut-700 text-xl font-black text-white shadow-lg shadow-laut-500/25">
              T
            </div>
            <div>
              <span className="font-display text-xl font-extrabold tracking-tight text-laut-900">
                TANGGUH
              </span>
              <p className="text-xs font-semibold text-laut-700">Provinsi Gorontalo</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/skrining-tamu"
              className="rounded-xl bg-karawo-100 px-3.5 py-2 text-xs font-bold text-karawo-700 ring-1 ring-karawo-400 transition-colors hover:bg-karawo-200"
            >
              Masuk sebagai Tamu
            </Link>
            <Link
              href="/masuk"
              className="rounded-xl bg-laut-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-laut-700 active:bg-laut-800 sm:text-sm"
            >
              Masuk sebagai Dokter/Nakes
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-laut-50 via-kabut-50 to-kabut-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-laut-100 px-3.5 py-1.5 text-xs font-bold text-laut-800 ring-1 ring-laut-300">
              <Sparkles className="size-3.5 text-karawo-500" />
              <span>Standar WHO 2006 & Kemenkes RI • Engine zscore-2.0.0</span>
            </div>

            <h1 className="font-display mt-6 text-3xl font-extrabold tracking-tight text-tinta-900 sm:text-5xl sm:leading-tight">
              Tanggulangi Stunting untuk Generasi{' '}
              <span className="bg-gradient-to-r from-laut-600 via-laut-500 to-karawo-500 bg-clip-text text-transparent">
                Hulonthalo
              </span>
            </h1>

            <p className="mt-5 text-base leading-relaxed text-tinta-600 sm:text-lg">
              Platform deteksi dini antropometri presisi, analisis Z-Score instan, kurva pertumbuhan, formulasi terapi PKMK, dan asuhan gizi terintegrasi untuk 6 kabupaten/kota se-Provinsi Gorontalo.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/skrining-tamu"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-karawo-500 px-6 text-sm font-bold text-white shadow-lg shadow-karawo-500/25 transition-all hover:bg-karawo-600 sm:w-auto sm:text-base"
              >
                <Calculator className="size-5" />
                Masuk sebagai Tamu
              </Link>
              <Link
                href="/masuk"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-laut-600 px-6 text-sm font-bold text-white shadow-lg shadow-laut-600/25 transition-all hover:bg-laut-700 sm:w-auto sm:text-base"
              >
                <User className="size-5" />
                Masuk sebagai Dokter/Nakes
                <ChevronRight className="size-4" />
              </Link>
            </div>

            <p className="mt-4 text-xs text-tinta-600">
              Belum pernah terdaftar sebagai Dokter / Nakes / Kader?{' '}
              <Link href="/daftar" className="font-bold text-laut-700 underline hover:text-laut-800">
                Registrasi Akun Petugas di sini
              </Link>
            </p>

            {/* Quick Metrics */}
            <div className="mt-12 grid grid-cols-2 gap-4 rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] sm:grid-cols-4">
              <div className="text-center">
                <p className="angka text-2xl font-bold text-laut-700 sm:text-3xl">842</p>
                <p className="mt-1 text-xs font-semibold text-tinta-600">Baris Tabel WHO Resmi</p>
              </div>
              <div className="text-center">
                <p className="angka text-2xl font-bold text-aman-teks sm:text-3xl">230</p>
                <p className="mt-1 text-xs font-semibold text-tinta-600">Uji Klinis Terverifikasi</p>
              </div>
              <div className="text-center">
                <p className="angka text-2xl font-bold text-karawo-700 sm:text-3xl">6</p>
                <p className="mt-1 text-xs font-semibold text-tinta-600">Kabupaten / Kota</p>
              </div>
              <div className="text-center">
                <p className="angka text-2xl font-bold text-tinta-900 sm:text-3xl">100%</p>
                <p className="mt-1 text-xs font-semibold text-tinta-600">Dukungan Offline PWA</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Keunggulan Fitur Utama */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold text-tinta-900 sm:text-3xl">
              Dirancang Khusus untuk Alur Kerja Lapangan
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-tinta-600">
              Menghubungkan Kader Posyandu, Dokter Puskesmas, Dietisien, hingga Pimpinan Dinas Kesehatan dalam satu rantai penanganan yang cepat dan akurat.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1 */}
            <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] transition-all hover:shadow-md">
              <div className="flex size-12 items-center justify-center rounded-xl bg-laut-50 text-laut-600">
                <Activity className="size-6" />
              </div>
              <h3 className="font-display mt-4 text-lg font-bold text-tinta-900">
                Kalkulasi Z-Score Presisi WHO
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-tinta-600">
                Menerapkan formula LMS murni, koreksi posisi ukur berdiri/terlentang ±0,7 cm, evaluasi weight velocity P5, serta penolakan usia di luar 0–60 bulan.
              </p>
            </div>

            {/* Card 2 */}
            <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] transition-all hover:shadow-md">
              <div className="flex size-12 items-center justify-center rounded-xl bg-karawo-100 text-karawo-700">
                <BarChart3 className="size-6" />
              </div>
              <h3 className="font-display mt-4 text-lg font-bold text-tinta-900">
                Pita Z-Score & Kurva Interaktif
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-tinta-600">
                Visualisasi meteran antropometri instan dan kurva riwayat pertumbuhan WHO (BB/U, TB/U, BB/TB, Tren Z-Score) adaptif per peran.
              </p>
            </div>

            {/* Card 3 */}
            <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] transition-all hover:shadow-md">
              <div className="flex size-12 items-center justify-center rounded-xl bg-aman-bg text-aman-teks">
                <Utensils className="size-6" />
              </div>
              <h3 className="font-display mt-4 text-lg font-bold text-tinta-900">
                Formulasi PKMK & Catch-up Gizi
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-tinta-600">
                Kalkulator takaran praktis harian produk PKMK (SGM Gain 100, Nutrinidrink, dll.) berbasis kkal per sendok dinamis untuk percepatan tumbuh kejar.
              </p>
            </div>

            {/* Card 4 */}
            <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] transition-all hover:shadow-md">
              <div className="flex size-12 items-center justify-center rounded-xl bg-laut-100 text-laut-800">
                <WifiOff className="size-6" />
              </div>
              <h3 className="font-display mt-4 text-lg font-bold text-tinta-900">
                Tangguh Offline di Posyandu
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-tinta-600">
                Tetap dapat mencatat saat sinyal hilang dengan IndexedDB outbox pattern. Data tersinkronisasi otomatis saat kembali online tanpa duplikasi.
              </p>
            </div>

            {/* Card 5 */}
            <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] transition-all hover:shadow-md">
              <div className="flex size-12 items-center justify-center rounded-xl bg-kabut-100 text-tinta-900">
                <MapPin className="size-6" />
              </div>
              <h3 className="font-display mt-4 text-lg font-bold text-tinta-900">
                6 Wilayah Gorontalo
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-tinta-600">
                Mencakup Kota Gorontalo, Kab. Gorontalo, Bone Bolango, Boalemo, Pohuwato, dan Gorontalo Utara dengan isolasi data aman berbasis RLS.
              </p>
            </div>

            {/* Card 6 */}
            <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] transition-all hover:shadow-md">
              <div className="flex size-12 items-center justify-center rounded-xl bg-aman-bg text-aman-teks">
                <ShieldCheck className="size-6" />
              </div>
              <h3 className="font-display mt-4 text-lg font-bold text-tinta-900">
                Verifikasi Admin & UU PDP
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-tinta-600">
                Seluruh pendaftaran diverifikasi oleh admin dinas untuk mencegah kebocoran data rekam medis anak antar faskes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-kabut-200 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-tinta-400 sm:flex-row sm:px-6">
          <p>© 2026 Aplikasi TANGGUH — Fakultas Kedokteran Univ. Muhammadiyah Gorontalo - FB -</p>
          <div className="flex items-center gap-4">
            <Link href="/masuk" className="hover:text-laut-700">Masuk</Link>
            <Link href="/daftar" className="hover:text-laut-700">Daftar Akun</Link>
            <Link href="/menunggu-verifikasi" className="hover:text-laut-700">Status Verifikasi</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
