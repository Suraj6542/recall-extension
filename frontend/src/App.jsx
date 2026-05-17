import { useEffect, useState, useCallback } from "react"

// const API = "http://localhost:8000/api"
const API = "https://django-production-31ae.up.railway.app/api"
const TYPES = {
  LINK:     { icon: "🔗", label: "Link",     color: "#5b8dee" },
  TODO:     { icon: "✅", label: "Todo",     color: "#4db87a" },
  NOTE:     { icon: "📝", label: "Note",     color: "#e0c46c" },
  VIDEO:    { icon: "🎬", label: "Video",    color: "#e07c6c" },
  JOB:      { icon: "💼", label: "Job",      color: "#b07ce0" },
  PURCHASE: { icon: "🛒", label: "Purchase", color: "#e0a06c" },
  DOCUMENT: { icon: "📄", label: "Document", color: "#6cbbe0" },
}

const QUICK_TIMES = [
  { label: "1 hr",     minutes: 60    },
  { label: "3 hrs",    minutes: 180   },
  { label: "Tomorrow", minutes: 1440  },
  { label: "1 week",   minutes: 10080 },
]

const TYPE_FIELDS = {
  LINK:     { showUrl: true,  urlLabel: "URL",             notePlaceholder: "Why are you saving this?",       extraFields: [] },
  TODO:     { showUrl: false, urlLabel: "",                notePlaceholder: "What exactly needs to be done?", extraFields: [] },
  NOTE:     { showUrl: false, urlLabel: "",                notePlaceholder: "Write your note here...",        extraFields: [] },
  VIDEO:    { showUrl: true,  urlLabel: "Video URL",       notePlaceholder: "What do you want to remember?",  extraFields: [] },
  JOB:      { showUrl: true,  urlLabel: "Job Posting URL", notePlaceholder: "Notes about the role...",        extraFields: ["company"] },
  PURCHASE: { showUrl: true,  urlLabel: "Product URL",     notePlaceholder: "Why do you want this?",          extraFields: ["price"] },
  DOCUMENT: { showUrl: true,  urlLabel: "Document URL",    notePlaceholder: "What's important in this doc?",  extraFields: [] },
}

const SNOOZE_OPTIONS = [
  { label: "10 min", minutes: 10  },
  { label: "30 min", minutes: 30  },
  { label: "1 hr",   minutes: 60  },
  { label: "3 hrs",  minutes: 180 },
]

