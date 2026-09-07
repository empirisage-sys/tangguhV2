import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PRODUK_PKMK_LIST, petakanProdukDbKeModel, type ProdukPKMK } from '@/lib/db/pkmk'

export const dynamic = 'force-dynamic'

/**
 * GET /api/pkmk
 * Mengembalikan daftar produk susu PKMK yang berstatus aktif.
 * Digunakan oleh modul dietisien untuk peresepan formula medis.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('produk_pkmk')
      .select('*')
      .eq('is_active', true)
      .order('nama', { ascending: true })

    if (!error && data && data.length > 0) {
      const produk: ProdukPKMK[] = data.map((row: any) => petakanProdukDbKeModel(row))
      return NextResponse.json({ ok: true, data: produk })
    }

    // Fallback ke master data statis jika belum ada data di database
    return NextResponse.json({
      ok: true,
      data: PRODUK_PKMK_LIST.filter((p) => p.isActive !== false),
    })
  } catch (err: any) {
    console.warn('Fallback /api/pkmk error:', err)
    return NextResponse.json({
      ok: true,
      data: PRODUK_PKMK_LIST.filter((p) => p.isActive !== false),
    })
  }
}
