/**
 * Skema validasi formulir asuhan gizi PKMK.
 *
 * ATURAN PENTING (AGENTS.md 1.7)
 * -----------------------------
 * Skema ini HANYA menerima MASUKAN dietisien: balita mana, produk apa, mode
 * mana, berapa persen target, berapa kali sehari, berapa sendok per saji.
 *
 * Skema ini SENGAJA TIDAK menerima energi yang diberikan, selisih, persen
 * terhadap target, maupun volume larutan. Seluruh angka itu dihitung ulang di
 * server dari masukan mentah memakai `hitungTakaran()`. Bila angka hasil boleh
 * dikirim klien lalu disimpan apa adanya, tepat cacat lama yang sedang
 * diperbaiki dapat kembali lewat jalur lain: layar menampilkan satu angka,
 * database menyimpan angka yang berbeda.
 */
import { z } from 'zod'
import { BATAS } from '@/lib/pkmk/hitung'

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const skemaAsuhanGizi = z.object({
  balitaId: z
    .string()
    .min(1, 'Balita belum dipilih.')
    .refine((v) => UUID.test(v), 'Identitas balita tidak sah.'),

  skriningId: z
    .string()
    .refine((v) => UUID.test(v), 'Identitas skrining tidak sah.')
    .optional(),

  tataLaksana: z
    .string()
    .min(3, 'Tata laksana klinis belum dipilih.')
    .max(200, 'Tata laksana terlalu panjang.'),

  produkId: z.string().min(1, 'Produk PKMK belum dipilih.'),

  mode: z.enum(['dari_takaran', 'dari_target'], {
    errorMap: () => ({ message: 'Cara menyusun takaran belum dipilih.' }),
  }),

  targetPersen: z
    .number()
    .int('Persentase target harus bilangan bulat.')
    .min(0, 'Persentase target tidak boleh kurang dari 0.')
    .max(100, 'Persentase target tidak boleh lebih dari 100.'),

  frekuensiPerHari: z
    .number()
    .int('Frekuensi harus bilangan bulat.')
    .min(BATAS.frekuensiMin, `Frekuensi minimal ${BATAS.frekuensiMin}x sehari.`)
    .max(BATAS.frekuensiMaks, `Frekuensi maksimal ${BATAS.frekuensiMaks}x sehari.`),

  /** Hanya dipakai pada mode `dari_takaran`. Pada mode `dari_target` dihitung server. */
  sendokPerSaji: z
    .number()
    .int('Jumlah sendok harus bilangan bulat.')
    .min(BATAS.sendokPerSajiMin, `Minimal ${BATAS.sendokPerSajiMin} sendok per saji.`)
    .max(BATAS.sendokPerSajiMaks, `Maksimal ${BATAS.sendokPerSajiMaks} sendok per saji.`)
    .optional(),

  tanggalEvaluasi: z.string().optional(),
  catatan: z.string().max(1000, 'Catatan terlalu panjang.').optional(),
})

export type MasukanAsuhanGizi = z.infer<typeof skemaAsuhanGizi>

/** Membaca FormData menjadi objek mentah untuk `skemaAsuhanGizi.safeParse`. */
export function bacaFormAsuhanGizi(formData: FormData): Record<string, unknown> {
  const angka = (kunci: string): number | undefined => {
    const nilai = formData.get(kunci)
    if (nilai === null || nilai === '') return undefined
    const n = Number(nilai)
    return Number.isFinite(n) ? n : Number.NaN
  }

  return {
    balitaId: formData.get('balitaId') ?? '',
    skriningId: formData.get('skriningId') || undefined,
    tataLaksana: formData.get('tataLaksana') ?? '',
    produkId: formData.get('produkId') ?? '',
    mode: formData.get('mode') ?? '',
    targetPersen: angka('targetPersen'),
    frekuensiPerHari: angka('frekuensiPerHari'),
    sendokPerSaji: angka('sendokPerSaji'),
    tanggalEvaluasi: formData.get('tanggalEvaluasi') || undefined,
    catatan: formData.get('catatan') || undefined,
  }
}
