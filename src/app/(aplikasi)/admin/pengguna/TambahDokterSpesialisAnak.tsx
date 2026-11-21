'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Stethoscope, X, Copy, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { buatSandiSementara, RS_BARU } from '@/lib/validasi/pendaftaran'
import { adminTambahDokterSpesialisAnak } from './aksi-dsa'
import type { OpsiWilayah } from './TabelManajemenPengguna'

type Props = {
  daftarRumahSakit: OpsiWilayah[]
  daftarKabupaten: OpsiWilayah[]
}

/**
 * Tombol dan formulir "Tambah Dokter Spesialis Anak".
 *
 * Akun dibuat dengan kata sandi sementara. Setelah berhasil, layar menampilkan
 * ringkasan yang dapat disalin dan dikirim ke dokter, karena sandi itu tidak
 * disimpan di mana pun dan tidak dapat dilihat lagi.
 */
export function TambahDokterSpesialisAnak({ daftarRumahSakit, daftarKabupaten }: Props) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [sedangProses, setSedangProses] = useState(false)
  const [pesanGalat, setPesanGalat] = useState<string | null>(null)
  const [galatMedan, setGalatMedan] = useState<Record<string, string>>({})
  const [rumahSakitId, setRumahSakitId] = useState('')
  const [sandi, setSandi] = useState('')
  const [ringkasan, setRingkasan] = useState<string | null>(null)
  const [tersalin, setTersalin] = useState(false)
  const [pesanSukses, setPesanSukses] = useState('')

  const buka = () => {
    setTerbuka(true)
    setPesanGalat(null)
    setGalatMedan({})
    setRumahSakitId('')
    setSandi(buatSandiSementara())
    setRingkasan(null)
    setTersalin(false)
  }

  const kirim = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSedangProses(true)
    setPesanGalat(null)
    setGalatMedan({})
    const fd = new FormData(e.currentTarget)
    const res = await adminTambahDokterSpesialisAnak(fd)
    setSedangProses(false)
    if (!res.ok) {
      setPesanGalat(res.pesan ?? 'Akun belum dapat dibuat.')
      setGalatMedan(res.galatMedan ?? {})
      return
    }
    const email = String(fd.get('email') ?? '').trim().toLowerCase()
    setRingkasan(
      `Akun TANGGUH Anda sudah dibuat.\n` +
        `Alamat: ${window.location.origin}/masuk\n` +
        `Email: ${email}\n` +
        `Kata sandi sementara: ${sandi}\n` +
        `Saat masuk pertama kali, Anda akan diminta membuat kata sandi baru.`,
    )
    setPesanSukses(res.pesan ?? 'Akun berhasil dibuat.')
    router.refresh()
  }

  const salin = async () => {
    if (!ringkasan) return
    try {
      await navigator.clipboard.writeText(ringkasan)
      setTersalin(true)
    } catch {
      setTersalin(false)
    }
  }

  const kelas =
    'mt-1 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3.5 text-sm text-tinta-900 focus:border-laut-500 focus:outline-none focus:ring-2 focus:ring-laut-500/20'
  const Galat = ({ medan }: { medan: string }) =>
    galatMedan[medan] ? <p className="mt-1 text-xs font-semibold text-bahaya-teks">{galatMedan[medan]}</p> : null

  return (
    <>
      <Button type="button" varian="utama" onClick={buka}>
        <Stethoscope className="size-4" />
        Tambah Dokter Spesialis Anak
      </Button>

      {terbuka && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="judul-tambah-dsa"
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-kabut-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-laut-100 text-laut-700">
                  <Stethoscope className="size-4" />
                </div>
                <div>
                  <h3 id="judul-tambah-dsa" className="font-bold text-tinta-900">Tambah Dokter Spesialis Anak</h3>
                  <p className="text-xs text-tinta-500">Akun langsung aktif dengan kata sandi sementara</p>
                </div>
              </div>
              <button type="button" onClick={() => setTerbuka(false)} aria-label="Tutup"
                className="rounded-lg p-1.5 text-tinta-400 hover:bg-kabut-100 hover:text-tinta-700">
                <X className="size-5" />
              </button>
            </div>

            {ringkasan ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3 rounded-xl bg-aman-bg p-4 text-sm font-semibold text-aman-teks ring-1 ring-aman-garis">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                  <p>{pesanSukses}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-tinta-700">
                    Kirim pesan ini ke dokter (kata sandi tidak dapat dilihat lagi setelah jendela ditutup):
                  </p>
                  <pre className="mt-1.5 whitespace-pre-wrap rounded-xl bg-kabut-50 p-3 text-xs text-tinta-900 ring-1 ring-kabut-200">{ringkasan}</pre>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" varian="sekunder" onClick={salin}>
                    <Copy className="size-4" /> {tersalin ? 'Tersalin' : 'Salin pesan'}
                  </Button>
                  <Button type="button" varian="utama" onClick={() => setTerbuka(false)}>Selesai</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={kirim} className="mt-5 space-y-4">
                {pesanGalat && (
                  <div role="alert" className="flex items-center gap-3 rounded-xl bg-bahaya-bg p-3 text-sm font-semibold text-bahaya-teks ring-1 ring-bahaya-garis">
                    <ShieldAlert className="size-5 shrink-0" />
                    <span>{pesanGalat}</span>
                  </div>
                )}
                <div>
                  <label htmlFor="dsa-nama" className="block text-xs font-semibold text-tinta-700">Nama lengkap dan gelar *</label>
                  <input id="dsa-nama" name="namaLengkap" required placeholder="dr. Nama, Sp.A" className={kelas} />
                  <Galat medan="namaLengkap" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="dsa-email" className="block text-xs font-semibold text-tinta-700">Email *</label>
                    <input id="dsa-email" name="email" type="email" required autoComplete="off" className={kelas} />
                    <Galat medan="email" />
                  </div>
                  <div>
                    <label htmlFor="dsa-hp" className="block text-xs font-semibold text-tinta-700">Nomor HP</label>
                    <input id="dsa-hp" name="noHp" inputMode="tel" placeholder="08…" className={kelas} />
                    <Galat medan="noHp" />
                  </div>
                </div>
                <div>
                  <label htmlFor="dsa-str" className="block text-xs font-semibold text-tinta-700">Nomor STR *</label>
                  <input id="dsa-str" name="noStr" required minLength={5} className={kelas} />
                  <Galat medan="noStr" />
                </div>
                <div>
                  <label htmlFor="dsa-rs" className="block text-xs font-semibold text-tinta-700">Rumah sakit tempat bertugas *</label>
                  <select id="dsa-rs" name="rumahSakitId" required value={rumahSakitId}
                    onChange={(e) => setRumahSakitId(e.target.value)} className={kelas}>
                    <option value="">— Pilih rumah sakit —</option>
                    {daftarRumahSakit.map((r) => (
                      <option key={r.id} value={r.id}>{r.nama}</option>
                    ))}
                    <option value={RS_BARU}>Rumah sakit lain — ketik namanya</option>
                  </select>
                  <Galat medan="rumahSakitId" />
                </div>
                {rumahSakitId === RS_BARU && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="dsa-rs-baru" className="block text-xs font-semibold text-tinta-700">Nama rumah sakit *</label>
                      <input id="dsa-rs-baru" name="namaRsBaru" required className={kelas} />
                      <Galat medan="namaRsBaru" />
                    </div>
                    <div>
                      <label htmlFor="dsa-kab" className="block text-xs font-semibold text-tinta-700">Kabupaten/Kota *</label>
                      <select id="dsa-kab" name="kabupatenId" required className={kelas} defaultValue="">
                        <option value="">— Pilih —</option>
                        {daftarKabupaten.map((k) => (
                          <option key={k.id} value={k.id}>{k.nama}</option>
                        ))}
                      </select>
                      <Galat medan="kabupatenId" />
                    </div>
                    <p className="text-[11px] text-tinta-500 sm:col-span-2">
                      Rumah sakit baru tercatat sebagai usulan dan dapat dinormalkan di menu Verifikasi.
                    </p>
                  </div>
                )}
                <div>
                  <label htmlFor="dsa-sandi" className="block text-xs font-semibold text-tinta-700">Kata sandi sementara *</label>
                  <div className="mt-1 flex gap-2">
                    <input id="dsa-sandi" name="sandiSementara" required minLength={8} value={sandi}
                      onChange={(e) => setSandi(e.target.value)} autoComplete="off"
                      className={`${kelas} mt-0 font-mono`} />
                    <button type="button" onClick={() => setSandi(buatSandiSementara())}
                      aria-label="Buat sandi acak baru"
                      className="flex h-11 shrink-0 items-center gap-1 rounded-xl border border-kabut-200 px-3 text-xs font-bold text-tinta-700 hover:bg-kabut-100">
                      <RefreshCw className="size-4" /> Acak
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-tinta-500">
                    Dokter wajib mengganti sandi ini saat masuk pertama kali.
                  </p>
                  <Galat medan="sandiSementara" />
                </div>
                <div className="flex justify-end gap-2 border-t border-kabut-200 pt-4">
                  <Button type="button" varian="sekunder" onClick={() => setTerbuka(false)}>Batal</Button>
                  <Button type="submit" varian="utama" sedangProses={sedangProses}>Buat Akun</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
