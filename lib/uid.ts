const UID_KEY = "musicanaz_uid"

export function getOrCreateUID(): string {
  if (typeof window === "undefined") return ""

  try {
    const existing = localStorage.getItem(UID_KEY)
    if (existing) return existing

    const uid = crypto.randomUUID()
    localStorage.setItem(UID_KEY, uid)
    return uid
  } catch {
    return ""
  }
}
