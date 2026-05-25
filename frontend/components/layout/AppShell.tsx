'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  FileText, Search, Settings, Shield, Radio, Activity, LogOut
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import NotificationBell from '@/components/notifications/NotificationBell'

function NavLink({ href, label, icon, id }: {
  href: string; label: string; icon: React.ReactNode; id: string
}) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/tracker' && pathname.startsWith(href))
  return (
    <Link href={href} id={id} className={`nav-item ${active ? 'active' : ''}`}>
      {icon}
      <span>{label}</span>
    </Link>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { dbUser, isAdmin, logout } = useAuth()
  const router = useRouter()

  const roleName = dbUser?.role === 'admin' ? 'Editorial Manager' : 'Policy Analyst'
  const userInitial = (dbUser?.name || dbUser?.email || 'U')[0].toUpperCase()

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <div className="layout-root">
      {/* Sidebar */}
      <aside className="layout-sidebar">
        <div className="nav-logo">
          <div className="nav-logo-mark">
            <div className="nav-logo-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="nav-logo-text">ESG Lens</span>
          </div>
          <div className="nav-logo-sub">Regulatory Intelligence Platform</div>
        </div>

        <nav className="nav-section">
          <span className="nav-section-label">Intelligence</span>
          <NavLink href="/tracker" label="Policy Intelligence Feed" icon={<FileText size={15} />} id="nav-tracker" />
          <NavLink href="/search" label="Regulatory Search" icon={<Search size={15} />} id="nav-search" />

          <span className="nav-section-label">Account</span>
          <NavLink href="/settings" label="Alert Preferences" icon={<Settings size={15} />} id="nav-settings" />

          {isAdmin && (
            <>
              <span className="nav-section-label" style={{ color: 'var(--color-pillar-g)', opacity: 0.9 }}>
                Editorial
              </span>
              <NavLink href="/admin" label="Review Queue" icon={<Shield size={15} />} id="nav-admin" />
              <NavLink href="/admin/sources" label="Source Management" icon={<Radio size={15} />} id="nav-sources" />
              <NavLink href="/admin/logs" label="Pipeline Logs" icon={<Activity size={15} />} id="nav-logs" />
            </>
          )}
        </nav>

        <div className="nav-user-footer">
          <div className="nav-user-avatar">{userInitial}</div>
          <div className="nav-user-info">
            <div className="nav-user-name">
              {dbUser?.name || dbUser?.email?.split('@')[0] || 'User'}
            </div>
            <div className="nav-user-role">{roleName}</div>
          </div>
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="btn btn-ghost btn-sm"
            title="Sign out"
            style={{ width: 30, height: 30, padding: 0, flexShrink: 0 }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="layout-main">
        <header className="layout-topbar">
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {isAdmin && (
              <span style={{
                fontSize: '11px', fontWeight: 600, color: 'var(--color-pillar-g)',
                padding: '3px 8px', background: 'var(--color-pillar-g-bg)',
                borderRadius: 'var(--radius-sm)', border: '1px solid rgba(124,58,237,0.2)'
              }}>
                Editorial Manager
              </span>
            )}
            <NotificationBell />
          </div>
        </header>
        <main className="layout-content">{children}</main>
      </div>
    </div>
  )
}
