"use client"

import { useEffect, useRef } from "react"

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  rotation: number
  rotationSpeed: number
  opacity: number
}

const COLORS = ["#7c3aed", "#a78bfa", "#f59e0b", "#34d399", "#f43f5e", "#60a5fa", "#fb923c"]

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a)
}

export default function ConfettiBlast({ onDone }: { onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: Particle[] = Array.from({ length: 160 }, () => ({
      x: randomBetween(window.innerWidth * 0.2, window.innerWidth * 0.8),
      y: randomBetween(window.innerHeight * 0.1, window.innerHeight * 0.4),
      vx: randomBetween(-6, 6),
      vy: randomBetween(-14, -4),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: randomBetween(6, 12),
      rotation: randomBetween(0, Math.PI * 2),
      rotationSpeed: randomBetween(-0.15, 0.15),
      opacity: 1,
    }))

    let frame = 0
    let raf: number

    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      frame++

      let allDone = true
      for (const p of particles) {
        p.x += p.vx
        p.vy += 0.35 // gravity
        p.y += p.vy
        p.rotation += p.rotationSpeed
        if (frame > 60) p.opacity -= 0.018
        p.opacity = Math.max(0, p.opacity)
        if (p.opacity > 0) allDone = false

        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }

      if (allDone) {
        onDone?.()
        return
      }
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [onDone])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[100]"
      aria-hidden
    />
  )
}
