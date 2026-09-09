import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ambilProfil } from '@/lib/supabase/penjaga'
import { bacaBalitaById } from '@/lib/db/balita-server'
import { ambilSemuaRujukan } from '@/lib/db/rujukan'
import { bolehLihatBalita } from '@/lib/tampilan/akses'
import { semuaKurva } from '@/lib/grafik/seri'
import { PanelKurva } from '@/components/grafik/PanelKurva'
import { LencanaStatus } from '@/components/ui/LencanaStatus'
import {
  tampilanBBTB,
  tampilanBBU,
  tampilanTBU,
  tampilanVelocity,
  sumberAmbangVelocity,
} from '@/lib/tampilan/status'
import {
  formatTanggal,
  formatZ,
  formatGramBertanda,
  formatBerat,
  formatPanjang,
  formatUmurBulan,
} from '@/lib/tampilan/format'
import {
  hitungVelocity,
  apakahPerluPKMK,
  tanggalLahirEfektif,
  ENGINE_VERSION,
} from '@/lib/zscore'
import { ArrowLeft, Download, FileText, Plus, Sparkles, Utensils, TrendingUp, Scale, AlertTriangle, CheckCircle2, AlertOctagon, Calculator } from 'lucide-react'
import { BannerRujukanBalita } from '@/components/rujukan/BannerRujukanBalita'

