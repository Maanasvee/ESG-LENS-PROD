// ESG Lens — Policy Card Component
import { Policy } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import { ExternalLink, Calendar } from 'lucide-react'

const PILLAR_LABELS = { E: 'Environmental', S: 'Social', G: 'Governance' }
const JURISDICTION_FLAGS: Record<string, string> = {
  India: '🇮🇳', EU: '🇪🇺', US: '🇺🇸', UK: '🇬🇧', Global: '🌐',
  UN: '🇺🇳', APAC: '🌏', China: '🇨🇳', Japan: '🇯🇵',
}

interface PolicyCardProps {
  policy: Policy
  onClick?: () => void
}

export default function PolicyCard({ policy, onClick }: PolicyCardProps) {
  const flag = JURISDICTION_FLAGS[policy.jurisdiction || ''] || '🌐'
  const timeAgo = formatDistanceToNow(new Date(policy.created_at), { addSuffix: true })

  return (
    <article className="policy-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
      aria-label={`Policy: ${policy.title}`}>

      {/* Header */}
      <div className="policy-card-header">
        <div className="policy-card-meta">
          {policy.pillar && (
            <span className={`badge badge-pillar-${policy.pillar}`} title={PILLAR_LABELS[policy.pillar]}>
              {policy.pillar}
            </span>
          )}
          {policy.urgency && (
            <span className={`badge badge-urgency-${policy.urgency}`}>
              {policy.urgency === 'Critical' ? '🚨 ' : ''}{policy.urgency}
            </span>
          )}
          {policy.status && (
            <span className={`badge badge-status badge-status-${policy.status}`}>
              {policy.status}
            </span>
          )}
        </div>

        {/* Source link removed for non-admin users */}
      </div>

      {/* Title */}
      <h3 className="policy-card-title">{policy.title}</h3>

      {/* Summary */}
      {policy.summary && (
        <p className="policy-card-summary">{policy.summary}</p>
      )}

      {/* Sectors */}
      {policy.sectors.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {policy.sectors.slice(0, 4).map(s => (
            <span key={s} style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-full)',
              background: 'var(--color-surface-2)', color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
            }}>{s}</span>
          ))}
          {policy.sectors.length > 4 && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>+{policy.sectors.length - 4}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="policy-card-footer">
        <div className="policy-source-badge">
          <span className="jurisdiction-flag">{flag}</span>
          <span>{policy.source_name || new URL(policy.source_url).hostname}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: 11 }}>
          <Calendar size={11} />
          <span>{timeAgo}</span>
        </div>
      </div>
    </article>
  )
}
