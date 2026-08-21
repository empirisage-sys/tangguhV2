/**
 * Kolom masukan angka pengukuran.
 *
 * Memakai `inputMode="decimal"` agar papan ketik angka langsung muncul, dan
 * `type="text"` alih-alih `type="number"`. Tombol naik-turun bawaan
 * `type="number"` terlalu kecil untuk ditekan sambil menggendong anak, dan
 * mudah tergeser tanpa sengaja saat menggulir.
 *
 * Menerima koma sebagai pemisah desimal, karena itu yang diketik kader.
 */
type Props = {
  id: string
  label: string
  satuan: string
  nilai: string
  onUbah: (nilai: string) => void
  galat?: string
  bantuan?: string
  wajib?: boolean
}

export function InputAngka({
  id, label, satuan, nilai, onUbah, galat, bantuan, wajib = true,
}: Props) {
  const idBantuan = `${id}-bantuan`
  const idGalat = `${id}-galat`

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-base font-semibold text-tinta-900">
        {label}
        {wajib && <span className="ml-1 text-bahaya-teks" aria-label="wajib diisi">*</span>}
      </label>

      <div
        className={[
          'flex items-center rounded-xl bg-white ring-1 transition-colors',
          galat ? 'ring-2 ring-bahaya-garis' : 'ring-kabut-200 focus-within:ring-2 focus-within:ring-laut-500',
        ].join(' ')}
      >
        <input
          id={id}
          value={nilai}
          onChange={(e) => onUbah(e.target.value)}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="next"
          aria-invalid={galat ? true : undefined}
          aria-describedby={galat ? idGalat : bantuan ? idBantuan : undefined}
          className="angka h-14 w-full rounded-xl bg-transparent px-4 text-2xl font-bold text-tinta-900 outline-none"
        />
        <span className="shrink-0 pr-4 text-lg font-medium text-tinta-400">{satuan}</span>
      </div>

      {galat ? (
        <p id={idGalat} role="alert" className="text-sm font-medium text-bahaya-teks">{galat}</p>
      ) : bantuan ? (
        <p id={idBantuan} className="text-sm text-tinta-400">{bantuan}</p>
      ) : null}
    </div>
  )
}
