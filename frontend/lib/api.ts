// ESG Lens — Typed API Client
// All requests include Firebase ID token as Bearer auth header.

import { auth } from './firebase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser
  if (!user) return { 'Content-Type': 'application/json' }
  const token = await user.getIdToken()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders()
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
  sectors: string[]
  status: 'Proposed' | 'Consultation' | 'Enacted' | 'Amended' | null
  urgency: 'Low' | 'Medium' | 'High' | 'Critical' | null
  summary: string | null
  published_date: string | null
  created_at: string
}

export interface PaginatedPolicies {
  items: Policy[]
  total: number
  page: number
  page_size: number
  has_next: boolean
}

export interface PolicyFilters {
  pillar?: string
  jurisdiction?: string
  sector?: string
  urgency?: string
  status?: string
  sort?: 'recent' | 'urgency'
  page?: number
  page_size?: number
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
  async getMe(): Promise<User> {
    return apiFetch('/api/users/me')
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
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v))
    })
    return apiFetch(`/api/policies?${params}`)
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
