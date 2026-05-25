import AuthGate from '@/components/auth/AuthGate'
import AppShell from '@/components/layout/AppShell'

export const metadata = {
  title: 'Policy Intelligence Feed | ESG Lens by Bevolve.ai',
  description: 'AI-verified ESG regulatory intelligence feed. Monitor global sustainability policies across 30+ sources.',
}

export default function TrackerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  )
}
