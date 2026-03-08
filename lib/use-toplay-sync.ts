"use client"

import { useEffect } from "react"
import { syncUserDataToToplay } from "./toplay-sync"

export function useToplaySync(): void {
  useEffect(() => {
    syncUserDataToToplay()
      .then(() => {
        console.log("[toplay] sync complete")
      })
      .catch((err) => {
        console.warn("[toplay] sync failed:", err)
      })
  }, [])
}