export default async function HalamanDetailBalita({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // ==========================================================================
  // TAHAP 2a: RINCIAN BALITA DIBACA DARI SUPABASE
  //
  // Inilah halaman yang paling nyata rusak sebelum patch ini. Setelah kader
  // berhasil mendaftarkan balita, `balita/baru/actions.ts` mengalihkan ke
  // `/balita/{id}` — dan halaman ini memanggil `cariBalitaById` pada senarai
  // kosong lalu memanggil `notFound()`. Pendaftaran berhasil, layarnya 404.
  //
  // Kegagalan pembacaan dibedakan dari balita yang tidak ada: yang pertama
  // dilempar sebagai galat supaya terlihat, yang kedua 404 sebagaimana mestinya.
  // Menjadikan keduanya 404 berarti gangguan database tampak seperti data yang
  // tidak pernah ada.
  // ==========================================================================
  const hasilBaca = await bacaBalitaById(id)

  if (!hasilBaca.ok) {
    throw new Error(`Gagal membaca data balita: ${hasilBaca.pesan}`)
  }

  const balita = hasilBaca.data

  if (!balita) {
    notFound()
  }

  const profil = await ambilProfil()
  const daftarRujukan = ambilSemuaRujukan()

  if (profil && !bolehLihatBalita(balita, profil, daftarRujukan)) {
    notFound()
  }

  const peran = profil?.peran ?? 'dokter'

  const jenisKelaminEngine = balita.jenisKelamin === 'L' ? 'lk' : 'pr'
  const kurvaData = semuaKurva(balita.riwayat, jenisKelaminEngine)

  const skriningTerakhir = balita.riwayat[balita.riwayat.length - 1]
  const skriningSebelumnya = balita.riwayat.length >= 2 ? balita.riwayat[balita.riwayat.length - 2] : null

  const statusTB = skriningTerakhir ? tampilanTBU(skriningTerakhir.statusTBU) : null
  const statusBB = skriningTerakhir ? tampilanBBTB(skriningTerakhir.statusBBTB) : null
  const statusBBUVal = skriningTerakhir ? tampilanBBU(skriningTerakhir.statusBBU) : null

  // Evaluasi kenaikan berat badan terkini
  // `hitungVelocity` hanya menerima tanggal lahir, jadi koreksi prematuritas
  // disalurkan lewat tanggal lahir efektif — dengan aturan mesin, termasuk
  // batas umurnya. Lihat temuan audit T-2.
  const tglLahirVelocity = (tanggalAcuan: string) =>
    tanggalLahirEfektif(balita.tanggalLahir, tanggalAcuan, balita.usiaGestasiMinggu)

  const evaluasiVelocity = skriningSebelumnya && skriningTerakhir ? hitungVelocity({
    tanggalLahir: tglLahirVelocity(skriningSebelumnya.tanggal),
    jenisKelamin: jenisKelaminEngine,
    tanggalAwal: skriningSebelumnya.tanggal,
    beratAwalKg: skriningSebelumnya.beratKg,
    tanggalAkhir: skriningTerakhir.tanggal,
    beratAkhirKg: skriningTerakhir.beratKg,
  }) : null

  const perluPKMKBalita = skriningTerakhir
    ? apakahPerluPKMK({
        statusBBTB: skriningTerakhir.statusBBTB,
        statusTBU: skriningTerakhir.statusTBU,
        statusBBU: skriningTerakhir.statusBBU,
        statusVelocity: evaluasiVelocity?.status,
        edema: skriningTerakhir.edema,
      })
    : false

  const statusVelocityTerkini = evaluasiVelocity ? tampilanVelocity(evaluasiVelocity.status) : null

  return (
    <div className="space-y-6">
      {/* Back Button & Title */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Link
            href="/balita"
            className="flex size-10 items-center justify-center rounded-xl bg-white text-tinta-600 ring-1 ring-kabut-200 hover:bg-kabut-100"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-tinta-900">{balita.nama}</h1>
              <span
                className={[
                  'angka rounded-full px-2.5 py-0.5 text-xs font-bold',
                  balita.jenisKelamin === 'L'
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-rose-100 text-rose-800',
                ].join(' ')}
              >
                {balita.jenisKelamin === 'L' ? '👦 Laki-laki' : '👧 Perempuan'}
              </span>
            </div>
            <p className="text-xs text-tinta-600">
              Lahir {formatTanggal(balita.tanggalLahir)} • {balita.namaPosyandu}, {balita.namaKabupaten}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <a
            href={`/api/ekspor/pdf/${balita.id}`}
            download
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-tinta-700 ring-1 ring-kabut-200 hover:bg-kabut-100"
          >
            <Download className="size-4 text-tinta-600" />
            Unduh PDF
          </a>
          <Link
            href="/velocity"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-100"
          >
            <TrendingUp className="size-4 text-emerald-600" />
            Weight Increment
          </Link>
          <Link
            href={`/balita/${balita.id}/skrining-baru`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-laut-600 px-5 text-sm font-bold text-white shadow-md shadow-laut-600/20 transition-all hover:bg-laut-700 active:scale-95"
          >
            <Plus className="size-4" />
            Catat Pengukuran Baru
          </Link>
          {perluPKMKBalita && (
            <Link
              href="/dietisien"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-karawo-100 px-4 text-sm font-semibold text-karawo-700 ring-1 ring-karawo-400 hover:bg-karawo-200"
            >
              <Utensils className="size-4 text-karawo-500" />
              Formulasi PKMK
            </Link>
          )}
        </div>
      </div>

      {/* Banner & Alur Rujukan Terintegrasi Puskesmas ⇄ RSUD */}
      <BannerRujukanBalita balita={balita} peran={peran} />

      {/* Identitas Ringkas & Status Terkini */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Status Terkini Card */}
        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)] sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-tinta-400">
              Status Antropometri Terakhir (WHO {ENGINE_VERSION})
            </h2>
            {evaluasiVelocity && (
              <span
                className={[
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                  evaluasiVelocity.status === 'naik'
                    ? 'bg-emerald-100 text-emerald-800'
                    : evaluasiVelocity.status === 'growth_faltering'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800',
                ].join(' ')}
              >
                <TrendingUp className="size-3" />
                {evaluasiVelocity.status === 'naik' ? 'N (Naik)' : 'T (Tidak Naik / Faltering)'}
              </span>
            )}
          </div>

          {skriningTerakhir ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                {statusTB && <LencanaStatus status={statusTB} />}
                {statusBB && <LencanaStatus status={statusBB} />}
                {statusBBUVal && <LencanaStatus status={statusBBUVal} />}
                {statusVelocityTerkini && <LencanaStatus status={statusVelocityTerkini} />}
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-xl bg-kabut-50 p-3.5 text-center text-xs">
                <div>
                  <p className="text-tinta-600">Berat Badan</p>
                  <p className="angka mt-0.5 text-base font-bold text-tinta-900">
                    {skriningTerakhir.beratKg} kg
                  </p>
                </div>
                <div>
                  <p className="text-tinta-600">Panjang / Tinggi</p>
                  <p className="angka mt-0.5 text-base font-bold text-tinta-900">
                    {skriningTerakhir.panjangCm} cm
                  </p>
                </div>
                <div>
                  <p className="text-tinta-600">Terakhir Diukur</p>
                  <p className="mt-0.5 font-bold text-tinta-900">
                    {formatTanggal(skriningTerakhir.tanggal)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-tinta-600">Belum ada catatan penimbangan.</p>
          )}
        </div>

        {/* Data Keluarga Card */}
        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-tinta-400">
            Data Orang Tua &amp; Kontak
          </h2>
          <dl className="mt-3 space-y-2 text-xs">
            <div>
              <dt className="text-tinta-400">Ibu Kandung</dt>
              <dd className="font-bold text-tinta-900">{balita.namaIbu ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-tinta-400">Ayah</dt>
              <dd className="font-semibold text-tinta-900">{balita.namaAyah ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-tinta-400">WhatsApp</dt>
              <dd className="angka font-semibold text-tinta-900">{balita.noHpOrtu ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-tinta-400">Alamat</dt>
              <dd className="text-tinta-900">{balita.alamat ?? '-'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Kartu Evaluasi Weight Increment / Growth Faltering Terkini */}
      {evaluasiVelocity && skriningSebelumnya && (
        <div
          className={[
            'rounded-2xl p-5 shadow-sm ring-1 transition-all',
            evaluasiVelocity.status === 'naik'
              ? 'bg-emerald-50/60 ring-emerald-200'
              : evaluasiVelocity.status === 'growth_faltering'
                ? 'bg-amber-50/70 ring-amber-300'
                : 'bg-rose-50/70 ring-rose-300',
          ].join(' ')}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className={[
                  'flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm',
                  evaluasiVelocity.status === 'naik'
                    ? 'bg-emerald-600'
                    : evaluasiVelocity.status === 'growth_faltering'
                      ? 'bg-amber-500'
                      : 'bg-rose-600',
                ].join(' ')}
              >
                <TrendingUp className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-base font-bold text-tinta-900">
                    Evaluasi Weight Increment &amp; Kenaikan BB (WHO)
                  </h3>
                  <span
                    className={[
                      'rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase',
                      evaluasiVelocity.status === 'naik'
                        ? 'bg-emerald-200 text-emerald-900'
                        : evaluasiVelocity.status === 'growth_faltering'
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-rose-200 text-rose-900',
                    ].join(' ')}
                  >
                    {evaluasiVelocity.status === 'naik'
                      ? 'Naik (N)'
                      : evaluasiVelocity.status === 'growth_faltering'
                        ? 'Growth Faltering (T)'
                        : 'Tidak Naik (T)'}
                  </span>
                </div>
                <p className="text-xs text-tinta-600 mt-0.5">
                  Membandingkan penimbangan {formatTanggal(skriningSebelumnya.tanggal)} ({skriningSebelumnya.beratKg} kg) ➔ {formatTanggal(skriningTerakhir.tanggal)} ({skriningTerakhir.beratKg} kg)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="rounded-xl bg-white/80 px-3.5 py-2 ring-1 ring-black/5 text-center">
                <span className="text-tinta-500 block text-[11px]">Kenaikan Riil</span>
                <span
                  className={[
                    'angka text-sm font-black',
                    evaluasiVelocity.kenaikanAktualGram > 0
                      ? 'text-emerald-700'
                      : evaluasiVelocity.kenaikanAktualGram === 0
                        ? 'text-tinta-800'
                        : 'text-rose-700',
                  ].join(' ')}
                >
                  {evaluasiVelocity.kenaikanAktualGram > 0 ? `+${evaluasiVelocity.kenaikanAktualGram}` : evaluasiVelocity.kenaikanAktualGram} g
                </span>
              </div>

              <div className="rounded-xl bg-white/80 px-3.5 py-2 ring-1 ring-black/5 text-center">
                <span className="text-tinta-500 block text-[11px]">
                  {sumberAmbangVelocity(evaluasiVelocity.metode).judul}
                </span>
                <span className="angka text-sm font-black text-laut-700">
                  {formatGramBertanda(evaluasiVelocity.kenaikanMinimalGram)}
                </span>
              </div>

              <div className="rounded-xl bg-white/80 px-3.5 py-2 ring-1 ring-black/5 text-center">
                <span className="text-tinta-500 block text-[11px]">Jarak Waktu</span>
                <span className="angka text-sm font-black text-tinta-900">
                  {evaluasiVelocity.selisihHari} hari
                </span>
              </div>
            </div>
          </div>

          {evaluasiVelocity.status === 'growth_faltering' && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-100/90 p-2.5 text-xs text-amber-900">
              <AlertTriangle className="size-4 shrink-0 text-amber-700 mt-0.5" />
              <span>
                <strong>Peringatan Dini:</strong> Kenaikan berat badan anak ({formatGramBertanda(evaluasiVelocity.kenaikanAktualGram)}) masih di bawah {sumberAmbangVelocity(evaluasiVelocity.metode).dalamKalimat} ({formatGramBertanda(evaluasiVelocity.kenaikanMinimalGram)}). Segera lakukan konseling asupan gizi dan evaluasi faktor infeksi sebelum berlanjut ke wasting/stunting.
                {sumberAmbangVelocity(evaluasiVelocity.metode).perkiraan && (
                  <span className="mt-1 block font-semibold">
                    {sumberAmbangVelocity(evaluasiVelocity.metode).keterangan}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Kurva Pertumbuhan WHO Interaktif Lengkap */}
      <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)] sm:p-6">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-lg font-bold text-tinta-900">
              Kurva Pertumbuhan WHO
            </h2>
            <p className="text-xs text-tinta-600">
              Standar baku WHO Child Growth Standards untuk BB/TB, TB/U, dan BB/U
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-laut-50 px-3 py-1 text-xs font-bold text-laut-700">
            <Sparkles className="size-3.5 text-karawo-500" />
            Tampilan Peran: {peran.toUpperCase()}
          </span>
        </div>

        <PanelKurva
          bbu={kurvaData.bbu}
          tbu={kurvaData.tbu}
          bbtb={kurvaData.bbtb}
          trenZ={kurvaData.trenZ}
          riwayat={balita.riwayat}
          jenisKelaminAwal={jenisKelaminEngine}
          peran={peran}
        />
      </div>

      {/* Riwayat Penimbangan Table */}
      <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-tinta-900">
              Riwayat Pengukuran Antropometri
            </h2>
            <p className="text-xs text-tinta-600">Daftar pemeriksaan terurut tanggal beserta evaluasi kenaikan berat badan</p>
          </div>
          <Link
            href="/velocity"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-laut-600 hover:text-laut-800"
          >
            <Calculator className="size-3.5" />
            Buka Kalkulator Weight Increment
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-kabut-200 bg-kabut-100 text-tinta-600">
                <th className="rounded-l-xl p-3">Tanggal</th>
                <th className="p-3">Umur</th>
                <th className="p-3">BB (kg)</th>
                <th className="p-3">Kenaikan BB (N/T)</th>
                <th className="p-3">TB/PB (cm)</th>
                <th className="p-3">Z BB/U</th>
                <th className="p-3">Z TB/U</th>
                <th className="p-3">Z BB/TB</th>
                <th className="rounded-r-xl p-3">Status Gizi (Kemenkes)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kabut-100">
              {balita.riwayat.map((r, i) => {
                const prev = i > 0 ? balita.riwayat[i - 1] : null
                const vel = prev ? hitungVelocity({
                  tanggalLahir: tglLahirVelocity(prev.tanggal),
                  jenisKelamin: jenisKelaminEngine,
                  tanggalAwal: prev.tanggal,
                  beratAwalKg: prev.beratKg,
                  tanggalAkhir: r.tanggal,
                  beratAkhirKg: r.beratKg,
                }) : null

                return (
                  <tr key={i} className="hover:bg-kabut-50">
                    <td className="p-3 font-semibold text-tinta-900">{formatTanggal(r.tanggal)}</td>
                    <td className="angka p-3">{formatUmurBulan(r.umurBulan)}</td>
                    <td className="angka p-3 font-bold text-tinta-900">{formatBerat(r.beratKg)}</td>
                    {/*
                      TEMUAN AUDIT R-2: LENCANA N/T MEMVONIS YANG TIDAK DIVONIS

                      Pemetaan lama hanya mengenal dua cabang: 'naik' menjadi N
                      hijau, 'growth_faltering' menjadi T kuning, dan SEGALA
                      yang lain menjadi T merah. Padahal `StatusVelocity` punya
                      lima nilai. Akibatnya `tidak_dapat_dinilai` — jarak timbang
                      di bawah 21 hari atau di atas 110 hari, keadaan yang mesin
                      TOLAK untuk dinilai — tersaji sebagai "T" merah, yaitu
                      vonis gagal tumbuh pada KMS. Mesin berkata tidak tahu,
                      layar berkata tidak naik.

                      Sekarang kodenya diterjemahkan `tampilanVelocity`, satu
                      tempat yang sama dengan seluruh aplikasi (AGENTS.md 2.4).
                    */}
                    <td className="p-3">
                      {vel && vel.status !== 'tidak_dapat_dinilai' ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={[
                              'angka font-bold',
                              vel.kenaikanAktualGram > 0
                                ? 'text-emerald-700'
                                : vel.kenaikanAktualGram === 0
                                  ? 'text-tinta-700'
                                  : 'text-rose-700',
                            ].join(' ')}
                          >
                            {formatGramBertanda(vel.kenaikanAktualGram)}
                          </span>
                          <span
                            title={tampilanVelocity(vel.status).label}
                            className={[
                              'rounded px-1.5 py-0.5 text-[10px] font-black uppercase',
                              tampilanVelocity(vel.status).nada === 'aman'
                                ? 'bg-emerald-100 text-emerald-800'
                                : tampilanVelocity(vel.status).nada === 'waspada'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800',
                            ].join(' ')}
                          >
                            {vel.status === 'naik' ? 'N' : 'T'}
                          </span>
                        </div>
                      ) : vel ? (
                        <span className="text-tinta-400 text-[11px]" title="Jarak antar penimbangan di luar rentang yang dapat dinilai">
                          Tidak dapat dinilai
                        </span>
                      ) : (
                        <span className="text-tinta-400 text-[11px]">- (Titik Awal)</span>
                      )}
                    </td>
                    {/*
                      TEMUAN AUDIT R-4: kolom ini dahulu menampilkan panjang
                      MENTAH, sementara ketiga nilai Z di sebelahnya dihitung
                      dari panjang TERKOREKSI. Satu baris memuat dua angka yang
                      tidak saling bersesuaian: "78,0 cm" di samping Z yang
                      berasal dari 78,7 cm. Yang ditampilkan sekarang adalah
                      angka yang benar-benar dipakai menghitung; angka mentahnya
                      tetap dapat dibaca lewat keterangan pada sel.
                    */}
                    <td
                      className="angka p-3 font-bold text-tinta-900"
                      title={
                        Math.abs(r.panjangTerkoreksiCm - r.panjangCm) > 0.01
                          ? `Terukur ${formatPanjang(r.panjangCm)}, dikoreksi posisi menjadi ${formatPanjang(r.panjangTerkoreksiCm)}`
                          : undefined
                      }
                    >
                      {formatPanjang(r.panjangTerkoreksiCm)}
                      {Math.abs(r.panjangTerkoreksiCm - r.panjangCm) > 0.01 && (
                        <span className="ml-1 text-[10px] font-semibold text-tinta-400">
                          (terkoreksi)
                        </span>
                      )}
                    </td>
                    <td className="angka p-3">{formatZ(r.z_bbu)}</td>
                    <td className="angka p-3">{formatZ(r.z_tbu)}</td>
                    <td className="angka p-3">{formatZ(r.z_bbtb)}</td>
                    {/*
                      TEMUAN AUDIT R-1: TEKS DITURUNKAN DARI KODE, WARNA HILANG

                      Bentuk lama menyusun label dengan `replace(/_/g, ' ')` lalu
                      `capitalize` — menurunkan teks yang dibaca pengguna dari
                      KODE kategori, persis yang dilarang tajuk `status.ts`. Dan
                      karena lencananya selalu kelabu, "gizi buruk" tampil dalam
                      pil yang sama persis dengan "gizi baik". Pada tabel yang
                      dibaca dokter untuk mencari kasus, satu-satunya kolom yang
                      menyebut status justru tidak membedakan yang parah.
                    */}
                    <td className="p-3">
                      {r.statusBBTB ? (
                        <LencanaStatus status={tampilanBBTB(r.statusBBTB)} ukuran="kecil" />
                      ) : (
                        <span className="text-[11px] text-tinta-400">Tidak dinilai</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
