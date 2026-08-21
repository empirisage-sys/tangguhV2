import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aplikasi TANGGUH — Deteksi Dini Stunting Gorontalo',
  description:
    'Platform digital deteksi dini stunting dan gizi buruk pada balita di 6 kabupaten/kota Provinsi Gorontalo dengan standar WHO dan Kemenkes RI.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  themeColor: '#0E96A1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-kabut-50 text-tinta-900 antialiased selection:bg-laut-100 selection:text-laut-900">
        {children}
      </body>
    </html>
  )
}
