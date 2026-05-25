import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/hooks/useAuth'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ESG Lens — Policy Intelligence by Bevolve.ai',
  description: 'Real-time ESG regulatory intelligence for sustainability leaders. Monitor 30+ global and India-specific policy sources, verified by editorial experts.',
  keywords: ['ESG', 'sustainability', 'regulation', 'policy', 'SEBI', 'India', 'environmental', 'governance'],
  openGraph: {
    title: 'ESG Lens by Bevolve.ai',
    description: 'Agentic ESG Policy Intelligence Platform',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta name="theme-color" content="#0A0F0D" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
