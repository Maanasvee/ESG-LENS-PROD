// ESG Lens — Notification Bell + Slide Panel
'use client'

import { useState, useEffect } from 'react'
import { Bell, X, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Notification {
  id: string
  title: string
  body: string
  timestamp: Date
  read: boolean
  type: 'immediate_alert' | 'pending_review' | 'info'
  data?: Record<string, string>
}

// Simple in-memory store (replace with FCM in production)
const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    // Register FCM service worker and listen for messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'FCM_MESSAGE') {
          const msg = event.data.payload
          setNotifications(prev => [{
            id: Date.now().toString(),
            title: msg.notification?.title || 'ESG Alert',
            body: msg.notification?.body || '',
            timestamp: new Date(),
            read: false,
            type: msg.data?.type || 'info',
            data: msg.data,
          }, ...prev.slice(0, 49)])
        }
      })
    }
  }, [])

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  const unreadCount = notifications.filter(n => !n.read).length

  return { notifications, unreadCount, markAllRead }
}

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  immediate_alert: <AlertTriangle size={14} style={{ color: 'var(--color-critical)' }} />,
  pending_review:  <CheckCircle size={14} style={{ color: 'var(--color-accent)' }} />,
  info:            <Info size={14} style={{ color: 'var(--color-blue)' }} />,
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, markAllRead } = useNotifications()

  const handleOpen = () => {
    setOpen(true)
    markAllRead()
  }

  return (
    <>
      <div className="notification-bell-wrapper">
        <button id="notification-bell-btn" className="btn btn-ghost btn-sm"
          onClick={handleOpen} title="Notifications"
          style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', position: 'relative' }}>
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
      </div>

      {/* Overlay */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              id="notification-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99 }}
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              id="notification-panel"
              className="notification-panel"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-5)', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>Notifications</h2>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {notifications.length === 0 ? 'All caught up!' : `${notifications.length} alerts`}
                  </p>
                </div>
                <button id="close-notification-panel" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
                  <X size={16} />
                </button>
              </div>

              {/* Notifications list */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div className="empty-state" style={{ paddingTop: 60 }}>
                    <Bell size={40} style={{ color: 'var(--color-border)', marginBottom: 12 }} />
                    <h3 style={{ fontSize: 15 }}>No alerts yet</h3>
                    <p style={{ fontSize: 13 }}>You'll be notified when high-urgency policies are enacted.</p>
                  </div>
                ) : (
                  notifications.map((n, idx) => (
                    <div key={n.id} id={`notification-${idx}`} className="notification-item">
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ marginTop: 2 }}>{NOTIF_ICONS[n.type] || NOTIF_ICONS.info}</div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 3 }}>
                            {n.title}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                            {n.body}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                            {n.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
