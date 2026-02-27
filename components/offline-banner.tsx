"use client"

import { useState, useEffect, useRef } from "react"
import { WifiOff, Wifi } from "lucide-react"

export default function OfflineBanner() {
  const [status,  setStatus]  = useState<"online" | "offline" | "back">("online")
  const [visible, setVisible] = useState(false)
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Check on mount
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline")
      setVisible(true)
    }

    const goOffline = () => {
      if (backTimer.current) clearTimeout(backTimer.current)
      setStatus("offline")
      setVisible(true)
    }

    const goOnline = () => {
      if (backTimer.current) clearTimeout(backTimer.current)
      setStatus("back")
      setVisible(true)
      backTimer.current = setTimeout(() => setVisible(false), 3000)
    }

    window.addEventListener("offline", goOffline)
    window.addEventListener("online",  goOnline)
    return () => {
      window.removeEventListener("offline", goOffline)
      window.removeEventListener("online",  goOnline)
      if (backTimer.current) clearTimeout(backTimer.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className={[
        "fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2.5",
        "text-sm font-semibold text-white shadow-xl",
        "animate-in slide-in-from-top-2 duration-300",
        status === "offline"
          ? "bg-red-600/95 backdrop-blur-md"
          : "bg-emerald-600/95 backdrop-blur-md",
      ].join(" ")}
    >
      {status === "offline" ? (
        <>
          <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse" />
          <span>No internet — music may not load</span>
        </>
      ) : (
        <>
          <Wifi className="w-4 h-4 flex-shrink-0" />
          <span>Back online!</span>
        </>
      )}
    </div>
  )
}
