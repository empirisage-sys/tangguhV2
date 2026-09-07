import { wajibPeran } from '@/lib/supabase/penjaga'
import { createClient } from '@/lib/supabase/server'
import { petakanDaftarProdukDb, type ProdukPKMK } from '@/lib/db/pkmk'
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
  let jumlahBarisDitolak = 0
  let masterTidakTersedia = false
  let barisMentah: unknown[] = []

  try {
    const { data, error } = await supabase
      .from('produk_pkmk')
      .select('*')
      .order('nama', { ascending: true })

    if (error) throw error

    barisMentah = data ?? []
    const hasil = petakanDaftarProdukDb(barisMentah)
    daftarProduk = hasil.produk
    jumlahBarisDitolak = hasil.jumlahDitolak
    masterTidakTersedia = barisMentah.length === 0
  } catch (err) {
    // TIDAK ada lagi cadangan ke PRODUK_PKMK_LIST di sini.
    //
    // Versi sebelumnya menampilkan lima produk statis ber-id 'pkmk-1..5' yang
    // TIDAK ADA di basis data, lengkap dengan tombol Ubah dan Hapus yang pasti
    // gagal karena id-nya bukan uuid. Admin melihat data yang tampak sah dan
    // mengelola sesuatu yang tidak ada. Lihat temuan audit T-12.
    console.warn('Gagal membaca master produk_pkmk:', err)
    daftarProduk = []
    masterTidakTersedia = true
  }

  // --- Statistik Ringkas ---
  //
  // Rerata dihitung atas produk AKTIF, bukan seluruh produk. Versi sebelumnya
  // membagi dengan `totalProduk` sehingga produk yang dinonaktifkan tetap ikut
  // menarik rerata: menonaktifkan Nutrinidrink membuat angkanya tetap 33,2
  // padahal seharusnya 34,0 (temuan audit T-7).
  const totalProduk = daftarProduk.length
  const daftarAktif = daftarProduk.filter((p) => p.isActive !== false)
  const produkAktif = daftarAktif.length

  // Densitas kini SELALU turunan label (kkal_per_saji / ml_per_saji), sehingga
  // hitungan ini tidak lagi bergantung pada kolom simpanan yang menyimpang.
  // Pada data seed hasilnya berubah dari 1 menjadi 3 (temuan audit T-4).
  const produkPadatKalori = daftarAktif.filter((p) => p.densitasKkalPerMl > 1.0).length

  const rerataKkalPerSendok =
    produkAktif > 0
      ? (
          daftarAktif.reduce((acc, p) => acc + (p.kkalPerSendok || 0), 0) / produkAktif
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

      {(masterTidakTersedia || jumlahBarisDitolak > 0) && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 sm:text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            {masterTidakTersedia && (
              <p className="font-bold">
                Master data produk PKMK belum tersedia di basis data.
              </p>
            )}
            {masterTidakTersedia && (
              <p className="mt-1">
                Tidak ada produk yang dapat dikelola maupun diresepkan sampai master data diisi.
                Jalankan migrasi seed, atau tambahkan produk dengan tombol di bawah. Halaman ini
                tidak lagi menampilkan produk contoh, karena produk contoh tidak dapat diubah
                maupun dihapus dan menyesatkan.
              </p>
            )}
            {jumlahBarisDitolak > 0 && (
              <p className={masterTidakTersedia ? 'mt-2' : 'font-bold'}>
                {jumlahBarisDitolak} baris produk disingkirkan karena angka labelnya tidak
                lengkap (kkal per saji, sendok per saji, atau volume per saji kosong). Baris
                seperti itu tidak dapat dihitung dan tidak ditampilkan agar tidak dipakai
                meresepkan. Lengkapi datanya lewat basis data.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tabel & Form Manajemen Produk */}
      <TabelManajemenPKMK daftarProduk={daftarProduk} />
    </main>
  )
}
