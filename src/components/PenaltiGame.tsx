import { useEffect, useRef, useState } from 'react'

const W = 440, H = 320
const GL = 90, GR = 350, GT = 38, GB = 130
const GW = GR - GL, GH = GB - GT
const BX0 = W / 2, BY0 = H - 44
const CHAR_SCALE = 0.62

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function easeOut(t: number) { return 1 - (1 - t) ** 2.5 }
function easeOutQ(t: number) { return 1 - (1 - t) * (1 - t) }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function sub(t: number, s: number, e: number) { return clamp((t - s) / (e - s), 0, 1) }

type GS = {
  phase: 'idle' | 'fly' | 'done'
  t: number
  bx: number; by: number; bscale: number
  tx: number; ty: number
  kx: number; ktx: number
  hx: number; hy: number
  goals: number; shots: number
  scored: boolean
  idleT: number
}

// interpolate across keyframes: [[t, v0, v1, ...], ...]
function kf(t: number, frames: number[][]): number[] {
  for (let i = 0; i < frames.length - 1; i++) {
    if (t <= frames[i + 1][0]) {
      const p = easeOutQ((t - frames[i][0]) / (frames[i + 1][0] - frames[i][0]))
      return frames[i].slice(1).map((v, idx) => lerp(v, frames[i + 1][idx + 1], p))
    }
  }
  return frames[frames.length - 1].slice(1)
}

function drawField(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#1a3d1a'); bg.addColorStop(1, '#0f2a0f')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < 8; i++) {
    const y1 = GB + (H - GB) * (i / 8), y2 = GB + (H - GB) * ((i + 0.5) / 8)
    ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.fillRect(0, y1, W, y2 - y1)
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(10, H - 10); ctx.lineTo(GL - 10, GB)
  ctx.moveTo(W - 10, H - 10); ctx.lineTo(GR + 10, GB)
  ctx.moveTo(10, H - 10); ctx.lineTo(W - 10, H - 10)
  ctx.stroke(); ctx.setLineDash([])
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(W / 2, H); ctx.lineTo(W / 2, GB); ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath(); ctx.arc(W / 2, BY0 - 6, 4, 0, Math.PI * 2); ctx.fill()
}

function drawGoal3D(ctx: CanvasRenderingContext2D) {
  const DEPTH = 28, vx = W / 2, vy = 5
  function proj(px: number, py: number) {
    const t = DEPTH / (H - vy)
    return { x: px + (vx - px) * t, y: py + (vy - py) * t }
  }
  const bTL = proj(GL, GT), bTR = proj(GR, GT), bBL = proj(GL, GB), bBR = proj(GR, GB)
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  ctx.beginPath(); ctx.moveTo(bTL.x, bTL.y); ctx.lineTo(bTR.x, bTR.y)
  ctx.lineTo(bBR.x, bBR.y); ctx.lineTo(bBL.x, bBL.y); ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.03)'
  ctx.beginPath(); ctx.moveTo(GL, GT); ctx.lineTo(bTL.x, bTL.y); ctx.lineTo(bBL.x, bBL.y); ctx.lineTo(GL, GB); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(GR, GT); ctx.lineTo(bTR.x, bTR.y); ctx.lineTo(bBR.x, bBR.y); ctx.lineTo(GR, GB); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 0.8; ctx.setLineDash([])
  for (let x = GL; x <= GR; x += 18) { ctx.beginPath(); ctx.moveTo(x, GT); ctx.lineTo(x, GB); ctx.stroke() }
  for (let y = GT; y <= GB; y += 14) { ctx.beginPath(); ctx.moveTo(GL, y); ctx.lineTo(GR, y); ctx.stroke() }
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1
  ;[[GL, GT, bTL.x, bTL.y], [GR, GT, bTR.x, bTR.y], [GL, GB, bBL.x, bBL.y], [GR, GB, bBR.x, bBR.y]].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  })
  ctx.beginPath(); ctx.moveTo(bTL.x, bTL.y); ctx.lineTo(bTR.x, bTR.y); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(bBL.x, bBL.y); ctx.lineTo(bBR.x, bBR.y); ctx.stroke()
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(GL, GT); ctx.lineTo(GL, GB); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(GR, GT); ctx.lineTo(GR, GB); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(GL, GT); ctx.lineTo(GR, GT); ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(GL, GB); ctx.lineTo(GR, GB); ctx.stroke()
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const r = 16 * scale
  if (scale > 0.6) {
    const ss = (scale - 0.6) / 0.4
    ctx.fillStyle = `rgba(0,0,0,${0.2 * ss})`
    ctx.beginPath(); ctx.ellipse(x, BY0 + 20, r * 1.2 * ss, r * 0.3 * ss, 0, 0, Math.PI * 2); ctx.fill()
  }
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  const patches = [[0, 0], [0.6, -0.5], [-0.6, -0.5], [0.6, 0.5], [-0.6, 0.5]]
  for (const [px, py] of patches) {
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI / 5) - Math.PI / 2
      const bx = x + (px * r * 0.55) + Math.cos(a) * r * 0.28
      const by = y + (py * r * 0.55) + Math.sin(a) * r * 0.28
      i === 0 ? ctx.moveTo(bx, by) : ctx.lineTo(bx, by)
    }
    ctx.closePath(); ctx.fill()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.25, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
}

