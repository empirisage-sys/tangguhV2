/**
 * Perender SVG untuk kurva pertumbuhan.
 *
 * Menghasilkan SVG sebagai teks, tanpa React dan tanpa peramban. Ada tiga
 * pemakaian yang membuat berkas ini bernilai:
 *
 * 1. Laporan PDF. Kurva pertumbuhan adalah bagian terpenting dari laporan yang
 *    diserahkan ke orang tua dan puskesmas, dan `jspdf` tidak dapat memotret
 *    komponen Recharts. Dengan perender ini, kurva yang sama dapat disisipkan
 *    ke PDF.
 * 2. Halaman pratinjau dan dokumentasi, tanpa perlu menjalankan aplikasi.
 * 3. Cadangan bila Recharts gagal dimuat, misalnya pada perangkat kader yang
 *    sangat lambat.
 *
 * Karena murni teks, hasilnya dapat diuji.
 */
import type { SeriKurva, SeriTrenZ } from './seri'

export type OpsiRender = {
  lebar?: number
  tinggi?: number
  /** Warna diambil dari token sistem desain, ditulis sebagai nilai agar SVG mandiri. */
  warna?: Partial<typeof WARNA_BAWAAN>
  /** Menyembunyikan judul, dipakai bila judul sudah ditulis di luar SVG. */
  tanpaJudul?: boolean
}

const WARNA_BAWAAN = {
  latar: '#FFFFFF',
  kisi: '#EDF3F5',
  garisSumbu: '#DCE9EB',
  teks: '#0F2B31',
  teksBantu: '#7A959B',
  median: '#0B7681',
  sd2: '#4A6B72',
  sd3: '#97161D',
  zonaBahaya: '#FEECEC',
  zonaWaspada: '#FFF6E0',
  anak: '#12B5C0',
  anakTitik: '#0E96A1',
  anakTidakDinilai: '#A8BFC4',
}

const MARGIN = { atas: 34, kanan: 44, bawah: 42, kiri: 50 }

function esc(teks: string): string {
  return teks
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function bulat(n: number): number {
  return Math.round(n * 10) / 10
}

/** Memilih jarak antar tanda sumbu yang menghasilkan sekitar lima sampai delapan tanda. */
export function langkahSumbu(rentang: number): number {
  const kandidat = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50]
  for (const k of kandidat) {
    if (rentang / k <= 8) return k
  }
  return 100
}

function tandaSumbu(dari: number, sampai: number): number[] {
  const langkah = langkahSumbu(sampai - dari)
  const mulai = Math.ceil(dari / langkah) * langkah
  const hasil: number[] = []
  for (let v = mulai; v <= sampai + 1e-9; v += langkah) {
    hasil.push(Math.round(v * 100) / 100)
  }
  return hasil
}

