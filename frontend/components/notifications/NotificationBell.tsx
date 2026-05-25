'use client'

import { useState, useEffect } from 'react'
import { Bell, X, AlertTriangle, CheckCircle, Info } from 'lucide-react'

interface Notification {
  id: string
  title: string
  body: string
  timestamp: Date
  read: boolean
  type: 'immediate_alert' | 'pending_review' | 'info'
  data?: Record<string, string>
}

function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'FCM_MESSAGE') {
          const msg = event.data.payload
          setNotifications(prev => [{
            id: Date.now().toString(),
            title: msg.notification?.title || 'Regulatory Alert',
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

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, markAllRead } = useNotifications()

  function handleOpen() {
    setOpen(true)
    markAllRead()
  }

  return (
    <>
      <div style={{ position: 'relative' }}>
        <button
          id="notification-bell-btn"
          className="notif-bell-btn"
          onClick={handleOpen}
          title="Regulatory Alerts"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
      </div>

      {open && (
        <>
          {/* Backdrop */}
          <div
            id="notification-overlay"
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(15, 23, 42, 0.25)',
              zIndex: 99
            }}
          />

          {/* Panel */}
          <div
            id="notification-panel"
            className="notif-panel"
            style={{ top: 0, right: 0 }}
          >
            <div className="notif-panel-header">
              <div>
                <div className="notif-panel-title">Regulatory Alerts</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {notifications.length === 0 ? 'All caught up' : `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`}
                </div>
              </div>
              <button
                id="close-notification-panel"
                className="btn btn-ghost btn-sm"
                onClick={() => setOpen(false)}
                style={{ width: 30, height: 30, padding: 0 }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div className="empty-state" style={{ paddingTop: 60 }}>
                  <div className="empty-state-icon">
                    <Bell size={22} color="var(--color-text-muted)" />
                  </div>
                  <div className="empty-state-title">No alerts yet</div>
                  <div className="empty-state-body">
                    You'll be notified when high-urgency regulatory policies are enacted or proposed.
                  </div>
                </div>
              ) : (
                notifications.map((n, idx) => (
                  <div key={n.id} id={`notification-${idx}`} className="notif-item">
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ marginTop: 2, flexShrink: 0 }}>
                        {n.type === 'immediate_alert' && <AlertTriangle size={14} style={{ color: 'var(--color-critical)' }} />}
                        {n.type === 'pending_review' && <CheckCircle size={14} style={{ color: 'var(--color-accent)' }} />}
                        {n.type === 'info' && <Info size={14} style={{ color: 'var(--color-pillar-s)' }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="notif-item-title">{n.title}</div>
                        <div className="notif-item-body">{n.body}</div>
                        <div className="notif-item-time">{n.timestamp.toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
