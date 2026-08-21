'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Hospital, Lock, Send, ShieldAlert, X } from 'lucide-react'
import { RUMAH_SAKIT_GORONTALO } from '@/lib/db/wilayah'
import { tambahRujukan, type RujukanDetail } from '@/lib/db/rujukan'
import type { BalitaDetail } from '@/lib/db/balita-mock'
import { Button } from '@/components/ui/Button'

type Props = {
  balita: BalitaDetail
  terbuka: boolean
  onTutup: () => void
  onSukses: (rujukan: RujukanDetail) => void
  namaPengaju?: string
}

export function ModalTerbitkanRujukan({
  balita,
  terbuka,
  onTutup,
  onSukses,
  namaPengaju = 'dr. Hendra Pratama (Puskesmas)',
}: Props) {
  const [rsTujuanId, setRsTujuanId] = useState<string>(RUMAH_SAKIT_GORONTALO[0]?.id || '')
  const [alasan, setAlasan] = useState<string>(
    'Gizi buruk (BB/TB < -3 SD), stunting berat, dan indikasi tatalaksana medis spesialistik komprehensif.',
  )
  const [diagnosisAwal, setDiagnosisAwal] = useState<string>(
    'Severe Acute Malnutrition (SAM) / Gizi Buruk',
  )
  const [sedangKirim, setSedangKirim] = useState<boolean>(false)
  const [setujuPeringatan, setSetujuPeringatan] = useState<boolean>(true)

  if (!terbuka) return null

  const rsTerpilih = RUMAH_SAKIT_GORONTALO.find((r) => r.id === rsTujuanId) || RUMAH_SAKIT_GORONTALO[0]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rsTujuanId || !alasan.trim()) return

    setSedangKirim(true)
    setTimeout(() => {
      const hasil = tambahRujukan({
        balitaId: balita.id,
        namaBalita: balita.nama,
        nik: balita.nik,
        tanggalLahir: balita.tanggalLahir,
        jenisKelamin: balita.jenisKelamin,
        umurBulan: balita.riwayat[balita.riwayat.length - 1]?.umurBulan || 24,
        namaIbu: balita.namaIbu,
        noHpOrtu: balita.noHpOrtu,
        alamat: balita.alamat,
        puskesmasId: balita.puskesmasId,
        namaPuskesmas: balita.namaPuskesmas,
        namaKabupaten: balita.namaKabupaten,
        rsTujuanId: rsTerpilih.id,
        namaRsTujuan: rsTerpilih.nama,
        alasanRujukan: alasan,
        diagnosisAwal: diagnosisAwal,
        diajukanOlehNama: namaPengaju,
        diajukanOlehPeran: 'Dokter Puskesmas',
      })

      setSedangKirim(false)
      onSukses(hasil)
      onTutup()
    }, 600)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-kabut-200 sm:p-7 max-h-[90vh] overflow-y-auto">
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
          <div className="flex size-11 items-center justify-center rounded-2xl bg-red-100 text-red-700">
            <Hospital className="size-6" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-tinta-900">
              Terbitkan Rujukan ke Rumah Sakit
            </h2>
            <p className="text-xs text-tinta-600">
              Pasien Balita: <span className="font-bold text-tinta-900">{balita.nama}</span> ({balita.namaPuskesmas})
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
          {/* Rumah Sakit Tujuan */}
          <div>
            <label className="block font-bold uppercase tracking-wider text-tinta-700">
              Rumah Sakit Rujukan Tujuan (RSUD se-Gorontalo) <span className="text-red-500">*</span>
            </label>
            <select
              value={rsTujuanId}
              onChange={(e) => setRsTujuanId(e.target.value)}
              className="mt-1.5 h-12 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-sm font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
            >
              {RUMAH_SAKIT_GORONTALO.map((rs) => (
                <option key={rs.id} value={rs.id}>
                  {rs.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Diagnosis Kerja Awal */}
          <div>
            <label className="block font-bold uppercase tracking-wider text-tinta-700">
              Diagnosis Kerja / Indikasi Rujukan <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={diagnosisAwal}
              onChange={(e) => setDiagnosisAwal(e.target.value)}
              placeholder="Misal: Gizi Buruk (Severe Wasting) & Failure to Thrive"
              className="mt-1.5 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
              required
            />
          </div>

          {/* Alasan & Anamnesis Ringkas */}
          <div>
            <label className="block font-bold uppercase tracking-wider text-tinta-700">
              Alasan Rujukan &amp; Riwayat Klinis <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Tuliskan temuan klinis, hasil antropometri, penyakit penyerta, dan alasan perujukan..."
              className="mt-1.5 w-full rounded-xl border border-kabut-200 bg-white p-3 text-xs font-medium text-tinta-900 focus:border-laut-500 focus:outline-none leading-relaxed"
              required
            />
          </div>

          {/* ⚠️ Peringatan Keamanan & Hak Akses Medis 90 Hari (Instruksi Wajib) */}
          <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-amber-900 shadow-sm space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <Lock className="size-4 text-amber-700 shrink-0" />
              <span>Pemberitahuan Hak Akses Medis Rujukan (90 Hari)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Dengan menerbitkan rujukan ini, Dokter Spesialis Anak dan tim medis di <strong>{rsTerpilih.nama}</strong> akan secara otomatis diberikan hak akses membaca <strong>seluruh riwayat penimbangan antropometri dan kurva pertumbuhan WHO balita ini sejak lahir</strong> selama masa aktif rujukan (90 hari).
            </p>
            <label className="flex items-center gap-2 pt-1 cursor-pointer font-bold text-xs text-amber-950">
              <input
                type="checkbox"
                checked={setujuPeringatan}
                onChange={(e) => setSetujuPeringatan(e.target.checked)}
                className="size-4 rounded text-laut-600 focus:ring-laut-500"
              />
              <span>Saya memahami dan menyetujui pembukaan akses rekam medis rujukan 90 hari.</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" onClick={onTutup} varian="sekunder">
              Batal
            </Button>
            <Button
              type="submit"
              varian="utama"
              disabled={!setujuPeringatan || !alasan.trim() || sedangKirim}
              sedangProses={sedangKirim}
            >
              <Send className="size-4" />
              Kirim Rujukan ke RSUD
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
