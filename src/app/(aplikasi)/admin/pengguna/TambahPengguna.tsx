'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X, Copy, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  buatSandiSementara,
  LABEL_PERAN,
  PERAN_DIBUAT_ADMIN,
  POSYANDU_BARU,
  RS_BARU,
  type PeranDibuatAdmin,
} from '@/lib/validasi/pendaftaran'
import { adminTambahPengguna } from './aksi-tambah-pengguna'
import type { OpsiPosyandu, OpsiWilayah } from './TabelManajemenPengguna'

type Props = {
  daftarPuskesmas: OpsiWilayah[]
  daftarPosyandu: OpsiPosyandu[]
  daftarRumahSakit: OpsiWilayah[]
  daftarKabupaten: OpsiWilayah[]
}

/**
 * Tombol dan formulir "Tambah Pengguna" (kader, dokter, dietisien, dokter
 * spesialis anak).
 *
 * Akun dibuat dengan kata sandi sementara. Setelah berhasil, layar menampilkan
 * pesan yang dapat disalin dan dikirim ke pengguna, karena sandi itu tidak
 * disimpan di mana pun dan tidak dapat dilihat lagi.
 */
export function TambahPengguna({ daftarPuskesmas, daftarPosyandu, daftarRumahSakit, daftarKabupaten }: Props) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [sedangProses, setSedangProses] = useState(false)
  const [pesanGalat, setPesanGalat] = useState<string | null>(null)
  const [galatMedan, setGalatMedan] = useState<Record<string, string>>({})
  const [peran, setPeran] = useState<PeranDibuatAdmin>('dokter_spesialis_anak')
  const [puskesmasId, setPuskesmasId] = useState('')
  const [posyanduId, setPosyanduId] = useState('')
  const [rumahSakitId, setRumahSakitId] = useState('')
  const [sandi, setSandi] = useState('')
  const [ringkasan, setRingkasan] = useState<string | null>(null)
  const [pesanSukses, setPesanSukses] = useState('')
  const [tersalin, setTersalin] = useState(false)

  const posyanduPuskesmas = useMemo(
    () => daftarPosyandu.filter((p) => p.puskesmasId === puskesmasId),
    [daftarPosyandu, puskesmasId],
  )

  const buka = () => {
    setTerbuka(true)
    setPesanGalat(null)
    setGalatMedan({})
    setPuskesmasId('')
    setPosyanduId('')
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
    const res = await adminTambahPengguna(fd)
    setSedangProses(false)
    if (!res.ok) {
      setPesanGalat(res.pesan ?? 'Akun belum dapat dibuat.')
      setGalatMedan(res.galatMedan ?? {})
      return
    }
    const email = String(fd.get('email') ?? '').trim().toLowerCase()
    setPesanSukses(res.pesan ?? 'Akun berhasil dibuat.')
    setRingkasan(
      `Akun TANGGUH Anda sudah dibuat.\n` +
        `Alamat: ${window.location.origin}/masuk\n` +
        `Email: ${email}\n` +
        `Kata sandi sementara: ${sandi}\n` +
        `Saat masuk pertama kali, Anda akan diminta membuat kata sandi baru.`,
    )
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
  const Label = ({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) => (
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-tinta-700">{children}</label>
  )

  return (
    <>
      <Button type="button" varian="utama" onClick={buka}>
        <UserPlus className="size-4" />
        Tambah Pengguna
      </Button>

      {terbuka && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="judul-tambah-pengguna"
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-kabut-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-laut-100 text-laut-700">
                  <UserPlus className="size-4" />
                </div>
                <div>
                  <h3 id="judul-tambah-pengguna" className="font-bold text-tinta-900">Tambah Pengguna</h3>
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
                    Kirim pesan ini ke pengguna (kata sandi tidak dapat dilihat lagi setelah jendela ditutup):
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
                  <Label htmlFor="tp-peran">Peran *</Label>
                  <select id="tp-peran" name="peran" value={peran}
                    onChange={(e) => setPeran(e.target.value as PeranDibuatAdmin)} className={kelas}>
                    {PERAN_DIBUAT_ADMIN.map((p) => (
                      <option key={p} value={p}>{LABEL_PERAN[p]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="tp-nama">Nama lengkap dan gelar *</Label>
                  <input id="tp-nama" name="namaLengkap" required className={kelas} />
                  <Galat medan="namaLengkap" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="tp-email">Email *</Label>
                    <input id="tp-email" name="email" type="email" required autoComplete="off" className={kelas} />
                    <Galat medan="email" />
                  </div>
                  <div>
                    <Label htmlFor="tp-hp">Nomor HP</Label>
                    <input id="tp-hp" name="noHp" inputMode="tel" placeholder="08…" className={kelas} />
                    <Galat medan="noHp" />
                  </div>
                </div>
                {peran !== 'kader' && (
                  <div>
                    <Label htmlFor="tp-str">Nomor STR *</Label>
                    <input id="tp-str" name="noStr" required minLength={5} className={kelas} />
                    <Galat medan="noStr" />
                  </div>
                )}

                {peran === 'dokter_spesialis_anak' ? (
                  <>
                    <div>
                      <Label htmlFor="tp-rs">Rumah sakit tempat bertugas *</Label>
                      <select id="tp-rs" name="rumahSakitId" required value={rumahSakitId}
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
                          <Label htmlFor="tp-rs-baru">Nama rumah sakit *</Label>
                          <input id="tp-rs-baru" name="namaRsBaru" required className={kelas} />
                          <Galat medan="namaRsBaru" />
                        </div>
                        <div>
                          <Label htmlFor="tp-kab">Kabupaten/Kota *</Label>
                          <select id="tp-kab" name="kabupatenId" required className={kelas} defaultValue="">
                            <option value="">— Pilih —</option>
                            {daftarKabupaten.map((k) => (
                              <option key={k.id} value={k.id}>{k.nama}</option>
                            ))}
                          </select>
                          <Galat medan="kabupatenId" />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="tp-pkm">Puskesmas tempat bertugas *</Label>
                      <select id="tp-pkm" name="puskesmasId" required value={puskesmasId}
                        onChange={(e) => { setPuskesmasId(e.target.value); setPosyanduId('') }} className={kelas}>
                        <option value="">— Pilih puskesmas —</option>
                        {daftarPuskesmas.map((p) => (
                          <option key={p.id} value={p.id}>{p.nama}</option>
                        ))}
                      </select>
                      <Galat medan="puskesmasId" />
                    </div>
                    {peran === 'kader' && puskesmasId && (
                      <div>
                        <Label htmlFor="tp-pos">Posyandu *</Label>
                        <select id="tp-pos" name="posyanduId" required value={posyanduId}
                          onChange={(e) => setPosyanduId(e.target.value)} className={kelas}>
                          <option value="">— Pilih posyandu —</option>
                          {posyanduPuskesmas.map((p) => (
                            <option key={p.id} value={p.id}>{p.desa ? `${p.nama} — ${p.desa}` : p.nama}</option>
                          ))}
                          <option value={POSYANDU_BARU}>Posyandu lain — ketik namanya</option>
                        </select>
                        <Galat medan="posyanduId" />
                        {posyanduId === POSYANDU_BARU && (
                          <div className="mt-3">
                            <Label htmlFor="tp-pos-baru">Nama posyandu *</Label>
                            <input id="tp-pos-baru" name="namaPosyanduBaru" required className={kelas} />
                            <Galat medan="namaPosyanduBaru" />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div>
                  <Label htmlFor="tp-sandi">Kata sandi sementara *</Label>
                  <div className="mt-1 flex gap-2">
                    <input id="tp-sandi" name="sandiSementara" required minLength={8} value={sandi}
                      onChange={(e) => setSandi(e.target.value)} autoComplete="off"
                      className={`${kelas} mt-0 font-mono`} />
                    <button type="button" onClick={() => setSandi(buatSandiSementara())}
                      aria-label="Buat sandi acak baru"
                      className="flex h-11 shrink-0 items-center gap-1 rounded-xl border border-kabut-200 px-3 text-xs font-bold text-tinta-700 hover:bg-kabut-100">
                      <RefreshCw className="size-4" /> Acak
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-tinta-500">
                    Pengguna wajib mengganti sandi ini saat masuk pertama kali.
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
