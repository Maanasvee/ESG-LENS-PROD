// ESG Lens — Typed API Client
// All requests include Firebase ID token as Bearer auth header.

import { auth, isMockAuth } from './firebase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function mockBearerToken(): string | null {
  if (typeof window === 'undefined') return null

  const saved = localStorage.getItem('esg_session')
  if (saved) {
    try {
      const u = JSON.parse(saved) as { uid?: string }
      if (u.uid) return u.uid
    } catch {
      // fall through to cookie fallback below
    }
  }

  return getCookieValue('auth-token')
}

async function getAuthHeaders(authToken?: string): Promise<HeadersInit> {
  const base: HeadersInit = { 'Content-Type': 'application/json' }

  if (authToken) {
    return { ...base, Authorization: `Bearer ${authToken}` }
  }

  if (isMockAuth) {
    const token = mockBearerToken()
    return token ? { ...base, Authorization: `Bearer ${token}` } : base
  }

  if (!auth?.currentUser) return base

  const token = await auth.currentUser.getIdToken()
  return { ...base, Authorization: `Bearer ${token}` }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  authToken?: string
): Promise<T> {
  const headers = await getAuthHeaders(authToken)
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `API error: ${res.status}`)
  }

  return res.json()
}

// ── Types ─────────────────────────────────────────────────────

export interface Policy {
  id: number
  title: string
  source_name: string | null
  source_url: string
  jurisdiction: string | null
  pillar: 'E' | 'S' | 'G' | null
  applicability?: string | null
  sectors: string[]
  status: 'Proposed' | 'Consultation' | 'Enacted' | 'Amended' | null
  display_status?: string
  urgency: 'Low' | 'Medium' | 'High' | 'Critical' | null
  obligation?: string
  provision_subtype?: string
  summary: string | null
  published_date: string | null
  latest_update?: string
  created_at: string
  ai_verified?: boolean
}

export interface PaginatedPolicies {
  items: Policy[]
  total: number
  page: number
  page_size: number
  has_next: boolean
}

export interface PolicyFilters {
  q?: string
  title_only?: boolean
  pillar?: string
  jurisdiction?: string
  sector?: string
  source_id?: number | string
  urgency?: string
  status?: string
  obligation?: string
  sort?: 'latest' | 'alphabetical' | 'relevance' | 'urgency' | 'recent'
  page?: number
  page_size?: number
}

export interface TrackerMeta {
  product_name: string
  tagline: string
  sectors: string[]
  jurisdictions: string[]
  applicability: { value: string; label: string }[]
  obligations: string[]
  regulatory_statuses: string[]
  provision_subtypes: string[]
  sources: Source[]
  active_source_count: number
}

export interface User {
  id: number
  firebase_uid: string
  email: string
  name: string | null
  role: 'user' | 'admin'
  sector_prefs: string[]
  jurisdiction_prefs: string[]
  email_digest_opt_in: boolean
}

export interface Source {
  id: number
  name: string
  url: string
  source_type: string | null
  fetch_strategy: 'rss' | 'playwright'
  frequency_minutes: number
  is_active: boolean
  last_checked_at: string | null
  selector: string | null
  jurisdiction: string | null
  pillar_hint: string | null
}

export interface AdminPolicyRow extends Policy {
  review_status: 'pending_review' | 'verified' | 'rejected'
  raw_text_excerpt: string | null
}

export interface PipelineRun {
  id: number
  triggered_at: string
  items_fetched: number
  items_after_dedup: number
  llm_calls_made: number
  errors: string[]
  completed_at: string | null
  duration_seconds: number | null
}

export interface SearchResult {
  policy_id: number
  title: string
  summary: string | null
  jurisdiction: string | null
  pillar: string | null
  urgency: string | null
  similarity: number
  source_url: string
}

// ── API Methods ───────────────────────────────────────────────

export const api = {
  // Users
  async getMe(authToken?: string): Promise<User> {
    return apiFetch('/api/users/me', {}, authToken)
  },

  async updatePrefs(prefs: Partial<Pick<User, 'sector_prefs' | 'jurisdiction_prefs' | 'email_digest_opt_in'>>): Promise<User> {
    return apiFetch('/api/users/prefs', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    })
  },

  async getTaxonomy(): Promise<{ sectors: string[]; jurisdictions: string[] }> {
    return apiFetch('/api/users/taxonomy')
  },

  // Policies
  async getPolicies(filters: PolicyFilters = {}): Promise<PaginatedPolicies> {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return
      if (k === 'title_only') {
        if (v) params.append('title_only', 'true')
        return
      }
      params.append(k, String(v))
    })
    return apiFetch(`/api/policies?${params}`)
  },

  async getTrackerMeta(): Promise<TrackerMeta> {
    return apiFetch('/api/policies/tracker-meta')
  },

  async getPolicy(id: number): Promise<Policy> {
    return apiFetch(`/api/policies/${id}`)
  },

  // Search
  async search(query: string, nResults = 10): Promise<SearchResult[]> {
    return apiFetch('/api/search', {
      method: 'POST',
      body: JSON.stringify({ query, n_results: nResults }),
    })
  },

  // Admin — Moderation
  async getModerationQueue(page = 1, pageSize = 25): Promise<AdminPolicyRow[]> {
    return apiFetch(`/api/admin/queue?page=${page}&page_size=${pageSize}`)
  },

  async moderatePolicy(id: number, payload: {
    action: 'approve' | 'reject' | 'edit_approve'
    rejection_note?: string
    title?: string
    pillar?: string
    sectors?: string[]
    status?: string
    urgency?: string
    summary?: string
    jurisdiction?: string
  }): Promise<{ status: string; policy_id: number }> {
    return apiFetch(`/api/admin/moderate/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  // Admin — Sources
  async getSources(): Promise<Source[]> {
    return apiFetch('/api/admin/sources')
  },

  async createSource(data: Omit<Source, 'id' | 'last_checked_at'>): Promise<Source> {
    return apiFetch('/api/admin/sources', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateSource(id: number, data: Partial<Source>): Promise<Source> {
    return apiFetch(`/api/admin/sources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async deleteSource(id: number): Promise<void> {
    return apiFetch(`/api/admin/sources/${id}`, { method: 'DELETE' })
  },

  // Admin — Logs
  async getPipelineLogs(): Promise<PipelineRun[]> {
    return apiFetch('/api/admin/logs')
  },
}