export function renderKurvaSvg(seri: SeriKurva, opsi: OpsiRender = {}): string {
  const L = opsi.lebar ?? 640
  const T = opsi.tinggi ?? 360
  const W = { ...WARNA_BAWAAN, ...opsi.warna }

  const bidangL = L - MARGIN.kiri - MARGIN.kanan
  const bidangT = T - MARGIN.atas - MARGIN.bawah

  const [x0, x1] = seri.domainX
  const [y0, y1] = seri.domainY

  const px = (x: number) => MARGIN.kiri + ((x - x0) / (x1 - x0)) * bidangL
  const py = (y: number) => MARGIN.atas + bidangT - ((y - y0) / (y1 - y0)) * bidangT

  const bagian: string[] = []

  bagian.push(
    `<rect x="0" y="0" width="${L}" height="${T}" fill="${W.latar}" rx="12"/>`,
  )

  if (!opsi.tanpaJudul) {
    bagian.push(
      `<text x="${MARGIN.kiri}" y="20" font-size="13" font-weight="700" fill="${W.teks}" font-family="system-ui, sans-serif">${esc(seri.judul)}</text>`,
    )
  }

  // --- Zona waspada dan bahaya, mengikuti warna status pada sistem desain ---
  const jalur = (ambil: (t: (typeof seri.rujukan)[number]) => number) =>
    seri.rujukan.map((t) => `${bulat(px(t.x))},${bulat(py(ambil(t)))}`).join(' ')

  if (seri.rujukan.length > 1) {
    const bawahBidang = MARGIN.atas + bidangT
    bagian.push(
      `<polygon points="${bulat(px(x0))},${bulat(bawahBidang)} ${jalur((t) => t.sd_n3)} ${bulat(px(x1))},${bulat(bawahBidang)}" fill="${W.zonaBahaya}"/>`,
    )
    bagian.push(
      `<polygon points="${jalur((t) => t.sd_n3)} ${[...seri.rujukan].reverse().map((t) => `${bulat(px(t.x))},${bulat(py(t.sd_n2))}`).join(' ')}" fill="${W.zonaWaspada}"/>`,
    )
  }

  // --- Kisi dan sumbu ---
  for (const v of tandaSumbu(y0, y1)) {
    bagian.push(
      `<line x1="${MARGIN.kiri}" y1="${bulat(py(v))}" x2="${MARGIN.kiri + bidangL}" y2="${bulat(py(v))}" stroke="${W.kisi}" stroke-width="1"/>`,
      `<text x="${MARGIN.kiri - 7}" y="${bulat(py(v)) + 4}" font-size="10" text-anchor="end" fill="${W.teksBantu}" font-family="ui-monospace, monospace">${v}</text>`,
    )
  }
  for (const v of tandaSumbu(x0, x1)) {
    bagian.push(
      `<line x1="${bulat(px(v))}" y1="${MARGIN.atas}" x2="${bulat(px(v))}" y2="${MARGIN.atas + bidangT}" stroke="${W.kisi}" stroke-width="1"/>`,
      `<text x="${bulat(px(v))}" y="${MARGIN.atas + bidangT + 15}" font-size="10" text-anchor="middle" fill="${W.teksBantu}" font-family="ui-monospace, monospace">${v}</text>`,
    )
  }

  bagian.push(
    `<line x1="${MARGIN.kiri}" y1="${MARGIN.atas + bidangT}" x2="${MARGIN.kiri + bidangL}" y2="${MARGIN.atas + bidangT}" stroke="${W.garisSumbu}" stroke-width="1.5"/>`,
    `<line x1="${MARGIN.kiri}" y1="${MARGIN.atas}" x2="${MARGIN.kiri}" y2="${MARGIN.atas + bidangT}" stroke="${W.garisSumbu}" stroke-width="1.5"/>`,
  )

  // --- Garis rujukan SD, masing-masing diberi label di tepi kanan ---
  const garis: Array<{
    ambil: (t: (typeof seri.rujukan)[number]) => number
    warna: string
    tebal: number
    putus: string
    label: string
  }> = [
    { ambil: (t) => t.sd_n3, warna: W.sd3, tebal: 1.4, putus: '5 3', label: '-3' },
    { ambil: (t) => t.sd_n2, warna: W.sd2, tebal: 1.2, putus: '3 3', label: '-2' },
    { ambil: (t) => t.sd_0, warna: W.median, tebal: 1.8, putus: '', label: '0' },
    { ambil: (t) => t.sd_p2, warna: W.sd2, tebal: 1.2, putus: '3 3', label: '+2' },
    { ambil: (t) => t.sd_p3, warna: W.sd3, tebal: 1.4, putus: '5 3', label: '+3' },
  ]

  const akhir = seri.rujukan[seri.rujukan.length - 1]
  for (const g of garis) {
    bagian.push(
      `<polyline points="${jalur(g.ambil)}" fill="none" stroke="${g.warna}" stroke-width="${g.tebal}"${g.putus ? ` stroke-dasharray="${g.putus}"` : ''}/>`,
    )
    if (akhir) {
      bagian.push(
        `<text x="${MARGIN.kiri + bidangL + 5}" y="${bulat(py(g.ambil(akhir))) + 3.5}" font-size="10" font-weight="700" fill="${g.warna}" font-family="ui-monospace, monospace">${g.label}</text>`,
      )
    }
  }

  // --- Garis dan titik riwayat anak ---
  const dinilai = seri.anak.filter((t) => !t.tidakDinilai)
  if (dinilai.length > 1) {
    bagian.push(
      `<polyline points="${dinilai.map((t) => `${bulat(px(t.x))},${bulat(py(t.y))}`).join(' ')}" fill="none" stroke="${W.anak}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`,
    )
  }
  for (const t of seri.anak) {
    const cx = bulat(px(t.x))
    const cy = bulat(py(t.y))
    const isi = t.tidakDinilai ? W.latar : W.anakTitik
    const tepi = t.tidakDinilai ? W.anakTidakDinilai : W.latar
    bagian.push(
      `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${isi}" stroke="${tepi}" stroke-width="2"><title>${esc(t.tanggal)}${t.z === null ? '' : ` — Z ${t.z.toFixed(2)}`}</title></circle>`,
    )
  }

  // Titik terakhir diberi penanda tambahan, karena itu yang menjadi dasar keputusan hari ini.
  const terakhir = seri.anak[seri.anak.length - 1]
  if (terakhir) {
    bagian.push(
      `<circle cx="${bulat(px(terakhir.x))}" cy="${bulat(py(terakhir.y))}" r="8" fill="none" stroke="${W.anak}" stroke-width="1.5" opacity="0.55"/>`,
    )
  }

  // --- Label sumbu ---
  bagian.push(
    `<text x="${MARGIN.kiri + bidangL / 2}" y="${T - 6}" font-size="10.5" text-anchor="middle" fill="${W.teksBantu}" font-family="system-ui, sans-serif">${esc(seri.labelX)}</text>`,
    `<text x="12" y="${MARGIN.atas + bidangT / 2}" font-size="10.5" text-anchor="middle" fill="${W.teksBantu}" font-family="system-ui, sans-serif" transform="rotate(-90 12 ${MARGIN.atas + bidangT / 2})">${esc(seri.labelY)}</text>`,
  )

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L} ${T}" width="100%" role="img" aria-label="${esc(seri.judul)}">${bagian.join('')}</svg>`
}