function toLocalDatetime(date) {
  const p = (n) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`
}

function formatTime(dt) {
  return new Date(dt).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

function isPast(dt) {
  return new Date(dt) < new Date()
}

export default function App() {

  // ── Auth state ──
  const [token,       setToken]       = useState(null)
  const [authMode,    setAuthMode]    = useState("login")  // "login" | "register"
  const [authUser,    setAuthUser]    = useState("")
  const [authPass,    setAuthPass]    = useState("")
  const [authEmail,   setAuthEmail]   = useState("")
  const [authError,   setAuthError]   = useState("")
  const [authLoading, setAuthLoading] = useState(false)

  // ── App state ──
  const [view,       setView]       = useState("save")  // "save" | "list"
  const [items,      setItems]      = useState([])
  const [filter,     setFilter]     = useState("ALL")
  const [saveState,  setSaveState]  = useState("idle")  // "idle"|"saving"|"done"
  const [snoozeMenu, setSnoozeMenu] = useState(null)

  // ── Form state ──
  const [type,     setType]     = useState("LINK")
  const [title,    setTitle]    = useState("")
  const [url,      setUrl]      = useState("")
  const [content,  setContent]  = useState("")
  const [remindAt, setRemindAt] = useState("")
  const [extra,    setExtra]    = useState({})

  // ── On mount: load token from storage, capture tab ──
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get("accessToken", (res) => {
        if (res.accessToken) setToken(res.accessToken)
      })
    }

    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0]
        if (tab) {
          setTitle(tab.title || "")
          setUrl(tab.url || "")
          if (tab.url?.includes("youtube.com") || tab.url?.includes("youtu.be")) {
            setType("VIDEO")
          }
        }
      })
    }
  }, [])

  // ── Fetch items whenever token changes ──
  useEffect(() => {
    if (token) fetchItems()
  }, [token])

  // ── Auth headers helper ──
  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  }), [token])

  // ── Fetch all items ──
  const fetchItems = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${API}/items/`, { headers: authHeaders() })
      if (res.status === 401) { handleLogout(); return }
      const data = await res.json()
      setItems(data)
    } catch (e) {
      console.error("Fetch error:", e)
    }
  }, [token, authHeaders])

  // ── Auth: login or register ──
  const handleAuth = async () => {
    setAuthError("")
    setAuthLoading(true)
    try {
      if (authMode === "register") {
        const res  = await fetch(`${API}/auth/register/`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ username: authUser, password: authPass, email: authEmail }),
        })
        const data = await res.json()
        if (!res.ok) { setAuthError(data.error || "Registration failed"); return }
        // Switch to login after successful register
        setAuthMode("login")
        setAuthPass("")
        setAuthError("Account created! Please sign in.")
        return
      }

      // Login
      const res  = await fetch(`${API}/auth/login/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username: authUser, password: authPass }),
      })
      const data = await res.json()
      if (!res.ok) { setAuthError("Invalid username or password"); return }

      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.set({ accessToken: data.access, refreshToken: data.refresh })
      }
      setToken(data.access)

    } catch (e) {
      setAuthError("Network error. Is the server running?")
    } finally {
      setAuthLoading(false)
    }
  }

  // ── Logout ──
  const handleLogout = () => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.remove(["accessToken", "refreshToken"])
    }
    setToken(null)
    setItems([])
    setAuthUser("")
    setAuthPass("")
    setAuthEmail("")
    setAuthError("")
  }

  // ── Type change ──
  const handleTypeChange = (t) => {
    setType(t)
    setExtra({})
    if (!TYPE_FIELDS[t].showUrl) setUrl("")
  }

  const applyQuickTime = (minutes) => {
    setRemindAt(toLocalDatetime(new Date(Date.now() + minutes * 60000)))
  }

  // ── Save item ──
  const handleSave = async () => {
    if (!title.trim() || !remindAt) return
    setSaveState("saving")
    try {
      const body = { type, title, content, remind_at: remindAt, extra }
      if (TYPE_FIELDS[type].showUrl && url) body.url = url
      const res = await fetch(`${API}/items/`, {
        method:  "POST",
        headers: authHeaders(),
        body:    JSON.stringify(body),
      })
      if (res.status === 401) { handleLogout(); return }
      setSaveState("done")
      fetchItems()
      setTimeout(() => {
        setSaveState("idle")
        setTitle(""); setUrl(""); setContent(""); setRemindAt(""); setExtra({})
        setType("LINK")
      }, 1800)
    } catch (e) {
      console.error("Save error:", e)
      setSaveState("idle")
    }
  }

  // ── Mark complete ──
  const handleComplete = async (id) => {
    await fetch(`${API}/items/${id}/`, {
      method:  "PATCH",
      headers: authHeaders(),
      body:    JSON.stringify({ is_completed: true }),
    })
    fetchItems()
  }

  // ── Delete (soft) ──
  const handleDelete = async (id) => {
    await fetch(`${API}/items/${id}/`, {
      method:  "DELETE",
      headers: authHeaders(),
    })
    fetchItems()
  }

  // ── Snooze ──
  const handleSnooze = async (id, minutes) => {
    await fetch(`${API}/items/${id}/snooze/`, {
      method:  "POST",
      headers: authHeaders(),
      body:    JSON.stringify({ minutes }),
    })
    setSnoozeMenu(null)
    fetchItems()
  }

  const filtered = items.filter((i) => filter === "ALL" || i.type === filter)
  const pending  = items.filter((i) => !i.is_completed).length
  const cfg      = TYPE_FIELDS[type]

 
  if (!token) {
    return (
      <div style={S.root}>
        <div style={S.header}>
          <div style={S.brand}>
            <span style={S.logo}>◑</span>
            <span style={S.brandName}>Recall</span>
          </div>
        </div>

        <div style={S.body}>
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>
              {authMode === "login" ? "👋" : "✨"}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f0ede8", marginBottom: 4 }}>
              {authMode === "login" ? "Welcome back" : "Create account"}
            </div>
            <div style={{ fontSize: 11, color: "#555" }}>
              {authMode === "login"
                ? "Sign in to see your saved items"
                : "Start saving things for your future self"}
            </div>
          </div>

          {authMode === "register" && (
            <input
              style={S.input}
              type="email"
              placeholder="Email (optional)"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
            />
          )}

          <input
            style={S.input}
            type="text"
            placeholder="Username"
            value={authUser}
            onChange={(e) => setAuthUser(e.target.value)}
            autoComplete="username"
          />

          <input
            style={S.input}
            type="password"
            placeholder="Password"
            value={authPass}
            onChange={(e) => setAuthPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            autoComplete={authMode === "login" ? "current-password" : "new-password"}
          />

          {authError && (
            <div style={{
              fontSize: 11, padding: "8px 10px", borderRadius: 7,
              background: authError.includes("created") ? "#1a3a22" : "#2a1a1a",
              color:      authError.includes("created") ? "#4db87a"  : "#e06c6c",
              border:     `1px solid ${authError.includes("created") ? "#2a4a32" : "#3a2a2a"}`,
            }}>
              {authError}
            </div>
          )}

          <button
            style={{
              ...S.saveBtn,
              background: "#c9a96e",
              opacity: (!authUser.trim() || !authPass.trim() || authLoading) ? 0.5 : 1,
              marginTop: 4,
            }}
            disabled={!authUser.trim() || !authPass.trim() || authLoading}
            onClick={handleAuth}
          >
            {authLoading ? "…" : authMode === "login" ? "Sign In" : "Create Account"}
          </button>

          <button
            style={S.switchBtn}
            onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError("") }}
          >
            {authMode === "login" ? "No account? Register →" : "← Back to sign in"}
          </button>
        </div>
      </div>
    )
  }


  return (
    <div style={S.root}>

      {/* ── HEADER ── */}
      <div style={S.header}>
        <div style={S.brand}>
          <span style={S.logo}>◑</span>
          <span style={S.brandName}>Recall</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={S.tabs}>
            <button
              style={{ ...S.tab, ...(view === "save" ? S.tabActive : {}) }}
              onClick={() => setView("save")}
            >
              Save
            </button>
            <button
              style={{ ...S.tab, ...(view === "list" ? S.tabActive : {}) }}
              onClick={() => setView("list")}
            >
              Saved {pending > 0 && <span style={S.badge}>{pending}</span>}
            </button>
          </div>
          <button style={S.logoutBtn} onClick={handleLogout} title="Sign out">
            ↩
          </button>
        </div>
      </div>

      
      {view === "save" && (
        <div style={S.body}>

          {/* Type selector */}
          <div style={S.typeGrid}>
            {Object.entries(TYPES).map(([key, { icon, label, color }]) => (
              <button
                key={key}
                style={{
                  ...S.typeBtn,
                  ...(type === key ? { ...S.typeBtnActive, borderColor: color } : {})
                }}
                onClick={() => handleTypeChange(key)}
                title={label}
              >
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{
                  fontSize: 9, fontWeight: 600, letterSpacing: "0.04em",
                  color: type === key ? color : "#555",
                  textTransform: "uppercase", marginTop: 2,
                }}>
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* Title */}
          <input
            style={S.input}
            type="text"
            placeholder="Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {/* URL */}
          {cfg.showUrl && (
            <input
              style={S.input}
              type="text"
              placeholder={cfg.urlLabel}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          )}

          {/* Extra fields */}
          {cfg.extraFields.includes("company") && (
            <input
              style={S.input}
              type="text"
              placeholder="Company name"
              value={extra.company || ""}
              onChange={(e) => setExtra({ ...extra, company: e.target.value })}
            />
          )}
          {cfg.extraFields.includes("price") && (
            <input
              style={S.input}
              type="text"
              placeholder="Price (e.g. ₹4,999)"
              value={extra.price || ""}
              onChange={(e) => setExtra({ ...extra, price: e.target.value })}
            />
          )}

          {/* Note */}
          <textarea
            style={{ ...S.input, ...S.textarea }}
            placeholder={cfg.notePlaceholder}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />

          {/* Quick time */}
          <div style={{ marginBottom: 2 }}>
            <div style={S.sectionLabel}>Remind me in</div>
            <div style={S.quickRow}>
              {QUICK_TIMES.map((q) => (
                <button key={q.label} style={S.quickBtn} onClick={() => applyQuickTime(q.minutes)}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Datetime picker */}
          <input
            style={S.input}
            type="datetime-local"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
          />

          {/* Save button */}
          <button
            style={{
              ...S.saveBtn,
              background: saveState === "done" ? "#3a7d44" : TYPES[type].color,
              opacity: (!title.trim() || !remindAt) ? 0.4 : 1,
            }}
            disabled={!title.trim() || !remindAt || saveState === "saving"}
            onClick={handleSave}
          >
            {saveState === "done"   ? "✓  Saved!"         :
             saveState === "saving" ? "Saving…"            :
             `Save ${TYPES[type].label}`}
          </button>

        </div>
      )}

    
      {view === "list" && (
        <div style={S.body}>

          {/* Filter pills */}
          <div style={S.filterRow}>
            {["ALL", ...Object.keys(TYPES)].map((f) => (
              <button
                key={f}
                style={{
                  ...S.pill,
                  ...(filter === f ? {
                    background:  "#2a2a30",
                    borderColor: f === "ALL" ? "#c9a96e" : TYPES[f]?.color || "#c9a96e",
                    color:       f === "ALL" ? "#c9a96e" : TYPES[f]?.color || "#c9a96e",
                  } : {})
                }}
                onClick={() => setFilter(f)}
              >
                {f === "ALL" ? "All" : `${TYPES[f].icon} ${TYPES[f].label}`}
              </button>
            ))}
          </div>

          {/* Items */}
          {filtered.length === 0 ? (
            <div style={S.empty}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>◌</div>
              <div>Nothing here yet</div>
            </div>
          ) : (
            filtered.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                snoozeMenuOpen={snoozeMenu === item.id}
                onComplete={() => handleComplete(item.id)}
                onDelete={() => handleDelete(item.id)}
                onSnoozeToggle={() => setSnoozeMenu(snoozeMenu === item.id ? null : item.id)}
                onSnooze={(min) => handleSnooze(item.id, min)}
              />
            ))
          )}

        </div>
      )}

    </div>
  )
}

//  ITEM CARD
function ItemCard({ item, snoozeMenuOpen, onComplete, onDelete, onSnoozeToggle, onSnooze }) {
  const typeCfg = TYPES[item.type] || TYPES.LINK
  const overdue = !item.is_completed && isPast(item.remind_at)

  return (
    <div style={{
      ...S.card,
      opacity:     item.is_completed ? 0.4 : 1,
      borderColor: overdue && !item.is_completed ? "#e06c6c44" : "#2a2a30",
    }}>

      <div style={S.cardTop}>
        <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>
          {typeCfg.icon}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            ...S.cardTitle,
            textDecoration: item.is_completed ? "line-through" : "none",
          }}>
            {item.title}
          </div>

          {item.extra?.company && <div style={S.cardSub}>{item.extra.company}</div>}
          {item.extra?.price   && <div style={S.cardSub}>{item.extra.price}</div>}

          <div style={{
            ...S.cardTime,
            color: overdue && !item.is_completed ? "#e06c6c" : "#555",
          }}>
            {overdue && !item.is_completed ? "⚠ " : ""}
            {formatTime(item.remind_at)}
            {item.snooze_count > 0 && (
              <span style={{ color: "#888", marginLeft: 5 }}>
                · snoozed {item.snooze_count}×
              </span>
            )}
          </div>
        </div>

        {!item.is_completed && (
          <div style={S.cardActions}>
            <button style={S.actionBtn} onClick={onSnoozeToggle} title="Snooze">⏰</button>
            <button style={{ ...S.actionBtn, color: "#4db87a" }} onClick={onComplete} title="Mark done">✓</button>
          </div>
        )}

        <button
          style={{ ...S.actionBtn, color: "#e06c6c", marginLeft: 2 }}
          onClick={onDelete}
          title="Delete"
        >
          ×
        </button>
      </div>

      {item.content && <div style={S.cardNote}>{item.content}</div>}

      {item.url && (
        <a href={item.url} target="_blank" rel="noreferrer" style={S.cardLink}>
          {item.type === "VIDEO"    ? "▶ Watch now"     :
           item.type === "JOB"     ? "View posting ↗"   :
           item.type === "PURCHASE"? "View product ↗"   :
           item.type === "DOCUMENT"? "Open doc ↗"       :
           "Open link ↗"}
        </a>
      )}

      {snoozeMenuOpen && (
        <div style={S.snoozeMenu}>
          <div style={S.snoozeLabel}>Snooze for…</div>
          <div style={S.snoozeRow}>
            {SNOOZE_OPTIONS.map((o) => (
              <button key={o.label} style={S.snoozeBtn} onClick={() => onSnooze(o.minutes)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

//  STYLES 
const S = {
  root: {
    width: 360, minHeight: 500, maxHeight: 580,
    fontFamily: "'DM Sans','Helvetica Neue',Arial,sans-serif",
    background: "#0e0e10", color: "#f0ede8",
    display: "flex", flexDirection: "column", overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "13px 16px 11px", borderBottom: "1px solid #1e1e22", flexShrink: 0,
  },
  brand:     { display: "flex", alignItems: "center", gap: 7 },
  logo:      { fontSize: 20, color: "#c9a96e", lineHeight: 1 },
  brandName: { fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" },
  tabs: {
    display: "flex", gap: 3,
    background: "#19191d", borderRadius: 8, padding: 3,
  },
  tab: {
    background: "none", border: "none", color: "#666",
    fontSize: 12, fontWeight: 500, padding: "5px 11px",
    borderRadius: 6, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 5,
  },
  tabActive: { background: "#2a2a30", color: "#f0ede8" },
  badge: {
    background: "#c9a96e", color: "#0e0e10",
    fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "1px 5px",
  },
  logoutBtn: {
    background: "none", border: "1px solid #2a2a30",
    borderRadius: 6, color: "#555", fontSize: 13,
    width: 26, height: 26, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0,
  },
  body: {
    padding: "14px 16px 18px",
    display: "flex", flexDirection: "column", gap: 9,
    overflowY: "auto", flex: 1,
  },
  typeGrid: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 },
  typeBtn: {
    background: "#19191d", border: "1px solid #2a2a30",
    borderRadius: 8, cursor: "pointer",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    padding: "7px 2px", gap: 2, transition: "all 0.12s",
  },
  typeBtnActive: { background: "#222228" },
  sectionLabel: {
    fontSize: 10, color: "#555", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
  },
  input: {
    width: "100%", padding: "9px 11px",
    background: "#19191d", border: "1px solid #2a2a30",
    borderRadius: 8, color: "#f0ede8",
    fontSize: 13, outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
  },
  textarea: { minHeight: 68, resize: "vertical", lineHeight: 1.5 },
  quickRow: { display: "flex", gap: 6 },
  quickBtn: {
    flex: 1, padding: "6px 0",
    background: "#19191d", border: "1px solid #2a2a30",
    borderRadius: 6, color: "#aaa", fontSize: 11, fontWeight: 500, cursor: "pointer",
  },
  saveBtn: {
    width: "100%", padding: "11px 0",
    border: "none", borderRadius: 9,
    color: "#0e0e10", fontSize: 13, fontWeight: 700,
    cursor: "pointer", letterSpacing: "0.02em",
    transition: "all 0.2s", marginTop: 2,
  },
  switchBtn: {
    background: "none", border: "none",
    color: "#555", fontSize: 12, cursor: "pointer",
    textAlign: "center", padding: "4px 0",
  },
  filterRow: { display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 2 },
  pill: {
    padding: "4px 9px",
    background: "#19191d", border: "1px solid #2a2a30",
    borderRadius: 99, color: "#666",
    fontSize: 11, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
  },
  empty: { textAlign: "center", padding: "40px 0", color: "#444", fontSize: 13 },
  card: {
    background: "#19191d", border: "1px solid #2a2a30",
    borderRadius: 10, padding: "11px 12px",
    display: "flex", flexDirection: "column", gap: 6,
  },
  cardTop:    { display: "flex", alignItems: "flex-start", gap: 9 },
  cardTitle: {
    fontSize: 13, fontWeight: 600, color: "#f0ede8",
    lineHeight: 1.3, overflow: "hidden",
    textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  cardSub:     { fontSize: 11, color: "#888", marginTop: 1 },
  cardTime:    { fontSize: 11, color: "#555", marginTop: 2 },
  cardActions: { display: "flex", gap: 4, flexShrink: 0 },
  actionBtn: {
    width: 26, height: 26,
    background: "#2a2a30", border: "1px solid #333",
    borderRadius: 6, color: "#aaa", fontSize: 13, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    lineHeight: 1, padding: 0,
  },
  cardNote: { fontSize: 12, color: "#777", lineHeight: 1.45, paddingLeft: 24 },
  cardLink: { fontSize: 11, color: "#c9a96e", textDecoration: "none", paddingLeft: 24, fontWeight: 500 },
  snoozeMenu: {
    background: "#141416", border: "1px solid #2a2a30",
    borderRadius: 8, padding: "10px 11px", marginTop: 2,
  },
  snoozeLabel: {
    fontSize: 10, color: "#555", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
  },
  snoozeRow: { display: "flex", gap: 6 },
  snoozeBtn: {
    flex: 1, padding: "6px 0",
    background: "#1e1e22", border: "1px solid #2a2a30",
    borderRadius: 6, color: "#c9a96e", fontSize: 11, fontWeight: 600, cursor: "pointer",
  },
}