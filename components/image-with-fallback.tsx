"use client"

import React, { useState, useEffect, useRef } from "react"

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode
  lazy?: boolean
  eager?: boolean
}

export default function ImageWithFallback({
  src,
  alt,
  className,
  fallback,
  lazy = true,
  eager = false,
  ...props
}: ImageWithFallbackProps) {
  const [error, setError] = useState(false)
  const [visible, setVisible] = useState(!lazy || eager)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setError(false)
  }, [src])

  useEffect(() => {
    if (!lazy || eager) { setVisible(true); return }
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { rootMargin: "200px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [lazy, eager])

  if (error || !src) {
    return fallback ? <>{fallback}</> : <div ref={ref} className={className} />
  }

  if (!visible) {
    return (
      <div
        ref={ref}
        className={`${className} bg-muted/30 animate-pulse`}
        aria-hidden
      />
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setError(true)}
      {...props}
    />
  )
}
