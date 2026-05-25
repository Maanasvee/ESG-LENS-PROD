// ESG Lens — User Settings / Preferences Page
'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'
import { Bell, Mail, Check, Globe, Layers } from 'lucide-react'

export default function SettingsPage() {
  const { dbUser, refreshDbUser } = useAuth()
  const [taxonomy, setTaxonomy] = useState<{ sectors: string[]; jurisdictions: string[] }>({ sectors: [], jurisdictions: [] })
  const [sectors, setSectors] = useState<string[]>([])
  const [jurisdictions, setJurisdictions] = useState<string[]>([])
  const [emailOptIn, setEmailOptIn] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getTaxonomy().then(setTaxonomy)
  }, [])

  useEffect(() => {
    if (dbUser) {
      setSectors(dbUser.sector_prefs || [])
      setJurisdictions(dbUser.jurisdiction_prefs || [])
      setEmailOptIn(dbUser.email_digest_opt_in)
    }
  }, [dbUser])

  function toggleItem(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item])
  }

  async function handleSave() {
    setSaving(true); setSaved(false)
    try {
      await api.updatePrefs({ sector_prefs: sectors, jurisdiction_prefs: jurisdictions, email_digest_opt_in: emailOptIn })
      await refreshDbUser()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 640 }}>
        <div className="page-header">
          <h1 className="page-title">Notification Preferences</h1>
          <p className="page-subtitle">Personalise your ESG intelligence feed and digest emails</p>
        </div>

        {/* Sectors */}
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
            <div style={{ width: 36, height: 36, background: 'var(--color-accent-glow)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={18} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>Sectors</h2>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Receive alerts for policies affecting these industries</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {taxonomy.sectors.map(s => (
              <button key={s} id={`sector-toggle-${s}`}
                onClick={() => toggleItem(sectors, setSectors, s)}
                className={`filter-chip ${sectors.includes(s) ? 'active' : ''}`}
                style={{ gap: 6 }}>
                {sectors.includes(s) && <Check size={12} />} {s}
              </button>
            ))}
          </div>
          {sectors.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 12 }}>
              No sectors selected — you'll receive alerts for all sectors.
            </p>
          )}
        </div>

        {/* Jurisdictions */}
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
            <div style={{ width: 36, height: 36, background: 'var(--color-blue-glow)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={18} style={{ color: 'var(--color-blue)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>Jurisdictions</h2>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Receive alerts for policies from these regions</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {taxonomy.jurisdictions.map(j => (
              <button key={j} id={`jurisdiction-toggle-${j}`}
                onClick={() => toggleItem(jurisdictions, setJurisdictions, j)}
                className={`filter-chip ${jurisdictions.includes(j) ? 'active' : ''}`}
                style={{ gap: 6 }}>
                {jurisdictions.includes(j) && <Check size={12} />} {j}
              </button>
            ))}
          </div>
        </div>

        {/* Email digest */}
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{ width: 36, height: 36, background: 'rgba(245,158,11,0.1)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={18} style={{ color: 'var(--color-medium)' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>Daily Email Digest</h2>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Personalised brief delivered at 8:00 AM IST</p>
              </div>
            </div>
            <label id="email-digest-toggle" style={{ position: 'relative', width: 48, height: 26, cursor: 'pointer' }}>
              <input type="checkbox" checked={emailOptIn} onChange={e => setEmailOptIn(e.target.checked)}
                style={{ display: 'none' }} />
              <div style={{
                position: 'absolute', inset: 0, background: emailOptIn ? 'var(--color-accent)' : 'var(--color-surface-3)',
                borderRadius: 13, transition: 'background 200ms',
                border: `1px solid ${emailOptIn ? 'rgba(34,197,94,0.5)' : 'var(--color-border)'}`,
              }} />
              <div style={{
                position: 'absolute', top: 3, left: emailOptIn ? 25 : 3, width: 18, height: 18,
                background: 'white', borderRadius: '50%', transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </label>
          </div>
        </div>

        {/* Save */}
        <button id="save-preferences-btn" className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          {saving ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Saving…</>
           : saved ? <><Check size={16} /> Preferences Saved!</>
           : 'Save Preferences'}
        </button>
      </div>
    </DashboardLayout>
  )
}
