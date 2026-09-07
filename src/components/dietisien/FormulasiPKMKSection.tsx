'use client'

import { useMemo, useState, useTransition } from 'react'
import { AlertTriangle, Calculator, CheckCircle2, Info, Printer, ShieldAlert, Utensils } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  PERINGATAN_DATA_PRODUK,
  PRODUK_PKMK,
  produkUntukUmur,
  type ProdukPKMK,
} from '@/lib/pkmk/produk'
import {
  BATAS,
  hitungTakaran,
  pilihanTakaran,
  sisaDariMakanan,
  type ModeTakaran,
} from '@/lib/pkmk/hitung'
import {
  bacaSeluruhPeringatan,
  keteranganProduk,
  ringkasanTakaran,
} from '@/lib/pkmk/teks'

export type DataAsuhanGiziPKMK = {
  tataLaksana: string
  produkId: string
  produkNama: string
  mode: ModeTakaran
  targetKaloriPersen: number
  targetKkal: number
  frekuensiPerHari: number
  sendokPerSaji: number
  sendokPerHari: number
  kkalDiberikan: number
  selisihKkal: number
  persenTerhadapTarget: number
  mlLarutanPerSaji: number
  mlLarutanPerHari: number
  sisaDariMakananKkal: number
  ringkasan: string
  peringatan: string[]
}

/** Bentuk balasan Server Action penyimpanan. Sengaja lepas dari modul server. */
export type BalasanSimpan = {
  ok: boolean
  pesan?: string
  galatMedan?: Record<string, string>
  ringkasan?: string
}

export type FormulasiPKMKProps = {
  namaBalita?: string
  umurBulan?: number
  beratKg?: number
  targetEnergiDefaultKkal?: number
  /** Wajib diisi bila `aksiSimpan` diberikan. */
  balitaId?: string
  skriningId?: string
  /**
   * Server Action penyimpanan. Komponen hanya mengirim MASUKAN mentah;
   * seluruh angka hasil dihitung ulang di server.
   */
  aksiSimpan?: (formData: FormData) => Promise<BalasanSimpan>
  onSimpan?: (data: DataAsuhanGiziPKMK) => void
}

const KELAS_NADA: Record<'waspada' | 'bahaya', string> = {
  waspada: 'border-waspada-garis/50 bg-waspada-bg text-waspada-teks',
  bahaya: 'border-bahaya-garis/50 bg-bahaya-bg text-bahaya-teks',
}