export function renderTrenZSvg(seri: SeriTrenZ, opsi: OpsiRender = {}): string {
  const L = opsi.lebar ?? 640
  const T = opsi.tinggi ?? 300
  const W = { ...WARNA_BAWAAN, ...opsi.warna }

  const bidangL = L - MARGIN.kiri - MARGIN.kanan
  const bidangT = T - MARGIN.atas - MARGIN.bawah
  const [x0, x1] = seri.domainX
  const [y0, y1] = seri.domainY

  const px = (x: number) => MARGIN.kiri + ((x - x0) / (x1 - x0)) * bidangL
  const py = (y: number) => MARGIN.atas + bidangT - ((y - y0) / (y1 - y0)) * bidangT

  const bagian: string[] = [
    `<rect x="0" y="0" width="${L}" height="${T}" fill="${W.latar}" rx="12"/>`,
  ]

  if (!opsi.tanpaJudul) {
    bagian.push(
      `<text x="${MARGIN.kiri}" y="20" font-size="13" font-weight="700" fill="${W.teks}" font-family="system-ui, sans-serif">${esc(seri.judul)}</text>`,
    )
  }

  // Zona di bawah -2 dan -3, agar batas kewaspadaan terlihat tanpa membaca angka.
  bagian.push(
    `<rect x="${MARGIN.kiri}" y="${bulat(py(-2))}" width="${bidangL}" height="${bulat(py(y0) - py(-2))}" fill="${W.zonaWaspada}"/>`,
    `<rect x="${MARGIN.kiri}" y="${bulat(py(-3))}" width="${bidangL}" height="${bulat(py(y0) - py(-3))}" fill="${W.zonaBahaya}"/>`,
  )

  for (const v of tandaSumbu(y0, y1)) {
    bagian.push(
      `<line x1="${MARGIN.kiri}" y1="${bulat(py(v))}" x2="${MARGIN.kiri + bidangL}" y2="${bulat(py(v))}" stroke="${W.kisi}" stroke-width="1"/>`,
      `<text x="${MARGIN.kiri - 7}" y="${bulat(py(v)) + 4}" font-size="10" text-anchor="end" fill="${W.teksBantu}" font-family="ui-monospace, monospace">${v > 0 ? `+${v}` : v}</text>`,
    )
  }
  for (const v of tandaSumbu(x0, x1)) {
    bagian.push(
      `<text x="${bulat(px(v))}" y="${MARGIN.atas + bidangT + 15}" font-size="10" text-anchor="middle" fill="${W.teksBantu}" font-family="ui-monospace, monospace">${v}</text>`,
    )
  }

  // Garis nol dan garis batas -2, ditebalkan.
  for (const [nilai, warna, tebal] of [
    [0, W.median, 1.6],
    [-2, W.sd2, 1.3],
    [-3, W.sd3, 1.3],
  ] as Array<[number, string, number]>) {
    if (nilai >= y0 && nilai <= y1) {
      bagian.push(
        `<line x1="${MARGIN.kiri}" y1="${bulat(py(nilai))}" x2="${MARGIN.kiri + bidangL}" y2="${bulat(py(nilai))}" stroke="${warna}" stroke-width="${tebal}" stroke-dasharray="${nilai === 0 ? '' : '4 3'}"/>`,
      )
    }
  }

  const seriIndikator: Array<{ kunci: 'bbu' | 'tbu' | 'bbtb'; warna: string; label: string }> = [
    { kunci: 'bbu', warna: '#0E96A1', label: 'BB/U' },
    { kunci: 'tbu', warna: '#8A5300', label: 'TB/U' },
    { kunci: 'bbtb', warna: '#97161D', label: 'BB/TB' },
  ]

  for (const s of seriIndikator) {
    const titik = seri.titik
      .map((t) => ({ x: t.umurBulan, y: t[s.kunci] }))
      .filter((t): t is { x: number; y: number } => t.y !== null)

    if (titik.length > 1) {
      bagian.push(
        `<polyline points="${titik.map((t) => `${bulat(px(t.x))},${bulat(py(t.y))}`).join(' ')}" fill="none" stroke="${s.warna}" stroke-width="2.2" stroke-linejoin="round"/>`,
      )
    }
    for (const t of titik) {
      bagian.push(
        `<circle cx="${bulat(px(t.x))}" cy="${bulat(py(t.y))}" r="3.6" fill="${s.warna}"/>`,
      )
    }
  }

  // Keterangan warna
  let kiriLegenda = MARGIN.kiri
  for (const s of seriIndikator) {
    bagian.push(
      `<rect x="${kiriLegenda}" y="${T - 20}" width="14" height="3" rx="1.5" fill="${s.warna}"/>`,
      `<text x="${kiriLegenda + 18}" y="${T - 15}" font-size="10" fill="${W.teksBantu}" font-family="ui-monospace, monospace">${s.label}</text>`,
    )
    kiriLegenda += 66
  }

  bagian.push(
    `<text x="${MARGIN.kiri + bidangL}" y="${T - 15}" font-size="10" text-anchor="end" fill="${W.teksBantu}" font-family="system-ui, sans-serif">Umur (bulan)</text>`,
  )

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L} ${T}" width="100%" role="img" aria-label="${esc(seri.judul)}">${bagian.join('')}</svg>`
}
