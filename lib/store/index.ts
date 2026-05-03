/**
 * Musicanaz Unified Storage System  v1
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO TIERS:
 *
 *  SAFE store  — private, never exported to any service
 *    Keys: cookies, encryption key, auth tokens, private preferences
 *    Namespace prefix: "mz_safe:"
 *
 *  SHARED store — readable by all Musicanaz services
 *    Keys: history, top played, liked songs, artists, playlists, preferences,
 *          listen stats, badges, AI data, party state, fav moments …
 *    Namespace prefix: "mz_shared:"
 *
 * HOW IT WORKS
 *  - Both tiers write to localStorage under namespaced keys.
 *  - The SharedStore exposes a `subscribe(key, cb)` method so any component
 *    can react to cross-tab changes via the `storage` event.
 *  - All reads are synchronous (localStorage). All writes are synchronous.
 *  - SSR-safe: all functions guard `typeof window === "undefined"`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Tier prefixes ─────────────────────────────────────────────────────────────
const SAFE_NS   = "mz_safe:"
const SHARED_NS = "mz_shared:"

// ── Low-level primitives ──────────────────────────────────────────────────────

function _get<T>(ns: string, key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(ns + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch { return fallback }
}

function _set(ns: string, key: string, value: unknown): void {
  if (typeof window === "undefined") return
  try { localStorage.setItem(ns + key, JSON.stringify(value)) } catch {}
}

function _del(ns: string, key: string): void {
  if (typeof window === "undefined") return
  try { localStorage.removeItem(ns + key) } catch {}
}

function _clear(ns: string): void {
  if (typeof window === "undefined") return
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(ns)) toRemove.push(k)
    }
    toRemove.forEach(k => localStorage.removeItem(k))
  } catch {}
}

// ── Cross-tab subscription (shared tier only) ─────────────────────────────────

type Listener<T> = (value: T) => void

const _listeners = new Map<string, Set<Listener<unknown>>>()

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key?.startsWith(SHARED_NS)) return
    const key = e.key.slice(SHARED_NS.length)
    const handlers = _listeners.get(key)
    if (!handlers) return
    let value: unknown = null
    try { value = e.newValue ? JSON.parse(e.newValue) : null } catch {}
    handlers.forEach(cb => cb(value))
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// SAFE STORE
// ═════════════════════════════════════════════════════════════════════════════

export const SafeStore = {
  get<T>(key: string, fallback: T): T { return _get(SAFE_NS, key, fallback) },
  set(key: string, value: unknown): void { _set(SAFE_NS, key, value) },
  del(key: string): void { _del(SAFE_NS, key) },
  clear(): void { _clear(SAFE_NS) },
}

// ═════════════════════════════════════════════════════════════════════════════
// SHARED STORE
// ═════════════════════════════════════════════════════════════════════════════

export const SharedStore = {
  get<T>(key: string, fallback: T): T { return _get(SHARED_NS, key, fallback) },

  set(key: string, value: unknown): void {
    _set(SHARED_NS, key, value)
    // Notify same-tab listeners (storage event doesn't fire for same tab)
    const handlers = _listeners.get(key)
    if (handlers) handlers.forEach(cb => cb(value))
  },

  del(key: string): void { _del(SHARED_NS, key) },
  clear(): void { _clear(SHARED_NS) },

  /**
   * Subscribe to changes in a shared key.
   * Works across tabs via the `storage` event and within the same tab via
   * the internal listener map.
   * Returns an unsubscribe function.
   */
  subscribe<T>(key: string, cb: Listener<T>): () => void {
    if (!_listeners.has(key)) _listeners.set(key, new Set())
    _listeners.get(key)!.add(cb as Listener<unknown>)
    return () => _listeners.get(key)?.delete(cb as Listener<unknown>)
  },
}