function angka(nilai: number): string {
  const n = Math.round(nilai * 10) / 10
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

export function FormulasiPKMKSection({
  namaBalita = 'Balita',
  umurBulan = 24,
  targetEnergiDefaultKkal = 770,
  balitaId,
  skriningId,
  aksiSimpan,
  onSimpan,
}: FormulasiPKMKProps) {
  const produkTersedia = useMemo<ProdukPKMK[]>(() => {
    const sesuaiUmur = produkUntukUmur(umurBulan)
    return sesuaiUmur.length > 0 ? sesuaiUmur : PRODUK_PKMK
  }, [umurBulan])

  const [tataLaksana, setTataLaksana] = useState('PKMK + observasi 2 minggu')
  const [targetPersen, setTargetPersen] = useState(80)
  const [produkId, setProdukId] = useState(produkTersedia[0]!.id)
  const [mode, setMode] = useState<ModeTakaran>('dari_takaran')
  const [frekuensi, setFrekuensi] = useState(3)
  const [sendokPerSaji, setSendokPerSaji] = useState(3)
  const [sedangSimpan, mulaiSimpan] = useTransition()
  const [balasan, setBalasan] = useState<BalasanSimpan | null>(null)
  const [sedangCetak, setSedangCetak] = useState(false)

  const produk = useMemo(
    () => produkTersedia.find((p) => p.id === produkId) ?? produkTersedia[0]!,
    [produkTersedia, produkId],
  )

  const targetKkal = Math.round((targetEnergiDefaultKkal * targetPersen) / 100)

  // SATU sumber kebenaran. Setiap angka di layar ini berasal dari objek ini.
  const hasil = useMemo(
    () =>
      hitungTakaran({
        produk,
        mode,
        frekuensiPerHari: frekuensi,
        sendokPerSaji,
        targetKkal,
      }),
    [produk, mode, frekuensi, sendokPerSaji, targetKkal],
  )

  const peringatan = bacaSeluruhPeringatan(hasil)
  const sisaMakanan = sisaDariMakanan(targetEnergiDefaultKkal, hasil)
  const daftarPilihan = useMemo(
    () => (mode === 'dari_target' ? pilihanTakaran(produk, targetKkal) : []),
    [mode, produk, targetKkal],
  )

  const handleSimpan = () => {
    setBalasan(null)

    // Jalur tersimpan sungguhan: kirim MASUKAN mentah saja.
    // Server menghitung ulang takarannya, sehingga angka yang tersimpan tidak
    // pernah bergantung pada apa yang dikirim layar ini.
    if (aksiSimpan && balitaId) {
      const formData = new FormData()
      formData.set('balitaId', balitaId)
      if (skriningId) formData.set('skriningId', skriningId)
      formData.set('tataLaksana', tataLaksana)
      formData.set('produkId', produk.id)
      formData.set('mode', mode)
      formData.set('targetPersen', String(targetPersen))
      formData.set('frekuensiPerHari', String(hasil.frekuensiPerHari))
      if (mode === 'dari_takaran') {
        formData.set('sendokPerSaji', String(hasil.sendokPerSaji))
      }

      mulaiSimpan(async () => {
        try {
          setBalasan(await aksiSimpan(formData))
        } catch {
          setBalasan({
            ok: false,
            pesan: 'Asuhan gizi belum tersimpan karena gangguan jaringan. Coba lagi.',
          })
        }
      })
      return
    }

    const data: DataAsuhanGiziPKMK = {
      tataLaksana,
      produkId: produk.id,
      produkNama: produk.nama,
      mode,
      targetKaloriPersen: targetPersen,
      targetKkal: hasil.targetKkal,
      frekuensiPerHari: hasil.frekuensiPerHari,
      sendokPerSaji: hasil.sendokPerSaji,
      sendokPerHari: hasil.sendokPerHari,
      kkalDiberikan: hasil.kkalDiberikan,
      selisihKkal: hasil.selisihKkal,
      persenTerhadapTarget: hasil.persenTerhadapTarget,
      mlLarutanPerSaji: hasil.mlLarutanPerSaji,
      mlLarutanPerHari: hasil.mlLarutanPerHari,
      sisaDariMakananKkal: sisaMakanan,
      ringkasan: ringkasanTakaran(hasil),
      peringatan: peringatan.map((p) => p.pesan),
    }
    if (onSimpan) {
      onSimpan(data)
      setBalasan({ ok: true, pesan: 'Asuhan gizi tersimpan.', ringkasan: data.ringkasan })
    } else {
      alert(
        `Asuhan gizi ${namaBalita} disimpan.\n\n` +
          `${data.ringkasan}\n\n` +
          `Energi yang diberikan takaran ini: ${angka(data.kkalDiberikan)} kkal ` +
          `(${angka(data.persenTerhadapTarget)}% dari target ${angka(data.targetKkal)} kkal).`,
      )
    }
  }

  /**
   * Mencetak lembar asuhan gizi.
   *
   * Objek `hasil` yang sama dengan yang tampil di layar diteruskan apa adanya ke
   * pembuat PDF. Tidak ada perhitungan ulang, sehingga lembar yang dibawa pulang
   * tidak mungkin berbeda dari yang dilihat dietisien.
   */
  const handleCetak = async () => {
    setSedangCetak(true)
    try {
      const { buatPdfLembarAsuhanGizi } = await import('@/lib/ekspor/pdf-asuhan-gizi')
      const berkas = await buatPdfLembarAsuhanGizi(
        {
          namaBalita,
          umurBulan,
          tataLaksana: tataLaksana || '-',
          totalKebutuhanKkal: targetEnergiDefaultKkal,
        },
        hasil,
      )
      const url = URL.createObjectURL(
        new Blob([berkas as unknown as BlobPart], { type: 'application/pdf' }),
      )
      const tautan = document.createElement('a')
      tautan.href = url
      tautan.download = `Lembar_Asuhan_Gizi_${namaBalita.replace(/\s+/g, '_')}.pdf`
      tautan.click()
      URL.revokeObjectURL(url)
    } catch {
      setBalasan({ ok: false, pesan: 'Lembar asuhan gizi gagal dibuat. Coba lagi.' })
    } finally {
      setSedangCetak(false)
    }
  }

  const kelasSelect =
    'mt-1 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3 text-sm font-bold text-tinta-900 focus:border-laut-500 focus:outline-none'

  return (
    <div className="space-y-4 rounded-2xl border border-kabut-200 bg-white p-5 shadow-[var(--shadow-kartu)] sm:p-6">
      <div>
        <h2 className="font-display text-lg font-bold text-laut-800 sm:text-xl">
          Tata Laksana &amp; Rekomendasi Intervensi Gizi
        </h2>
        <p className="text-xs text-tinta-600">
          Untuk balita: <span className="font-bold text-tinta-900">{namaBalita}</span>
        </p>
      </div>

      {/* 1. Tata laksana klinis */}
      <div className="rounded-xl border border-kabut-200 bg-kabut-50/70 p-3.5">
        <label htmlFor="tataLaksanaSelect" className="block text-xs font-semibold text-laut-800">
          Tata Laksana (Klinis)
        </label>
        <select
          id="tataLaksanaSelect"
          value={tataLaksana}
          onChange={(e) => setTataLaksana(e.target.value)}
          className={kelasSelect}
        >
          <option value="">-- Pilih Tata Laksana --</option>
          <option value="PKMK + observasi 2 minggu">PKMK + observasi 2 minggu</option>
          <option value="PKMK + Observasi 4 minggu">PKMK + Observasi 4 minggu</option>
          <option value="Rujuk Spesialis Anak">Rujuk Spesialis Anak</option>
        </select>
      </div>

      {/* 2. Produk PKMK, beserta angka labelnya agar dapat diperiksa sendiri */}
      <div className="rounded-xl border border-kabut-200 bg-kabut-50/70 p-3.5">
        <label htmlFor="produkSelect" className="block text-xs font-semibold text-laut-800">
          Produk PKMK
        </label>
        <select
          id="produkSelect"
          value={produk.id}
          onChange={(e) => setProdukId(e.target.value)}
          className={kelasSelect}
        >
          {produkTersedia.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nama}
            </option>
          ))}
        </select>
        <p className="angka mt-1.5 text-[11px] font-semibold text-tinta-600">
          {keteranganProduk(hasil)}
        </p>
      </div>

      {/* 3. Cara menyusun takaran */}
      <div>
        <p className="text-xs font-semibold text-laut-800">Cara menyusun takaran</p>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode('dari_takaran')}
            aria-pressed={mode === 'dari_takaran'}
            className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
              mode === 'dari_takaran'
                ? 'border-laut-500 bg-laut-50 ring-1 ring-laut-500'
                : 'border-kabut-200 bg-white hover:border-laut-300'
            }`}
          >
            <Utensils className="mt-0.5 size-4 shrink-0 text-laut-700" />
            <span>
              <span className="block text-sm font-bold text-tinta-900">Saya tentukan takarannya</span>
              <span className="block text-[11px] text-tinta-600">
                Pilih frekuensi dan sendok per saji. Energinya dihitung aplikasi.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode('dari_target')}
            aria-pressed={mode === 'dari_target'}
            className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
              mode === 'dari_target'
                ? 'border-laut-500 bg-laut-50 ring-1 ring-laut-500'
                : 'border-kabut-200 bg-white hover:border-laut-300'
            }`}
          >
            <Calculator className="mt-0.5 size-4 shrink-0 text-laut-700" />
            <span>
              <span className="block text-sm font-bold text-tinta-900">Hitungkan dari target</span>
              <span className="block text-[11px] text-tinta-600">
                Pilih target dan frekuensi. Sendok per saji dihitung aplikasi.
              </span>
            </span>
          </button>
        </div>
      </div>

      {/* Dropdown masukan, sesuai mode */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="targetPersenSelect" className="block text-xs font-semibold text-tinta-700">
            Target Kalori PKMK
          </label>
          <select
            id="targetPersenSelect"
            value={targetPersen}
            onChange={(e) => setTargetPersen(Number(e.target.value))}
            className={kelasSelect}
          >
            {[0, 30, 40, 50, 60, 70, 80, 90, 100].map((pct) => (
              <option key={pct} value={pct}>
                {pct}%
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="frekuensiSelect" className="block text-xs font-semibold text-tinta-700">
            Frekuensi/Hari
          </label>
          <select
            id="frekuensiSelect"
            value={frekuensi}
            onChange={(e) => setFrekuensi(Number(e.target.value))}
            className={kelasSelect}
          >
            {Array.from({ length: BATAS.frekuensiMaks }, (_, i) => i + 1).map((f) => (
              <option key={f} value={f}>
                {f}x
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sendokSelect" className="block text-xs font-semibold text-tinta-700">
            Sendok Takar/Saji
          </label>
          {mode === 'dari_takaran' ? (
            <select
              id="sendokSelect"
              value={sendokPerSaji}
              onChange={(e) => setSendokPerSaji(Number(e.target.value))}
              className={kelasSelect}
            >
              {Array.from({ length: BATAS.sendokPerSajiMaks }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>
                  {s} sendok
                </option>
              ))}
            </select>
          ) : (
            <p
              id="sendokSelect"
              className="angka mt-1 flex h-11 w-full items-center rounded-xl border border-dashed border-laut-300 bg-laut-50 px-3 text-sm font-bold text-laut-800"
            >
              {angka(hasil.sendokPerSaji)} sendok (dihitung)
            </p>
          )}
        </div>
      </div>

      {/* 4. Kartu hasil — seluruhnya dari satu objek HasilTakaran */}
      <div className="rounded-xl border border-laut-200 bg-laut-50/60 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-tinta-500">
          Target Kebutuhan Energi Anak (Catch-up Growth: {angka(targetEnergiDefaultKkal)} kkal)
        </p>
        <p className="mt-2 font-display text-base font-black leading-snug text-laut-900 sm:text-lg">
          {ringkasanTakaran(hasil)}
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-3 ring-1 ring-kabut-200">
            <p className="text-[11px] font-semibold text-tinta-600">
              Energi yang diberikan takaran ini
            </p>
            <p className="angka text-xl font-black text-laut-800">
              {angka(hasil.kkalDiberikan)} kkal
            </p>
            <p className="angka mt-0.5 text-[11px] text-tinta-600">
              {angka(hasil.persenTerhadapTarget)}% dari target
            </p>
          </div>
          <div className="rounded-xl bg-white p-3 ring-1 ring-kabut-200">
            <p className="text-[11px] font-semibold text-tinta-600">
              Target Kalori PKMK ({targetPersen}%)
            </p>
            <p className="angka text-xl font-black text-tinta-900">{angka(hasil.targetKkal)} kkal</p>
            <p className="angka mt-0.5 text-[11px] text-tinta-600">
              Selisih {hasil.selisihKkal >= 0 ? '+' : '−'}
              {angka(Math.abs(hasil.selisihKkal))} kkal
            </p>
          </div>
        </div>

        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-xl bg-white p-3 ring-1 ring-kabut-200">
            <p className="text-[11px] text-tinta-600">Larutan per saji</p>
            <p className="angka text-sm font-bold text-tinta-900">
              {angka(hasil.mlLarutanPerSaji)} ml
            </p>
          </div>
          <div className="rounded-xl bg-white p-3 ring-1 ring-kabut-200">
            <p className="text-[11px] text-tinta-600">Larutan per hari</p>
            <p className="angka text-sm font-bold text-tinta-900">
              {angka(hasil.mlLarutanPerHari)} ml
            </p>
          </div>
          <div className="rounded-xl bg-white p-3 ring-1 ring-kabut-200">
            <p className="text-[11px] text-tinta-600">Sisa dari makanan keluarga / ASI</p>
            <p className="angka text-sm font-bold text-tinta-900">{angka(sisaMakanan)} kkal</p>
          </div>
        </div>
      </div>

      {/* 5. Peringatan — seluruhnya, tanpa disaring */}
      {peringatan.length > 0 && (
        <div className="space-y-2">
          {peringatan.map((p) => (
            <div
              key={p.kode}
              role="alert"
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${KELAS_NADA[p.nada]}`}
            >
              {p.nada === 'bahaya' ? (
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              )}
              <span>
                <span className="block font-bold">{p.pesan}</span>
                <span className="mt-0.5 block opacity-90">{p.saran}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 6. Tabel pilihan pada mode dari_target */}
      {mode === 'dari_target' && daftarPilihan.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-kabut-200">
          <table className="w-full min-w-[520px] text-left text-xs">
            <caption className="px-3 pt-3 text-left text-[11px] font-semibold text-tinta-600">
              Pilihan takaran untuk target {angka(targetKkal)} kkal. Tekan satu baris untuk memakainya.
            </caption>
            <thead className="text-[11px] uppercase tracking-wide text-tinta-500">
              <tr>
                <th scope="col" className="px-3 py-2">Frekuensi</th>
                <th scope="col" className="px-3 py-2">Sendok/saji</th>
                <th scope="col" className="px-3 py-2">Energi</th>
                <th scope="col" className="px-3 py-2">% target</th>
                <th scope="col" className="px-3 py-2">Volume/saji</th>
              </tr>
            </thead>
            <tbody>
              {daftarPilihan.map((p) => (
                <tr
                  key={p.frekuensiPerHari}
                  onClick={() => setFrekuensi(p.frekuensiPerHari)}
                  className={`cursor-pointer border-t border-kabut-200 hover:bg-laut-50 ${
                    p.frekuensiPerHari === hasil.frekuensiPerHari ? 'bg-laut-50 font-bold' : ''
                  }`}
                >
                  <td className="angka px-3 py-2">{p.frekuensiPerHari}x</td>
                  <td className="angka px-3 py-2">{angka(p.sendokPerSaji)}</td>
                  <td className="angka px-3 py-2">{angka(p.kkalDiberikan)} kkal</td>
                  <td className="angka px-3 py-2">{angka(p.persenTerhadapTarget)}%</td>
                  <td className="angka px-3 py-2">
                    {angka(p.mlLarutanPerSaji)} ml{' '}
                    <span className={p.volumeWajar ? 'text-tinta-500' : 'text-waspada-teks'}>
                      {p.volumeWajar ? '— wajar' : '— terlalu banyak'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Peringatan data produk, wajib di setiap layar dan setiap cetakan */}
      <div className="flex items-start gap-2.5 rounded-xl border border-waspada-garis/40 bg-waspada-bg p-3 text-[11px] text-waspada-teks">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>{PERINGATAN_DATA_PRODUK}</span>
      </div>

      <div className="space-y-2 pt-1">
        <Button
          type="button"
          onClick={handleSimpan}
          varian="utama"
          lebarPenuh
          disabled={sedangSimpan}
        >
          {sedangSimpan ? 'Menyimpan...' : 'Simpan Asuhan Gizi Balita'}
        </Button>

        <button
          type="button"
          onClick={handleCetak}
          disabled={sedangCetak}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-laut-300 bg-white text-sm font-bold text-laut-800 transition hover:bg-laut-50 disabled:opacity-60"
        >
          <Printer className="size-4" />
          {sedangCetak ? 'Menyiapkan lembar...' : 'Cetak Lembar Asuhan Gizi (PDF)'}
        </button>

        {balasan && (
          <div
            role="status"
            aria-live="polite"
            className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
              balasan.ok
                ? 'border-emerald-300/60 bg-emerald-50 text-emerald-900'
                : KELAS_NADA.bahaya
            }`}
          >
            {balasan.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            )}
            <span>
              <span className="block font-bold">{balasan.pesan}</span>
              {balasan.ringkasan && (
                <span className="mt-0.5 block opacity-90">{balasan.ringkasan}</span>
              )}
              {balasan.galatMedan &&
                Object.values(balasan.galatMedan).map((teks) => (
                  <span key={teks} className="mt-0.5 block opacity-90">
                    {teks}
                  </span>
                ))}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