function drawKeeper(ctx: CanvasRenderingContext2D, kx: number, g: GS) {
  const { phase, t, tx, ty, scored, idleT } = g
  const goalCY = GT + GH * 0.44  // ~79

  const diveLeft  = tx < W / 2 - 28
  const diveRight = tx > W / 2 + 28
  const diveDir   = diveLeft ? -1 : diveRight ? 1 : 0
  const isHigh    = ty < GT + GH * 0.38
  const isLow     = ty > GT + GH * 0.65

  // dx, dy = body offset; rot = rotation; armL/R = elevation (0=horizontal, 1=up, -1=down)
  let dx = 0, dy = 0, rot = 0, armL = 0.15, armR = 0.15, legBend = 0.3

  if (phase === 'idle') {
    dy = Math.sin(idleT * 2.1) * 2.8
    dx = Math.sin(idleT * 0.95) * 2.2
    armL = 0.18 + Math.sin(idleT * 1.7) * 0.07
    armR = 0.18 + Math.sin(idleT * 1.7 + 0.7) * 0.07
    legBend = 0.35
  } else if (phase === 'fly') {
    const t1 = sub(t, 0, 0.22)
    const t2 = sub(t, 0.22, 1.0)
    // anticipation
    dy = lerp(0, 6, easeOut(t1))
    dx = lerp(0, diveDir * 7, easeOut(t1))
    legBend = lerp(0.35, 0.75, easeOut(t1))
    if (t >= 0.22) {
      const dp = easeOut(t2)
      if (isHigh) {
        dy = lerp(6, -44, dp)
        dx = lerp(diveDir * 7, diveDir * 16, dp)
        armL = lerp(0.2, 1.0, dp)
        armR = lerp(0.2, 1.0, dp)
        legBend = lerp(0.75, 0.2, dp)
      } else if (diveDir === 0) {
        dy = lerp(6, 12, dp)
        legBend = lerp(0.75, 0.9, dp)
        armL = lerp(0.2, 0.5, dp)
        armR = lerp(0.2, 0.5, dp)
      } else {
        dx = lerp(diveDir * 7, diveDir * 60, dp)
        dy = lerp(6, isLow ? 22 : 14, dp)
        rot = lerp(0, diveDir * 0.7, dp)
        legBend = lerp(0.75, 0.9, dp)
        if (diveLeft) { armL = lerp(0.2, 0.85, dp); armR = lerp(0.2, -0.3, dp) }
        else          { armL = lerp(0.2, -0.3, dp); armR = lerp(0.2, 0.85, dp) }
      }
    }
  } else { // done
    if (scored) {
      dy = 10; legBend = 0.95; armL = -0.45; armR = -0.45
    } else {
      if (isHigh) {
        dy = -44; dx = diveDir * 16; armL = armR = 1.0; legBend = 0.2
      } else if (diveDir !== 0) {
        dx = diveDir * 60; dy = isLow ? 22 : 14
        rot = diveDir * 0.7; legBend = 0.9
        if (diveLeft) { armL = 0.85; armR = -0.3 } else { armL = -0.3; armR = 0.85 }
      } else {
        dy = 12; legBend = 0.9; armL = armR = 0.5
      }
    }
  }

  // Shadow
  ctx.fillStyle = `rgba(0,0,0,${clamp(0.18 - Math.abs(dy) * 0.003, 0.05, 0.18)})`
  ctx.beginPath()
  ctx.ellipse(kx + dx * 0.5, GB - 2, (22 + Math.abs(dx) * 0.2) * CHAR_SCALE, 4 * CHAR_SCALE, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.translate(kx + dx, goalCY + dy)
  ctx.rotate(rot)
  ctx.scale(CHAR_SCALE, CHAR_SCALE)

  // --- Body local coords (origin = torso center) ---
  // Legs
  const footDY = 36 + legBend * 10
  const kneeDY = 22 + legBend * 8
  const kneeSplay = 5 + legBend * 3

  ctx.strokeStyle = '#1e1b4b'; ctx.lineWidth = 10; ctx.lineCap = 'round'
  // left leg
  ctx.beginPath()
  ctx.moveTo(-7, 18)
  ctx.quadraticCurveTo(-7 - kneeSplay, kneeDY + 2, -8, footDY)
  ctx.stroke()
  // right leg
  ctx.beginPath()
  ctx.moveTo(7, 18)
  ctx.quadraticCurveTo(7 + kneeSplay, kneeDY + 2, 8, footDY)
  ctx.stroke()
  // sock whites
  ctx.strokeStyle = '#e0e7ff'; ctx.lineWidth = 4
  ctx.beginPath(); ctx.moveTo(-8, footDY - 6); ctx.lineTo(-8, footDY); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(8, footDY - 6); ctx.lineTo(8, footDY); ctx.stroke()
  // boots
  ctx.fillStyle = '#111'
  ctx.beginPath(); ctx.ellipse(-8, footDY + 4, 10, 5, -0.1, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(8, footDY + 4, 10, 5, 0.1, 0, Math.PI * 2); ctx.fill()

  // Shorts
  const sg = ctx.createLinearGradient(-15, 16, 15, 16)
  sg.addColorStop(0, '#1e1b4b'); sg.addColorStop(0.5, '#312e81'); sg.addColorStop(1, '#1e1b4b')
  ctx.fillStyle = sg
  ctx.beginPath(); ctx.roundRect(-14, 16, 28, 14, [0, 0, 6, 6]); ctx.fill()

  // Arms — computed from shoulder endpoint using elevation angle
  const armLen = 26
  const LSx = -19, LSy = -10, RSx = 19, RSy = -10
  const lAng = (Math.PI / 2) * armL
  const rAng = (Math.PI / 2) * armR
  const lAx = LSx - armLen * Math.cos(lAng)
  const lAy = LSy - armLen * Math.sin(lAng)
  const rAx = RSx + armLen * Math.cos(rAng)
  const rAy = RSy - armLen * Math.sin(rAng)

  ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 9; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(LSx, LSy)
  ctx.quadraticCurveTo(LSx + (lAx - LSx) * 0.5 - 4, LSy + (lAy - LSy) * 0.5 + 3, lAx, lAy)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(RSx, RSy)
  ctx.quadraticCurveTo(RSx + (rAx - RSx) * 0.5 + 4, RSy + (rAy - RSy) * 0.5 + 3, rAx, rAy)
  ctx.stroke()

  // Gloves
  for (const [gx, gy] of [[lAx, lAy], [rAx, rAy]]) {
    const gg = ctx.createRadialGradient(gx, gy, 2, gx, gy, 11)
    gg.addColorStop(0, '#fde68a'); gg.addColorStop(1, '#d97706')
    ctx.fillStyle = gg
    ctx.beginPath(); ctx.arc(gx, gy, 10, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(gx, gy, 10, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1.2
    for (let f = -1; f <= 1; f++) {
      ctx.beginPath(); ctx.moveTo(gx + f * 3, gy - 5); ctx.lineTo(gx + f * 3, gy - 9); ctx.stroke()
    }
  }

  // Torso
  const jg = ctx.createLinearGradient(-20, 0, 20, 0)
  jg.addColorStop(0, '#9b1c1c'); jg.addColorStop(0.35, '#ef4444')
  jg.addColorStop(0.65, '#ef4444'); jg.addColorStop(1, '#9b1c1c')
  ctx.fillStyle = jg
  ctx.beginPath()
  ctx.moveTo(-19, -18)
  ctx.quadraticCurveTo(-22, 0, -18, 18); ctx.lineTo(18, 18)
  ctx.quadraticCurveTo(22, 0, 19, -18)
  ctx.quadraticCurveTo(0, -22, -19, -18)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = 'bold 13px Arial'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('1', 0, 0)
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.arc(0, -19, 7, Math.PI + 0.4, -0.4); ctx.stroke()

  // Neck + Head
  const headY = -35
  ctx.fillStyle = '#d4956a'; ctx.beginPath(); ctx.roundRect(-5, -27, 10, 10, 3); ctx.fill()
  const hg = ctx.createRadialGradient(-3, headY - 4, 3, 0, headY, 14)
  hg.addColorStop(0, '#e8b090'); hg.addColorStop(1, '#c07848')
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, headY, 14, 0, Math.PI * 2); ctx.fill()
  // Hair
  ctx.fillStyle = '#2d1200'; ctx.beginPath(); ctx.arc(0, headY - 1, 13, Math.PI + 0.15, -0.15); ctx.fill()
  // Eyebrows
  ctx.strokeStyle = '#2d1200'; ctx.lineWidth = 2; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-9, headY - 6); ctx.lineTo(-4, headY - 7); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(4, headY - 7); ctx.lineTo(9, headY - 6); ctx.stroke()
  // Eyes
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.ellipse(-5, headY - 2, 3.5, 3, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(5, headY - 2, 3.5, 3, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a0800'
  ctx.beginPath(); ctx.arc(-5, headY - 2, 2, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(5, headY - 2, 2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.beginPath(); ctx.arc(-4, headY - 3, 0.8, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(6, headY - 3, 0.8, 0, Math.PI * 2); ctx.fill()
  // Nose
  ctx.strokeStyle = '#a06040'; ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.arc(0, headY + 2, 2.5, 0.3, Math.PI - 0.3); ctx.stroke()
  // Mouth — changes with result
  ctx.strokeStyle = '#8b4020'; ctx.lineWidth = 1.8
  ctx.beginPath()
  if (phase === 'done' && scored) {
    ctx.moveTo(-4, headY + 7); ctx.quadraticCurveTo(0, headY + 5, 4, headY + 7) // frown
  } else if (phase === 'done' && !scored) {
    ctx.moveTo(-5, headY + 6); ctx.quadraticCurveTo(0, headY + 9, 5, headY + 6) // smile
  } else {
    ctx.moveTo(-4, headY + 7); ctx.lineTo(4, headY + 7) // focused
  }
  ctx.stroke()

  ctx.restore()
}

function drawNeymar(ctx: CanvasRenderingContext2D, g: GS) {
  const { phase, t, scored, idleT } = g
  const nx = BX0
  const baseY = BY0 + 18  // ground level for feet

  // Body Y offset (for idle bounce or celebration jump)
  let bodyLift = 0
  if (phase === 'idle') {
    bodyLift = Math.abs(Math.sin(idleT * 2.0)) * 2.5
  } else if (phase === 'done' && scored) {
    bodyLift = 14 + Math.abs(Math.sin(idleT * 4.0)) * 6 // jumping celebration
  }

  // Body lean angle (forward = positive)
  let bodyLean = 0
  if (phase === 'fly') {
    const [lean] = kf(t, [
      [0.00,  0.00],
      [0.20, -0.06], // wind-up: lean back
      [0.38,  0.09], // impact: lean forward
      [0.70,  0.15], // follow-through
      [1.00,  0.17],
    ])
    bodyLean = lean
  } else if (phase === 'idle') {
    bodyLean = Math.sin(idleT * 0.9) * 0.03
  } else if (phase === 'done' && !scored) {
    bodyLean = 0.18
  }

  // Kicking leg keyframes: [t, kneeX, kneeY, footX, footY] (offsets from nx, baseY)
  let kickKX = 8, kickKY = -20, kickFX = 8, kickFY = 0
  if (phase === 'fly') {
    ;[kickKX, kickKY, kickFX, kickFY] = kf(t, [
      [0.00,   8, -20,   8,   0],  // standing
      [0.18,   4, -14,  -9, -20],  // wind-up back
      [0.38,  22,  -6,  34,  -2],  // impact forward
      [0.60,  14, -28,  22, -52],  // follow-through
      [1.00,  10, -36,  16, -62],  // full extension up
    ])
  } else if (phase === 'idle') {
    kickKX = 8 + Math.sin(idleT * 1.3) * 2
    kickKY = -20 + Math.abs(Math.sin(idleT * 1.3)) * 1
    kickFX = 8 + Math.sin(idleT * 1.3) * 1.5
    kickFY = 0 + Math.abs(Math.sin(idleT * 2.6)) * 2
  } else if (phase === 'done' && scored) {
    // Celebration: both legs raised slightly
    kickKX = 14; kickKY = -25; kickFX = 22; kickFY = -48
  } else if (phase === 'done' && !scored) {
    kickKX = 8; kickKY = -20; kickFX = 8; kickFY = 0
  }

  // Plant leg (left): stable with slight variation
  let plantKX = -8, plantKY = -20, plantFX = -9, plantFY = 0
  if (phase === 'fly') {
    const [pkx, pky, pfx, pfy] = kf(t, [
      [0.00, -8, -20, -9, 0],
      [0.18, -10, -18, -11, 0],
      [0.38, -10, -18, -11, 0],
      [1.00, -10, -20, -11, 0],
    ])
    plantKX = pkx; plantKY = pky; plantFX = pfx; plantFY = pfy
  } else if (phase === 'done' && scored) {
    plantKX = -12; plantKY = -22; plantFX = -14; plantFY = -42 // legs up celebrate
  }

  const by = baseY - bodyLift
  const tx2 = nx  // body x stays centered

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.beginPath(); ctx.ellipse(nx, baseY + 2, (20 - bodyLift * 0.3) * CHAR_SCALE, (5 - bodyLift * 0.15) * CHAR_SCALE, 0, 0, Math.PI * 2); ctx.fill()

  // --- Draw character body with lean transform ---
  ctx.save()
  ctx.translate(tx2, by)
  ctx.rotate(bodyLean)
  ctx.scale(CHAR_SCALE, CHAR_SCALE)

  // Plant leg (left) - thigh + shin
  ctx.strokeStyle = '#1e3a8a'; ctx.lineWidth = 11; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-6, -32) // hip
  ctx.quadraticCurveTo(plantKX - 2, plantKY - 2, plantKX, plantKY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(plantKX, plantKY)
  ctx.quadraticCurveTo(plantFX - 2, (plantKY + plantFY) / 2 + 3, plantFX, plantFY)
  ctx.stroke()
  // shin guard
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(plantKX - 1, plantKY + 2); ctx.lineTo(plantFX - 1, (plantKY + plantFY * 2) / 3); ctx.stroke()
  // Plant boot
  ctx.fillStyle = '#111827'
  ctx.beginPath(); ctx.ellipse(plantFX - 2, plantFY + 4, 11, 5, -0.15, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.beginPath(); ctx.ellipse(plantFX - 4, plantFY + 2, 6, 2.5, -0.15, 0, Math.PI * 2); ctx.fill()

  // Kicking leg (right)
  ctx.strokeStyle = '#1e3a8a'; ctx.lineWidth = 11; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(6, -32) // hip
  ctx.quadraticCurveTo(kickKX + 3, kickKY - 2, kickKX, kickKY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(kickKX, kickKY)
  ctx.quadraticCurveTo(kickFX + 2, (kickKY + kickFY) / 2, kickFX, kickFY)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(kickKX + 1, kickKY + 2); ctx.lineTo(kickFX + 1, (kickKY + kickFY * 2) / 3); ctx.stroke()
  // Kicking boot
  const bootAngle = (phase === 'fly' && t > 0.3 && t < 0.55) ? 0.5 : 0.1
  ctx.fillStyle = '#111827'
  ctx.beginPath(); ctx.ellipse(kickFX + 3, kickFY + 4, 12, 5, bootAngle, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.beginPath(); ctx.ellipse(kickFX + 1, kickFY + 2, 6, 2.5, bootAngle, 0, Math.PI * 2); ctx.fill()

  // Shorts
  const shortsG = ctx.createLinearGradient(-15, -40, 15, -40)
  shortsG.addColorStop(0, '#1e3a8a'); shortsG.addColorStop(0.5, '#2d4fc0'); shortsG.addColorStop(1, '#1e3a8a')
  ctx.fillStyle = shortsG
  ctx.beginPath(); ctx.roundRect(-15, -46, 30, 16, [2, 2, 5, 5]); ctx.fill()

  // Arms
  let lArmX = -28, lArmY = -58  // default trailing positions
  let rArmX = 24, rArmY = -56
  if (phase === 'fly') {
    const [lax, lay, rax, ray] = kf(t, [
      [0.00, -28, -58,  24, -56],
      [0.18, -30, -52,  22, -54], // wind-up: arms back
      [0.38, -26, -62,  28, -60], // impact: arms out for balance
      [0.70, -24, -58,  20, -64],
      [1.00, -22, -55,  18, -62],
    ])
    lArmX = lax; lArmY = lay; rArmX = rax; rArmY = ray
  } else if (phase === 'done' && scored) {
    lArmX = -24; lArmY = -84  // arms up celebration
    rArmX = 24; rArmY = -84
  } else if (phase === 'done' && !scored) {
    lArmX = -20; lArmY = -54  // dejected: arms low
    rArmX = 18; rArmY = -50
  }

  ctx.strokeStyle = '#e6b800'; ctx.lineWidth = 9; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-14, -66)
  ctx.quadraticCurveTo(-24, -63, lArmX, lArmY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(14, -66)
  ctx.quadraticCurveTo(22, -63, rArmX, rArmY)
  ctx.stroke()
  // Hands
  ctx.fillStyle = '#c8856a'
  ctx.beginPath(); ctx.arc(lArmX, lArmY, 5, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(rArmX, rArmY, 5, 0, Math.PI * 2); ctx.fill()

  // Jersey body
  const jerseyG = ctx.createLinearGradient(-18, -72, 18, -72)
  jerseyG.addColorStop(0, '#c9a800'); jerseyG.addColorStop(0.3, '#FFD700')
  jerseyG.addColorStop(0.7, '#FFD700'); jerseyG.addColorStop(1, '#c9a800')
  ctx.fillStyle = jerseyG
  ctx.beginPath()
  ctx.moveTo(-17, -68)
  ctx.quadraticCurveTo(-20, -54, -16, -38); ctx.lineTo(16, -38)
  ctx.quadraticCurveTo(20, -54, 17, -68)
  ctx.quadraticCurveTo(0, -74, -17, -68)
  ctx.fill()
  // Green side stripes
  ctx.strokeStyle = '#009c3b'; ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.moveTo(-16, -66); ctx.lineTo(-15, -40); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(16, -66); ctx.lineTo(15, -40); ctx.stroke()
  // Number 10
  ctx.fillStyle = '#002776'; ctx.font = 'bold 12px Arial'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('10', 0, -55)
  // Collar
  ctx.strokeStyle = '#009c3b'; ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.arc(0, -69, 7, Math.PI + 0.3, -0.3); ctx.stroke()

  // Neck
  const neckG = ctx.createLinearGradient(-5, -80, 5, -80)
  neckG.addColorStop(0, '#b06840'); neckG.addColorStop(1, '#c8856a')
  ctx.fillStyle = neckG; ctx.beginPath(); ctx.roundRect(-5, -80, 10, 13, 3); ctx.fill()

  // Head
  const headCY = -93
  const hg = ctx.createRadialGradient(-4, headCY - 4, 3, 0, headCY, 16)
  hg.addColorStop(0, '#e8b090'); hg.addColorStop(1, '#b06840')
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, headCY, 16, 0, Math.PI * 2); ctx.fill()
  // Hair blond + roots
  ctx.fillStyle = '#d4a000'
  ctx.beginPath(); ctx.arc(0, headCY - 2, 15, Math.PI + 0.1, -0.1); ctx.fill()
  ctx.fillStyle = '#7a4000'
  ctx.beginPath(); ctx.arc(-9, headCY - 4, 7, Math.PI, 0); ctx.fill()
  ctx.beginPath(); ctx.arc(9, headCY - 4, 7, Math.PI, 0); ctx.fill()
  ctx.fillStyle = '#ffe066'
  ctx.beginPath(); ctx.ellipse(0, headCY - 14, 7, 4, 0, 0, Math.PI * 2); ctx.fill()
  // Eyebrows
  ctx.strokeStyle = '#5a2a00'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-10, headCY - 6); ctx.quadraticCurveTo(-6, headCY - 8, -2, headCY - 6); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(2, headCY - 6); ctx.quadraticCurveTo(6, headCY - 8, 10, headCY - 6); ctx.stroke()
  // Eyes
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.ellipse(-6, headCY - 1, 4, 3, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(6, headCY - 1, 4, 3, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a0800'
  ctx.beginPath(); ctx.arc(-6, headCY - 1, 2.2, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(6, headCY - 1, 2.2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.beginPath(); ctx.arc(-5, headCY - 2, 0.9, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(7, headCY - 2, 0.9, 0, Math.PI * 2); ctx.fill()
  // Nose
  ctx.strokeStyle = '#9a5030'; ctx.lineWidth = 1.3
  ctx.beginPath(); ctx.arc(0, headCY + 4, 3, 0.3, Math.PI - 0.3); ctx.stroke()
  // Mouth — expression
  ctx.strokeStyle = '#8b3820'; ctx.lineWidth = 1.8
  ctx.beginPath()
  if (phase === 'done' && scored) {
    ctx.moveTo(-6, headCY + 9); ctx.quadraticCurveTo(0, headCY + 14, 6, headCY + 9) // big smile
  } else if (phase === 'done' && !scored) {
    ctx.moveTo(-5, headCY + 11); ctx.quadraticCurveTo(0, headCY + 8, 5, headCY + 11) // frown
  } else {
    ctx.moveTo(-5, headCY + 10); ctx.quadraticCurveTo(0, headCY + 12, 5, headCY + 10) // slight smile / focused
  }
  ctx.stroke()
  // Ears
  ctx.fillStyle = '#c07848'
  ctx.beginPath(); ctx.arc(-15, headCY + 1, 4, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(15, headCY + 1, 4, 0, Math.PI * 2); ctx.fill()

  // Celebration star burst if scored
  if (phase === 'done' && scored) {
    ctx.fillStyle = 'rgba(255,220,0,0.5)'
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const r = 22 + Math.sin(idleT * 5 + i) * 4
      ctx.beginPath()
      ctx.moveTo(0, headCY - 16)
      ctx.lineTo(Math.cos(a) * r, headCY - 16 + Math.sin(a) * r)
      ctx.lineTo(Math.cos(a + 0.2) * (r * 0.5), headCY - 16 + Math.sin(a + 0.2) * (r * 0.5))
      ctx.closePath(); ctx.fill()
    }
  }

  ctx.restore()

  // NEYMAR label
  ctx.fillStyle = 'rgba(255,220,50,0.8)'; ctx.font = 'bold 8px Arial'
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.fillText('NEYMAR JR', nx, baseY + 8)
}

export default function PenaltiGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>()
  const [score, setScore] = useState({ goals: 0, shots: 0 })
  const [resultMsg, setResultMsg] = useState('')
  const [phase, setPhase] = useState<'idle' | 'fly' | 'done'>('idle')

  const G = useRef<GS>({
    phase: 'idle', t: 0,
    bx: BX0, by: BY0, bscale: 1,
    tx: W / 2, ty: (GT + GB) / 2,
    kx: W / 2, ktx: W / 2,
    hx: -1, hy: -1,
    goals: 0, shots: 0,
    scored: false, idleT: 0,
  })

  function draw() {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const g = G.current
    ctx.clearRect(0, 0, W, H)
    drawField(ctx)
    drawGoal3D(ctx)
    // hover crosshair
    if (g.phase === 'idle' && g.hx >= GL && g.hx <= GR && g.hy >= GT && g.hy <= GB) {
      ctx.fillStyle = 'rgba(255,220,0,0.1)'; ctx.fillRect(GL, GT, GW, GH)
      ctx.strokeStyle = 'rgba(255,220,0,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(g.hx, GT); ctx.lineTo(g.hx, GB)
      ctx.moveTo(GL, g.hy); ctx.lineTo(GR, g.hy)
      ctx.stroke(); ctx.setLineDash([])
      ctx.fillStyle = 'rgba(255,220,0,0.85)'
      ctx.beginPath(); ctx.arc(g.hx, g.hy, 5, 0, Math.PI * 2); ctx.fill()
    }
    drawKeeper(ctx, g.kx, g)
    drawBall(ctx, g.bx, g.by, g.bscale)
    drawNeymar(ctx, g)
    if (g.phase === 'idle') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '11px Arial'
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      ctx.fillText('👆 Clique no gol para chutar', W / 2, H - 6)
    }
  }

  useEffect(() => {
    function loop() {
      const g = G.current
      g.idleT += 0.018

      if (g.phase === 'fly') {
        g.t = Math.min(g.t + 0.022, 1)
        const p = easeOut(g.t)
        g.bx = lerp(BX0, g.tx, p)
        g.by = lerp(BY0, g.ty, p) + Math.sin(g.t * Math.PI) * -30
        g.bscale = lerp(1, 0.3, p)
        const kp = Math.min(g.t / 0.35, 1)
        g.kx = lerp(W / 2, g.ktx, easeOut(kp))

        if (g.t >= 1) {
          const KW2 = 58
          const kLeft = g.kx - KW2 / 2 - 10
          const kRight = g.kx + KW2 / 2 + 10
          const inGoal = g.tx >= GL && g.tx <= GR && g.ty >= GT && g.ty <= GB
          const blocked = g.tx >= kLeft && g.tx <= kRight
          g.scored = inGoal && !blocked
          g.goals += g.scored ? 1 : 0
          g.shots += 1
          g.phase = 'done'
          setScore({ goals: g.goals, shots: g.shots })
          setResultMsg(g.scored ? '⚽ GOOOL!' : '🧤 DEFENDEU!')
          setPhase('done')
          setTimeout(() => {
            g.phase = 'idle'; g.bx = BX0; g.by = BY0; g.bscale = 1
            g.kx = W / 2; g.t = 0; g.scored = false
            setResultMsg(''); setPhase('idle')
            draw()
          }, 2400)
        }
      }

      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  function getCanvasPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const sx = W / rect.width, sy = H / rect.height
    const client = 'touches' in e ? e.touches[0] : e
    return { cx: (client.clientX - rect.left) * sx, cy: (client.clientY - rect.top) * sy }
  }

  function handleClick(e: React.MouseEvent | React.TouchEvent) {
    if ('touches' in e) e.preventDefault()
    const g = G.current
    if (g.phase !== 'idle') return
    const { cx, cy } = getCanvasPos(e)
    if (cx < GL || cx > GR || cy < GT || cy > GB) return
    const keeperTargets = [GL + GW * 0.17, W / 2, GL + GW * 0.83]
    g.tx = cx; g.ty = cy
    g.ktx = keeperTargets[Math.floor(Math.random() * 3)]
    g.phase = 'fly'; g.t = 0
    setPhase('fly')
  }

  function handleMouseMove(e: React.MouseEvent) {
    const g = G.current; if (g.phase !== 'idle') return
    const { cx, cy } = getCanvasPos(e)
    g.hx = cx; g.hy = cy
  }

  function handleMouseLeave() {
    G.current.hx = -1; G.current.hy = -1
  }

  const isGoal = resultMsg.includes('GOL')

  return (
    <div className="pg-wrap">
      <div className="pg-header">
        <span className="pg-title">⚽ Bata um pênalti!</span>
        {score.shots > 0 && (
          <span className="pg-score">{score.goals} gol{score.goals !== 1 ? 's' : ''} / {score.shots} chute{score.shots !== 1 ? 's' : ''}</span>
        )}
      </div>
      <div style={{ position: 'relative', width: '100%' }}>
        <canvas
          ref={canvasRef} width={W} height={H}
          style={{ width: '100%', height: 'auto', borderRadius: 14, display: 'block', cursor: phase === 'idle' ? 'crosshair' : 'default' }}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleClick}
        />
        {resultMsg && (
          <div style={{
            position: 'absolute', top: '42%', left: '50%',
            transform: 'translate(-50%,-50%)',
            background: isGoal ? 'rgba(255,215,0,0.96)' : 'rgba(185,28,28,0.92)',
            color: isGoal ? '#003d00' : '#fff',
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(1.8rem, 6vw, 2.4rem)',
            letterSpacing: 4, padding: '10px 30px', borderRadius: 14,
            pointerEvents: 'none',
            animation: 'popIn .3s cubic-bezier(.34,1.56,.64,1)',
            whiteSpace: 'nowrap',
            boxShadow: isGoal ? '0 8px 32px rgba(255,215,0,0.4)' : '0 8px 32px rgba(185,28,28,0.4)',
          }}>
            {resultMsg}
          </div>
        )}
      </div>
    </div>
  )
}
