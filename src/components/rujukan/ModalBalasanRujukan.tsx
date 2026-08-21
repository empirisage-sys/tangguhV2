'use client'

import { useState } from 'react'
import { CheckCircle2, FileText, Hospital, Send, Stethoscope, Utensils, X } from 'lucide-react'
import { tanggapiRujukan, type RujukanDetail, type StatusRujukan } from '@/lib/db/rujukan'
import { Button } from '@/components/ui/Button'

type Props = {
  rujukan: RujukanDetail
  terbuka: boolean
  onTutup: () => void
  onSukses: (rujukan: RujukanDetail) => void
  namaSpesialis?: string
}

export function ModalBalasanRujukan({
  rujukan,
  terbuka,
  onTutup,
  onSukses,
  namaSpesialis = 'dr. Andi Kurniawan, Sp.A',
}: Props) {
  const [status, setStatus] = useState<StatusRujukan>('selesai')
  const [dokter, setDokter] = useState<string>(rujukan.namaDokterSpesialis || namaSpesialis)
  const [diagnosisDefinitif, setDiagnosisDefinitif] = useState<string>(
    rujukan.diagnosisDefinitifRS || 'Severe Wasting ec Intake Nutrisi Suboptimal + Post-Diare Akut',
  )
  const [tatalaksana, setTatalaksana] = useState<string>(
    rujukan.tatalaksanaLanjutan ||
      'Tatalaksana nutrisi fase stabilisasi & transisi, suplementasi mikronutrien (Zinc 20mg/hari, Vit A), peresepan PKMK Oral Tinggi Kalori 100 kkal/100ml.',
  )
  const [rekomendasiPKMK, setRekomendasiPKMK] = useState<string>(
    rujukan.rekomendasiPKMK ||
      'PKMK Tinggi Kalori (Target Energi Catch-Up: 1020 kkal/hari). Takaran: 4 sendok takar dilarutkan dalam 180 ml air hangat, diberikan 3-4 kali sehari.',
  )
  const [catatan, setCatatan] = useState<string>(
    rujukan.catatanBalasan ||
      'Pasien dalam kondisi perbaikan klinis tanpa tanda dehidrasi/komplikasi berat. Dirujuk balik ke Puskesmas untuk pemantauan kepatuhan konsumsi PKMK dan penimbangan BB mingguan.',
  )
  const [sedangSimpan, setSedangSimpan] = useState<boolean>(false)

  if (!terbuka) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSedangSimpan(true)

    setTimeout(() => {
      const hasil = tanggapiRujukan(rujukan.id, {
        status,
        namaDokterSpesialis: dokter,
        diagnosisDefinitifRS: diagnosisDefinitif,
        tatalaksanaLanjutan: tatalaksana,
        rekomendasiPKMK,
        catatanBalasan: catatan,
      })

      setSedangSimpan(false)
      if (hasil) onSukses(hasil)
      onTutup()
    }, 600)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-kabut-200 sm:p-7 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onTutup}
          className="absolute right-5 top-5 flex size-8 items-center justify-center rounded-full bg-kabut-100 text-tinta-600 hover:bg-kabut-200 transition-colors"
        >
          <X className="size-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-kabut-200 pb-4">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
            <Stethoscope className="size-6" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-tinta-900">
              Catatan Balasan Konsultasi &amp; Rujuk Balik RSUD
            </h2>
            <p className="text-xs text-tinta-600">
              Pasien: <span className="font-bold text-tinta-900">{rujukan.namaBalita}</span> • Asal: {rujukan.namaPuskesmas}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
          {/* Status Rujukan */}
          <div>
            <label className="block font-bold uppercase tracking-wider text-tinta-700">
              Status Respon Rujukan
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('diterima')}
                className={[
                  'flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all',
                  status === 'diterima'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'border border-kabut-200 bg-white text-tinta-700 hover:bg-amber-50',
                ].join(' ')}
              >
                🏥 Sedang Ditangani di RS
              </button>
              <button
                type="button"
                onClick={() => setStatus('selesai')}
                className={[
                  'flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all',
                  status === 'selesai'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'border border-kabut-200 bg-white text-tinta-700 hover:bg-emerald-50',
                ].join(' ')}
              >
                ✅ Selesai (Rujuk Balik ke Puskesmas)
              </button>
            </div>
          </div>

          {/* Dokter Spesialis */}
          <div>
            <label className="block font-bold uppercase tracking-wider text-tinta-700">
              Dokter Spesialis Anak Pemeriksa <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={dokter}
              onChange={(e) => setDokter(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
              required
            />
          </div>

          {/* Diagnosis Definitif */}
          <div>
            <label className="block font-bold uppercase tracking-wider text-tinta-700">
              Diagnosis Definitif Spesialis Anak <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={diagnosisDefinitif}
              onChange={(e) => setDiagnosisDefinitif(e.target.value)}
              placeholder="Contoh: Severe Wasting ec Penyakit Jantung Bawaan / Asupan Kurang"
              className="mt-1.5 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
              required
            />
          </div>

          {/* Rekomendasi Terapi PKMK */}
          <div>
            <label className="block font-bold uppercase tracking-wider text-tinta-700">
              Formulasi &amp; Rekomendasi Terapi PKMK (Pangan Medis Khusus)
            </label>
            <textarea
              rows={2}
              value={rekomendasiPKMK}
              onChange={(e) => setRekomendasiPKMK(e.target.value)}
              placeholder="Jenis PKMK, takaran saji sendok takar, frekuensi pemberian..."
              className="mt-1.5 w-full rounded-xl border border-kabut-200 bg-white p-3 text-xs font-medium text-tinta-900 focus:border-laut-500 focus:outline-none leading-relaxed"
            />
          </div>

          {/* Tatalaksana Lanjutan */}
          <div>
            <label className="block font-bold uppercase tracking-wider text-tinta-700">
              Tatalaksana Medis &amp; Terapi Farmakologi
            </label>
            <textarea
              rows={2}
              value={tatalaksana}
              onChange={(e) => setTatalaksana(e.target.value)}
              placeholder="Pengobatan penyakit penyerta, vitamin, pemantauan klinis..."
              className="mt-1.5 w-full rounded-xl border border-kabut-200 bg-white p-3 text-xs font-medium text-tinta-900 focus:border-laut-500 focus:outline-none leading-relaxed"
            />
          </div>

          {/* Catatan Balasan ke Puskesmas */}
          <div>
            <label className="block font-bold uppercase tracking-wider text-tinta-700">
              Catatan Balasan Rujukan (Instruksi Pemantauan di Puskesmas/Posyandu) <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Pesan untuk dokter & tim puskesmas mengenai rencana monitoring berat badan..."
              className="mt-1.5 w-full rounded-xl border border-kabut-200 bg-white p-3 text-xs font-medium text-tinta-900 focus:border-laut-500 focus:outline-none leading-relaxed"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" onClick={onTutup} varian="sekunder">
              Batal
            </Button>
            <Button
              type="submit"
              varian="utama"
              disabled={!diagnosisDefinitif.trim() || !catatan.trim() || sedangSimpan}
              sedangProses={sedangSimpan}
            >
              <Send className="size-4" />
              Simpan &amp; Kirim Balasan Rujuk Balik
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
