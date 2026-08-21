import type { HasilSkrining } from '@/lib/zscore/tipe'
import {
  PENYANGKALAN_KLINIS,
  PERINGATAN_CATCH_UP,
  SINGKATAN_INDIKATOR,
  tampilanBBTB,
  tampilanBBU,
  tampilanTBU,
} from '@/lib/tampilan/status'
import {
  formatBerat,
  formatKalori,
  formatRentangProtein,
  formatZ,
} from '@/lib/tampilan/format'
import { LencanaStatus } from '@/components/ui/LencanaStatus'
import { PitaZScore } from './PitaZScore'

/**
 * Kartu hasil satu skrining.
 *
 * Wajib memuat kalimat penyangkalan klinis. Kasus dengan red flag memunculkan
 * banner rujukan yang tidak dapat ditutup.
 */
type Props = {
  hasil: HasilSkrining
  namaBalita: string
}

export function KartuHasil({ hasil, namaBalita }: Props) {
  const indikator = [
    { kunci: 'bbu' as const, z: hasil.bbu.z, tampilan: tampilanBBU(hasil.statusBBU) },
    { kunci: 'tbu' as const, z: hasil.tbu.z, tampilan: tampilanTBU(hasil.statusTBU) },
    { kunci: 'bbtb' as const, z: hasil.bbtb.z, tampilan: tampilanBBTB(hasil.statusBBTB) },
  ]

  return (
    <article className="space-y-5 rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)]">
      <header>
        <h2 className="text-xl font-bold text-tinta-900">{namaBalita}</h2>
        <p className="angka text-sm text-tinta-600">
          {formatBerat(null)} {/* diisi pemanggil dari data mentah */}
        </p>
      </header>

      {hasil.isRedFlag && (
        <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm">
              <span className="text-base font-black">!</span>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-base font-extrabold text-red-900">
                  PERINGATAN KLINIS: Perlu Rujukan Medis Segera
                </p>
                <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                  Banner Rujukan Wajib
                </span>
              </div>
              <p className="mt-1 text-xs text-red-800">
                Kondisi antropometri balita berada di zona bahaya klinis (Red Flag). Wajib diterbitkan rujukan berjenjang dari Posyandu / Puskesmas ke Dokter Spesialis Anak di RSUD:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs font-semibold text-red-900">
                {hasil.alasanRedFlag.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <div className="mt-3 rounded-xl bg-red-100/80 p-2.5 text-[11px] text-red-900">
                <strong>Pedoman Kemenkes RI:</strong> Lakukan konfirmasi klinis oleh dokter puskesmas dan terbitkan rujukan RSUD untuk tatalaksana komprehensif, investigasi penyakit penyerta, serta peresepan PKMK.
              </div>
            </div>
          </div>
        </div>
      )}

      {hasil.diLuarRentang && hasil.catatanDiLuarRentang && (
        <div className="rounded-xl bg-netral-bg p-4 ring-1 ring-netral-garis">
          <p className="font-semibold text-netral-teks">Sebagian indikator tidak dapat dinilai</p>
          <p className="mt-1 text-sm text-netral-teks">{hasil.catatanDiLuarRentang}</p>
        </div>
      )}

      <div className="space-y-5">
        {indikator.map((i) => (
          <section key={i.kunci} className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-tinta-600">
                  {SINGKATAN_INDIKATOR[i.kunci]}
                </span>
                <span className="angka text-lg font-bold text-tinta-900">{formatZ(i.z)}</span>
                <span className="text-sm text-tinta-400">SD</span>
              </div>
              <LencanaStatus status={i.tampilan} ukuran="kecil" />
            </div>
            <PitaZScore indikator={i.kunci} z={i.z} label={i.tampilan.label} />
          </section>
        ))}
      </div>

      <section className="rounded-xl bg-kabut-50 p-4">
        <h3 className="text-base font-bold text-tinta-900">Kebutuhan gizi harian</h3>
        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-tinta-600">Kebutuhan pemeliharaan</dt>
            <dd className="angka font-semibold">{formatKalori(hasil.gizi.kaloriPemeliharaanKkal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-tinta-600">Protein pemeliharaan</dt>
            <dd className="angka font-semibold">
              {formatRentangProtein(
                hasil.gizi.proteinPemeliharaanMinGram,
                hasil.gizi.proteinPemeliharaanMaksGram,
              )}
            </dd>
          </div>
          {hasil.gizi.metode === 'catch_up' && hasil.gizi.kaloriCatchUpKkal !== null && (
            <>
              <div className="flex justify-between gap-3 border-t border-kabut-200 pt-1.5">
                <dt className="font-semibold text-tinta-900">Target tumbuh kejar</dt>
                <dd className="angka font-bold">{formatKalori(hasil.gizi.kaloriCatchUpKkal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-tinta-600">Protein tumbuh kejar</dt>
                <dd className="angka font-semibold">
                  {formatRentangProtein(
                    hasil.gizi.proteinCatchUpMinGram,
                    hasil.gizi.proteinCatchUpMaksGram,
                  )}
                </dd>
              </div>
              <p className="pt-1 text-xs text-waspada-teks">{PERINGATAN_CATCH_UP}</p>
            </>
          )}
        </dl>
      </section>

      <footer className="border-t border-kabut-200 pt-3">
        <p className="text-xs leading-relaxed text-tinta-400">{PENYANGKALAN_KLINIS}</p>
        <p className="angka mt-1 text-[10px] text-tinta-400">{hasil.engineVersion}</p>
      </footer>
    </article>
  )
}
