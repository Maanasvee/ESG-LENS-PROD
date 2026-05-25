// ESG Lens — Sidebar Navigation Layout Component
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import NotificationBell from '@/components/notifications/NotificationBell'
import {
  FileText, Search, Settings, LayoutDashboard,
  Shield, Radio, ClipboardList, LogOut, Activity
} from 'lucide-react'

interface NavItemProps {
  href: string
  label: string
  icon: React.ReactNode
  id: string
}

function NavItem({ href, label, icon, id }: NavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
  return (
    <Link href={href} id={id} className={`nav-item ${isActive ? 'active' : ''}`}>
      {icon}
      <span>{label}</span>
    </Link>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { dbUser, logout, isAdmin } = useAuth()

  return (
    <div className="layout-root">
      {/* Sidebar */}
      <aside className="layout-sidebar">
        {/* Logo */}
        <div className="nav-logo">
          <div className="nav-logo-text">🌿 ESG Lens</div>
          <div className="nav-logo-sub">by Bevolve.ai</div>
        </div>

        {/* Nav */}
        <nav className="nav-section">
          <div className="nav-section-label">Intelligence</div>
          <NavItem href="/" label="Policy Feed" icon={<FileText size={16} />} id="nav-feed" />
          <NavItem href="/search" label="Semantic Search" icon={<Search size={16} />} id="nav-search" />

          <div className="nav-section-label" style={{ marginTop: 16 }}>Account</div>
          <NavItem href="/settings" label="Preferences" icon={<Settings size={16} />} id="nav-settings" />

          {isAdmin && (
            <>
              <div className="nav-section-label" style={{ marginTop: 16, color: 'rgba(168, 85, 247, 0.8)' }}>Admin</div>
              <NavItem href="/admin" label="Mod Queue" icon={<Shield size={16} />} id="nav-admin-queue" />
              <NavItem href="/admin/sources" label="Sources" icon={<Radio size={16} />} id="nav-admin-sources" />
              <NavItem href="/admin/logs" label="Pipeline Logs" icon={<Activity size={16} />} id="nav-admin-logs" />
            </>
          )}
        </nav>

        {/* User footer */}
        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              width: 32, height: 32, background: 'var(--color-accent-glow)',
              border: '1px solid rgba(34,197,94,0.3)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'var(--color-accent)', flexShrink: 0,
            }}>
              {dbUser?.name?.[0]?.toUpperCase() || dbUser?.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {dbUser?.name || 'User'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {dbUser?.role === 'admin' ? '🛡️ Admin' : '👤 User'}
              </div>
            </div>
            <button id="logout-btn" onClick={logout} className="btn btn-ghost btn-sm" title="Sign out">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="layout-main">
        {/* Topbar */}
        <header className="layout-topbar">
          <div style={{ flex: 1 }} />
          <NotificationBell />
        </header>

        {/* Content */}
        <main className="layout-content">
          {children}
        </main>
      </div>
    </div>
  )
}
