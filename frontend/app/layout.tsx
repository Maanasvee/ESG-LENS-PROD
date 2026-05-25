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
  title: 'ESG Lens — Regulatory Intelligence Platform by Bevolve.ai',
  description: 'AI-powered ESG regulatory intelligence. Monitor global sustainability policies, track compliance obligations, and receive verified regulatory alerts — built for CSOs and sustainability leaders.',
  keywords: ['ESG', 'sustainability', 'regulatory intelligence', 'compliance', 'SEBI', 'India', 'policy monitoring', 'governance'],
  openGraph: {
    title: 'ESG Lens by Bevolve.ai',
    description: 'Enterprise ESG Policy Intelligence Platform',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta name="theme-color" content="#FFFFFF" />
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
