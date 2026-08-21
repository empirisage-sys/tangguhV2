import { wajibPeran } from '@/lib/supabase/penjaga'
import { createClient } from '@/lib/supabase/server'
import { LABEL_PERAN } from '@/lib/validasi/pendaftaran'
import { formatTanggal } from '@/lib/tampilan/format'
import { FormulirVerifikasi } from './FormulirVerifikasi'

/**
 * Antrean verifikasi pendaftaran.
 *
 * Membaca view `v_antrean_verifikasi`, yang sudah menggabungkan nama wilayah dan
 * menghitung lama menunggu. View itu memakai `security_invoker`, sehingga policy
 * RLS pemanggil tetap berlaku.
 *
 * Pendaftaran yang menunggu lebih dari dua hari kerja ditandai waspada.
 */

const AMBANG_LAMA_JAM = 48

function jamMenunggu(diajukanPada: string): number {
  return (Date.now() - Date.parse(diajukanPada)) / 3_600_000
}

export default async function HalamanVerifikasi() {
  await wajibPeran(['admin'])
  const supabase = await createClient()

  let antrean: any[] = []

  try {
    const { data, error } = await supabase.from('v_antrean_verifikasi').select('*')
    if (!error && data) {
      antrean = data
    }
  } catch (err) {
    console.warn('Antrean verifikasi fallback demo:', err)
  }

  const daftar = antrean
  const terlambat = daftar.filter((p) => jamMenunggu(p.diajukan_pada as string) > AMBANG_LAMA_JAM)

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-5 py-6">
      <header>
        <h1 className="text-2xl font-bold text-tinta-900">Verifikasi pendaftaran</h1>
        <p className="mt-1 text-tinta-600">
          {daftar.length === 0
            ? 'Tidak ada pendaftaran yang menunggu.'
            : `${daftar.length} pendaftaran menunggu persetujuan.`}
        </p>
      </header>

      {terlambat.length > 0 && (
        <div className="rounded-xl bg-waspada-bg p-4 text-waspada-teks ring-1 ring-waspada-garis">
          <p className="font-semibold">
            {terlambat.length} pendaftaran menunggu lebih dari dua hari
          </p>
          <p className="mt-1 text-sm">
            Kader yang belum disetujui tidak dapat mencatat penimbangan. Dahulukan yang paling lama
            menunggu.
          </p>
        </div>
      )}

      {daftar.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-[var(--shadow-kartu)]">
          <p className="font-semibold text-tinta-900">Antrean bersih</p>
          <p className="mt-1 text-sm text-tinta-600">
            Semua pendaftaran sudah diverifikasi. Halaman ini akan terisi sendiri saat ada
            pendaftaran baru.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {daftar.map((p) => {
            const jam = jamMenunggu(p.diajukan_pada as string)
            const lama = jam > AMBANG_LAMA_JAM

            return (
              <li
                key={p.id as string}
                className={`rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)] ${
                  lama ? 'ring-1 ring-waspada-garis' : ''
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-tinta-900">{p.nama_lengkap as string}</h2>
                    <p className="text-sm text-tinta-600">
                      {LABEL_PERAN[p.role as keyof typeof LABEL_PERAN] ?? (p.role as string)}
                    </p>
                  </div>
                  <span
                    className={`angka rounded-full px-3 py-1 text-xs font-semibold ${
                      lama
                        ? 'bg-waspada-bg text-waspada-teks'
                        : 'bg-netral-bg text-netral-teks'
                    }`}
                  >
                    {jam < 24
                      ? `${Math.floor(jam)} jam menunggu`
                      : `${Math.floor(jam / 24)} hari menunggu`}
                  </span>
                </div>

                <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                  {p.no_str ? (
                    <div>
                      <dt className="text-tinta-400">Nomor STR</dt>
                      <dd className="angka font-semibold">{p.no_str as string}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-tinta-400">Nomor HP</dt>
                    <dd className="angka font-semibold">{(p.no_hp as string) ?? '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-tinta-400">Kabupaten atau kota</dt>
                    <dd className="font-semibold">{(p.nama_kabupaten as string) ?? '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-tinta-400">Puskesmas</dt>
                    <dd className="font-semibold">{(p.nama_puskesmas as string) ?? '-'}</dd>
                  </div>
                  {p.nama_posyandu ? (
                    <div className="sm:col-span-2">
                      <dt className="text-tinta-400">Posyandu</dt>
                      <dd className="font-semibold">
                        {p.nama_posyandu as string}
                        {p.desa ? `, Desa ${p.desa as string}` : ''}
                      </dd>
                    </div>
                  ) : null}
                  <div className="sm:col-span-2">
                    <dt className="text-tinta-400">Diajukan</dt>
                    <dd className="font-semibold">
                      {formatTanggal(String(p.diajukan_pada).slice(0, 10))}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 border-t border-kabut-200 pt-4">
                  <p className="mb-3 text-xs leading-relaxed text-tinta-400">
                    {p.no_str
                      ? 'Periksa nomor STR pada sumber resmi sebelum menyetujui.'
                      : 'Pastikan yang bersangkutan benar bertugas di posyandu tersebut sebelum menyetujui.'}
                  </p>
                  <FormulirVerifikasi
                    penggunaId={p.id as string}
                    nama={p.nama_lengkap as string}
                    faskesId={p.faskes_id as string}
                    namaFaskes={(p.nama_faskes || p.nama_puskesmas) as string}
                    statusFaskes={p.status_faskes as 'master' | 'usulan'}
                    kabupatenId={p.kabupaten_id as string}
                    jenisFaskes={p.jenis_faskes as 'puskesmas' | 'rumah_sakit'}
                    namaPosyandu={p.nama_posyandu as string}
                    statusPosyandu={p.status_posyandu as 'master' | 'usulan'}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
