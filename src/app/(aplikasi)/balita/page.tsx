import Link from 'next/link'
import { Plus, Search, UserPlus, ChevronRight, Filter, Stethoscope } from 'lucide-react'
import { SAMPLE_BALITA_DATABASE } from '@/lib/db/balita-mock'
import { ambilSemuaRujukan } from '@/lib/db/rujukan'
import { bolehLihatBalita } from '@/lib/tampilan/akses'
import { LencanaStatus } from '@/components/ui/LencanaStatus'
import { tampilanBBTB, tampilanTBU } from '@/lib/tampilan/status'
import { formatTanggal, formatUmurBulan } from '@/lib/tampilan/format'
import { ambilProfil } from '@/lib/supabase/penjaga'
import { Hospital, Info } from 'lucide-react'

export default async function HalamanDaftarBalita({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const profil = await ambilProfil()
  const daftarRujukan = ambilSemuaRujukan()
  const isDokter = profil?.peran === 'dokter'
  const isRumahSakit = profil?.jenisFaskes === 'rumah_sakit'

  const { q, status } = await searchParams
  const kueri = (q ?? '').toLowerCase()

  const balitaList = SAMPLE_BALITA_DATABASE.filter((b) => {
    // Terapkan filter hak akses peran klinis
    if (profil && !bolehLihatBalita(b, profil, daftarRujukan)) {
      return false
    }

    if (kueri && !b.nama.toLowerCase().includes(kueri) && !(b.nik && b.nik.includes(kueri))) {
      return false
    }
    if (status === 'stunting') {
      const skriningAkhir = b.riwayat[b.riwayat.length - 1]
      return skriningAkhir?.statusTBU === 'pendek' || skriningAkhir?.statusTBU === 'sangat_pendek'
    }
    if (status === 'wasting') {
      const skriningAkhir = b.riwayat[b.riwayat.length - 1]
      return skriningAkhir?.statusBBTB === 'gizi_kurang' || skriningAkhir?.statusBBTB === 'gizi_buruk'
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-tinta-900">Data Balita</h1>
          <p className="text-sm text-tinta-600">
            Daftar anak balita terdaftar di wilayah binaan Posyandu / Puskesmas
          </p>
        </div>

        <Link
          href="/balita/baru"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-laut-600 px-5 text-sm font-bold text-white shadow-md shadow-laut-600/20 transition-all hover:bg-laut-700 active:scale-95"
        >
          <UserPlus className="size-4" />
          Tambah Balita Baru
        </Link>
      </div>

      {/* Pemberitahuan Cakupan Data Khusus Akun Dokter */}
      {isDokter && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 text-xs text-sky-900 shadow-sm flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white">
            <Stethoscope className="size-4" />
          </div>
          <div>
            <p className="font-bold text-sky-950">
              Cakupan Data Rekam Medis (Akun Dokter):
            </p>
            <p className="mt-0.5 text-sky-800 leading-relaxed">
              Sesuai standar kerahasiaan medis, Anda hanya dapat melihat data pasien balita yang <strong>Anda input sendiri</strong>, pasien yang <strong>dirujuk ke Puskesmas wilayah Anda</strong>, atau pasien yang <strong>dirujuk ke Rumah Sakit tempat bertugas</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <form className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-tinta-400" />
          <input
            name="q"
            defaultValue={q}
            type="search"
            placeholder="Cari nama balita atau NIK..."
            className="h-12 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-tinta-900 ring-1 ring-kabut-200 focus:ring-2 focus:ring-laut-500 focus:outline-none"
          />
        </form>

        <div className="flex gap-2">
          <Link
            href="/balita"
            className={[
              'inline-flex min-h-12 items-center rounded-xl px-4 text-xs font-bold transition-colors',
              !status ? 'bg-laut-600 text-white' : 'bg-white text-tinta-600 ring-1 ring-kabut-200 hover:bg-kabut-50',
            ].join(' ')}
          >
            Semua ({SAMPLE_BALITA_DATABASE.length})
          </Link>
          <Link
            href="/balita?status=stunting"
            className={[
              'inline-flex min-h-12 items-center rounded-xl px-4 text-xs font-bold transition-colors',
              status === 'stunting' ? 'bg-waspada-teks text-white' : 'bg-white text-tinta-600 ring-1 ring-kabut-200 hover:bg-kabut-50',
            ].join(' ')}
          >
            Stunting
          </Link>
          <Link
            href="/balita?status=wasting"
            className={[
              'inline-flex min-h-12 items-center rounded-xl px-4 text-xs font-bold transition-colors',
              status === 'wasting' ? 'bg-bahaya-teks text-white' : 'bg-white text-tinta-600 ring-1 ring-kabut-200 hover:bg-kabut-50',
            ].join(' ')}
          >
            Gizi Buruk / Kurang
          </Link>
        </div>
      </div>

      {/* Balita List Cards */}
      <div className="space-y-3">
        {balitaList.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-[var(--shadow-kartu)]">
            <p className="text-base font-bold text-tinta-900">Belum Ada Data Balita</p>
            <p className="mt-1 text-xs text-tinta-600">
              {kueri || status
                ? 'Tidak ada balita yang sesuai kriteria pencarian atau filter.'
                : 'Mulai catat pertumbuhan anak dengan menekan tombol Tambah Balita Baru.'}
            </p>
            {!kueri && !status && (
              <div className="mt-4">
                <Link
                  href="/balita/baru"
                  className="inline-flex items-center gap-2 rounded-xl bg-laut-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-laut-700 transition-colors"
                >
                  <UserPlus className="size-4" />
                  Tambah Balita Pertama
                </Link>
              </div>
            )}
          </div>
        ) : (
          balitaList.map((balita) => {
            const skriningTerakhir = balita.riwayat[balita.riwayat.length - 1]
            const statusTB = skriningTerakhir ? tampilanTBU(skriningTerakhir.statusTBU) : null
            const statusBB = skriningTerakhir ? tampilanBBTB(skriningTerakhir.statusBBTB) : null

            return (
              <div
                key={balita.id}
                className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)] transition-all hover:shadow-md sm:flex-row sm:items-center"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                      href={`/balita/${balita.id}`}
                      className="text-lg font-bold text-tinta-900 hover:text-laut-700 hover:underline"
                    >
                      {balita.nama}
                    </Link>
                    <span className="angka rounded-full bg-laut-50 px-2.5 py-0.5 text-xs font-bold text-laut-700">
                      {balita.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                    </span>
                    {balita.nik && (
                      <span className="angka text-xs text-tinta-400">NIK: {balita.nik}</span>
                    )}
                  </div>

                  <p className="text-xs text-tinta-600">
                    Lahir: {formatTanggal(balita.tanggalLahir)} • Ibu: {balita.namaIbu ?? '-'} • {balita.namaPosyandu}
                  </p>

                  {skriningTerakhir && (
                    <p className="angka text-xs font-medium text-tinta-600">
                      Terakhir diukur: {skriningTerakhir.beratKg} kg • {skriningTerakhir.panjangCm} cm ({formatTanggal(skriningTerakhir.tanggal)})
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:self-center">
                  {statusTB && <LencanaStatus status={statusTB} ukuran="kecil" />}
                  {statusBB && <LencanaStatus status={statusBB} ukuran="kecil" />}

                  <Link
                    href={`/balita/${balita.id}/skrining-baru`}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-laut-50 px-3 text-xs font-bold text-laut-700 ring-1 ring-laut-200 hover:bg-laut-100"
                  >
                    <Plus className="size-3.5" />
                    Ukur Baru
                  </Link>

                  <Link
                    href={`/balita/${balita.id}`}
                    className="flex size-10 items-center justify-center rounded-xl bg-kabut-100 text-tinta-600 hover:bg-kabut-200"
                    title="Buka Profil"
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
