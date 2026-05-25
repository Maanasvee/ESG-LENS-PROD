// Firebase Cloud Messaging Service Worker
// Place this file in public/firebase-messaging-sw.js
// This enables background push notifications on web.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

// Firebase config is injected at runtime from localStorage
// (set by the client app after loading env vars)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    const config = event.data.config
    if (!firebase.apps.length) {
      firebase.initializeApp(config)
    }
    const messaging = firebase.messaging()
    messaging.onBackgroundMessage((payload) => {
      const { title, body } = payload.notification || {}
      self.registration.showNotification(title || 'ESG Lens Alert', {
        body: body || 'New policy update',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: 'esg-alert',
        data: payload.data,
        actions: [
          { action: 'view', title: 'View Policy' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
        vibrate: [200, 100, 200],
      })
    })
  }
})

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'view') {
    const policyId = event.notification.data?.policy_id
    const url = policyId ? `/?highlight=${policyId}` : '/'
    event.waitUntil(clients.openWindow(url))
  }
})
