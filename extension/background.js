// const API_BASE = 'http://localhost:8000/api'
const API_BASE = "https://django-production-31ae.up.railway.app/api"
const POLL_INTERVAL_MINUTES = 1
const NOTIFIED_KEY = 'notifiedIds'

// ─── Helper: get stored token ─────────────────────────────────────────────────
async function getToken() {
  const result = await chrome.storage.local.get('accessToken')
  return result.accessToken || null
}

// ─── Helper: authenticated fetch ─────────────────────────────────────────────
async function authFetch(url, options = {}) {
  const token = await getToken()
  if (!token) throw new Error('Not logged in')

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
}

// ─── ON INSTALL ───────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('pollDue', { periodInMinutes: POLL_INTERVAL_MINUTES })
})

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('pollDue', { periodInMinutes: POLL_INTERVAL_MINUTES })
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pollDue') checkDueItems()
})

// ─── POLL ─────────────────────────────────────────────────────────────────────
async function checkDueItems() {
  try {
    const token = await getToken()
    if (!token) return

    let res
    try {
      res = await fetch(`${API_BASE}/items/due/`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      })
    } catch (networkErr) {
      return  // server down, wait for next poll
    }

    if (!res.ok) return

    const items = await res.json()
    if (!Array.isArray(items) || items.length === 0) return

    const stored      = await chrome.storage.local.get(NOTIFIED_KEY)
    const notified    = new Set(stored[NOTIFIED_KEY] || [])
    const activeNotifs = await chrome.notifications.getAll()

    for (const item of items) {
      const notifId = `recall-${item.id}`

      // Already showing on screen — skip
      if (activeNotifs[notifId]) continue

      // Fire — whether first time or missed
      await fireNotification(item)
      notified.add(item.id)
    }

    await chrome.storage.local.set({ [NOTIFIED_KEY]: [...notified] })

  } catch (err) {
    console.warn('[Recall] Poll skipped:', err.message)
  }
}

// ─── NOTIFICATION BUTTON CLICKS ───────────────────────────────────────────────
chrome.notifications.onButtonClicked.addListener(async (notifId, buttonIndex) => {
  if (!notifId.startsWith('recall-')) return
  const itemId = parseInt(notifId.replace('recall-', ''), 10)

  let item
  try {
    const res = await authFetch(`${API_BASE}/items/${itemId}/`)
    item = await res.json()
  } catch (err) { return }

  if (buttonIndex === 0) {
    await authFetch(`${API_BASE}/items/${itemId}/snooze/`, {
      method: 'POST',
      body: JSON.stringify({ minutes: 30 }),
    })
    chrome.notifications.clear(notifId)
    await removeFromNotified(itemId)
    chrome.notifications.create(`recall-snooze-${itemId}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon.png'),
      title: '⏰ Snoozed',
      message: `"${item.title}" will remind you again in 30 min.`,
    })
    return
  }

  if (buttonIndex === 1) {
    if (item.url) {
      chrome.tabs.create({ url: item.url })
    } else {
      await authFetch(`${API_BASE}/items/${itemId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ is_completed: true }),
      })
    }
    chrome.notifications.clear(notifId)
  }
})

chrome.notifications.onClicked.addListener(async (notifId) => {
  if (!notifId.startsWith('recall-')) return
  const itemId = parseInt(notifId.replace('recall-', ''), 10)
  try {
    const res  = await authFetch(`${API_BASE}/items/${itemId}/`)
    const item = await res.json()
    if (item.url) chrome.tabs.create({ url: item.url })
  } catch (err) {}
  chrome.notifications.clear(notifId)
})

chrome.notifications.onClosed.addListener(async (notifId, byUser) => {
  if (!notifId.startsWith('recall-')) return
  if (byUser) {
    const itemId = parseInt(notifId.replace('recall-', ''), 10)
    await removeFromNotified(itemId)
  }
})

// ─── Keep existing fireNotification / buildNotificationText / removeFromNotified unchanged ──
async function removeFromNotified(itemId) {
  const stored   = await chrome.storage.local.get(NOTIFIED_KEY)
  const notified = new Set(stored[NOTIFIED_KEY] || [])
  notified.delete(itemId)
  await chrome.storage.local.set({ [NOTIFIED_KEY]: [...notified] })
}

function buildNotificationText(item) {
  const typeMessages = {
    LINK:     { prefix: 'Time to revisit',  suffix: '' },
    TODO:     { prefix: 'Time to do',       suffix: '' },
    NOTE:     { prefix: 'Recall this note', suffix: item.content || '' },
    VIDEO:    { prefix: 'Time to watch',    suffix: '' },
    JOB:      { prefix: 'Follow up on',     suffix: item.extra?.company || '' },
    PURCHASE: { prefix: 'Still want this?', suffix: item.extra?.price ? `Price: ${item.extra.price}` : '' },
    DOCUMENT: { prefix: 'Review this doc',  suffix: '' },
  }
  const cfg     = typeMessages[item.type] || { prefix: 'Reminder', suffix: '' }
  return { title: `${cfg.prefix}: ${item.title}`, message: cfg.suffix || item.content || 'Tap to open' }
}

async function fireNotification(item) {
  const { title, message } = buildNotificationText(item)
  const buttons = [{ title: '⏰ Snooze 30 min' }]
  if (item.url) buttons.push({ title: '🔗 Open Link' })
  else          buttons.push({ title: '✅ Mark Done' })

  chrome.notifications.create(`recall-${item.id}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon.png'),
    title, message, buttons,
    priority: 2,
    requireInteraction: true,
  })
}