import { wajibPeran } from '@/lib/supabase/penjaga'
import { createClient } from '@/lib/supabase/server'
import { PRODUK_PKMK_LIST, petakanProdukDbKeModel, type ProdukPKMK } from '@/lib/db/pkmk'
import { TabelManajemenPKMK } from './TabelManajemenPKMK'
import { Milk, Flame, CheckCircle2, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react'

export const metadata = {
  title: 'Master Produk Susu PKMK & Kalori | Administrator TANGGUH',
  description: 'Pengelolaan produk susu formula PKMK, kalori per saji, takaran sendok, dan densitas klinis.',
}

export default async function HalamanAdminProdukPKMK() {
  await wajibPeran(['admin'])
  const supabase = await createClient()

  let daftarProduk: ProdukPKMK[] = []

  try {
    const { data, error } = await supabase
      .from('produk_pkmk')
      .select('*')
      .order('nama', { ascending: true })

    if (!error && data && data.length > 0) {
      daftarProduk = data.map((row: any) => petakanProdukDbKeModel(row))
    } else {
      // Fallback ke master data awal jika tabel belum diisi
      daftarProduk = PRODUK_PKMK_LIST
    }
  } catch (err) {
    console.warn('Fallback ke PRODUK_PKMK_LIST lokal:', err)
    daftarProduk = PRODUK_PKMK_LIST
  }

  // Statistik Ringkas
  const totalProduk = daftarProduk.length
  const produkAktif = daftarProduk.filter((p) => p.isActive !== false).length
  const produkPadatKalori = daftarProduk.filter((p) => p.densitasKkalPerMl > 1.0).length

  // Rata-rata kkal per sendok
  const rerataKkalPerSendok =
    totalProduk > 0
      ? (
          daftarProduk.reduce((acc, p) => acc + (p.kkalPerSendok || 0), 0) / totalProduk
        ).toFixed(1)
      : '0.0'

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-laut-100 px-3 py-1 text-xs font-bold text-laut-800">
            <ShieldCheck className="size-3.5 text-laut-600" />
            <span>Master Data Klinis &amp; Nutrisi Medis Khusus</span>
          </div>
          <h1 className="font-display mt-2 text-2xl font-bold text-tinta-900 sm:text-3xl">
            Produk Susu PKMK &amp; Takaran Kalori
          </h1>
          <p className="mt-1 text-xs text-tinta-600 sm:text-sm">
            Manajemen master formula susu PKMK, input kkal per saji, perhitungan otomatis kkal per sendok, dan densitas klinis.
          </p>
        </div>
      </div>

      {/* Banner Kaidah Klinis D-5 & S-2 */}
      <div className="rounded-2xl border border-laut-200 bg-laut-50/70 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="size-5 shrink-0 text-laut-600 mt-0.5" />
          <div className="text-xs leading-relaxed text-laut-900 sm:text-sm">
            <p className="font-bold text-laut-950">
              Prinsip Klinis Satu Sumber Kebenaran (Keputusan D-5 &amp; Temuan S-2)
            </p>
            <p className="mt-1 text-laut-800">
              Setiap produk PKMK memiliki spesifikasi kalori yang unik (berkisar antara 20 hingga 40 kkal per sendok takar). Nilai <span className="font-semibold text-laut-950">kkal_per_sendok</span> dihitung otomatis dari <span className="font-semibold text-laut-950">kkal_per_saji ÷ sendok_per_saji</span>, dan bukan angka perkiraan tetap 25 kkal. Produk yang aktif di sini langsung tersedia bagi dokter dan dietisien saat meresepkan asuhan gizi balita.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-kabut-100 bg-white p-4 shadow-[var(--shadow-kartu)]">
          <div className="flex items-center justify-between text-tinta-500">
            <span className="text-xs font-semibold">Total Produk PKMK</span>
            <Milk className="size-4 text-laut-600" />
          </div>
          <p className="font-display mt-2 text-2xl font-extrabold text-tinta-900">{totalProduk}</p>
        </div>

        <div className="rounded-2xl border border-kabut-100 bg-white p-4 shadow-[var(--shadow-kartu)]">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-semibold">Produk Aktif</span>
            <CheckCircle2 className="size-4" />
          </div>
          <p className="font-display mt-2 text-2xl font-extrabold text-emerald-700">{produkAktif}</p>
        </div>

        <div className="rounded-2xl border border-kabut-100 bg-white p-4 shadow-[var(--shadow-kartu)]">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-xs font-semibold">Rerata Kkal/Sendok</span>
            <Flame className="size-4" />
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <p className="font-display text-2xl font-extrabold text-amber-700">{rerataKkalPerSendok}</p>
            <span className="text-[11px] font-bold text-amber-600">kkal</span>
          </div>
        </div>

        <div className="rounded-2xl border border-kabut-100 bg-white p-4 shadow-[var(--shadow-kartu)]">
          <div className="flex items-center justify-between text-karawo-600">
            <span className="text-xs font-semibold">Formula Padat Kalori</span>
            <Sparkles className="size-4" />
          </div>
          <p className="font-display mt-2 text-2xl font-extrabold text-karawo-700">{produkPadatKalori}</p>
        </div>
      </div>

      {/* Tabel & Form Manajemen Produk */}
      <TabelManajemenPKMK daftarProduk={daftarProduk} />
    </main>
  )
}
