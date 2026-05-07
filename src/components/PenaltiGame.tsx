import { useEffect, useRef, useState } from 'react'

// Canvas dimensions
const W = 440
const H = 320

// Goal geometry (screen coords)
const GL = 90    // left post x
const GR = 350   // right post x
const GT = 38    // crossbar y
const GB = 130   // goal bottom y
const GW = GR - GL
const GH = GB - GT

// Ball start (penalty spot)
const BX0 = W / 2
const BY0 = H - 44

// Keeper width
const KW = 58

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function easeOut(t: number) { return 1 - (1 - t) ** 2.5 }
function easeOutBack(t: number) { const c1 = 1.4; return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2 }

function drawField(ctx: CanvasRenderingContext2D) {
  // Sky/background
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#1a3d1a')
  bg.addColorStop(1, '#0f2a0f')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Grass stripes
  for (let i = 0; i < 8; i++) {
    const y1 = GB + (H - GB) * (i / 8)
    const y2 = GB + (H - GB) * ((i + 0.5) / 8)
    ctx.fillStyle = 'rgba(0,0,0,0.07)'
    ctx.fillRect(0, y1, W, y2 - y1)
  }

  // Penalty area (perspective trapezoid)
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(10, H - 10)
  ctx.lineTo(GL - 10, GB)
  ctx.moveTo(W - 10, H - 10)
  ctx.lineTo(GR + 10, GB)
  ctx.moveTo(10, H - 10)
  ctx.lineTo(W - 10, H - 10)
  ctx.stroke()
  ctx.setLineDash([])

  // Center line of field (from camera to goal)
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(W / 2, H)
  ctx.lineTo(W / 2, GB)
  ctx.stroke()

  // Penalty spot
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.arc(W / 2, BY0 - 6, 4, 0, Math.PI * 2)
  ctx.fill()
}

function drawGoal3D(ctx: CanvasRenderingContext2D) {
  const DEPTH = 28
  const vx = W / 2, vy = 5

  // Project back corners
  function proj(px: number, py: number) {
    const t = DEPTH / (H - vy)
    return { x: px + (vx - px) * t, y: py + (vy - py) * t }
  }

  const bTL = proj(GL, GT), bTR = proj(GR, GT)
  const bBL = proj(GL, GB), bBR = proj(GR, GB)

  // Back net fill
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  ctx.beginPath()
  ctx.moveTo(bTL.x, bTL.y); ctx.lineTo(bTR.x, bTR.y)
  ctx.lineTo(bBR.x, bBR.y); ctx.lineTo(bBL.x, bBL.y)
  ctx.closePath(); ctx.fill()

  // Side walls
  ctx.fillStyle = 'rgba(255,255,255,0.03)'
  ctx.beginPath()
  ctx.moveTo(GL, GT); ctx.lineTo(bTL.x, bTL.y)
  ctx.lineTo(bBL.x, bBL.y); ctx.lineTo(GL, GB); ctx.closePath(); ctx.fill()

  ctx.beginPath()
  ctx.moveTo(GR, GT); ctx.lineTo(bTR.x, bTR.y)
  ctx.lineTo(bBR.x, bBR.y); ctx.lineTo(GR, GB); ctx.closePath(); ctx.fill()

  // Net grid — front face
  ctx.strokeStyle = 'rgba(255,255,255,0.13)'
  ctx.lineWidth = 0.8
  ctx.setLineDash([])
  for (let x = GL; x <= GR; x += 18) {
    ctx.beginPath(); ctx.moveTo(x, GT); ctx.lineTo(x, GB); ctx.stroke()
  }
  for (let y = GT; y <= GB; y += 14) {
    ctx.beginPath(); ctx.moveTo(GL, y); ctx.lineTo(GR, y); ctx.stroke()
  }

  // Depth lines
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(GL, GT); ctx.lineTo(bTL.x, bTL.y); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(GR, GT); ctx.lineTo(bTR.x, bTR.y); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(GL, GB); ctx.lineTo(bBL.x, bBL.y); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(GR, GB); ctx.lineTo(bBR.x, bBR.y); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(bTL.x, bTL.y); ctx.lineTo(bTR.x, bTR.y); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(bBL.x, bBL.y); ctx.lineTo(bBR.x, bBR.y); ctx.stroke()

  // Posts (thick white)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  // Left post
  ctx.beginPath(); ctx.moveTo(GL, GT); ctx.lineTo(GL, GB); ctx.stroke()
  // Right post
  ctx.beginPath(); ctx.moveTo(GR, GT); ctx.lineTo(GR, GB); ctx.stroke()
  // Crossbar
  ctx.beginPath(); ctx.moveTo(GL, GT); ctx.lineTo(GR, GT); ctx.stroke()
  // Ground line
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(GL, GB); ctx.lineTo(GR, GB); ctx.stroke()

  // Post shadows
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(GL + 4, GT + 4); ctx.lineTo(GL + 4, GB); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(GR - 4, GT + 4); ctx.lineTo(GR - 4, GB); ctx.stroke()
}

function drawKeeper(ctx: CanvasRenderingContext2D, kx: number) {
  const headY = GT + 13
  const torsoT = headY + 14
  const torsoH = 36
  const torsoB = torsoT + torsoH
  const midTorso = torsoT + torsoH * 0.42

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath()
  ctx.ellipse(kx, GB - 3, 26, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  // --- Left arm ---
  ctx.save()
  ctx.strokeStyle = '#dc2626'
  ctx.lineWidth = 10
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(kx - 12, torsoT + 6)
  ctx.quadraticCurveTo(kx - 32, midTorso - 4, kx - 46, midTorso + 2)
  ctx.stroke()
  // forearm sleeve white stripe
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(kx - 28, midTorso - 2)
  ctx.lineTo(kx - 46, midTorso + 2)
  ctx.stroke()
  ctx.restore()

  // --- Right arm ---
  ctx.save()
  ctx.strokeStyle = '#dc2626'
  ctx.lineWidth = 10
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(kx + 12, torsoT + 6)
  ctx.quadraticCurveTo(kx + 32, midTorso - 4, kx + 46, midTorso + 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(kx + 28, midTorso - 2)
  ctx.lineTo(kx + 46, midTorso + 2)
  ctx.stroke()
  ctx.restore()

  // Left glove
  ctx.save()
  const gloveG1 = ctx.createRadialGradient(kx - 47, midTorso, 2, kx - 47, midTorso, 11)
  gloveG1.addColorStop(0, '#fde68a')
  gloveG1.addColorStop(1, '#d97706')
  ctx.fillStyle = gloveG1
  ctx.beginPath(); ctx.arc(kx - 47, midTorso, 10, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(kx - 47, midTorso, 10, 0, Math.PI * 2); ctx.stroke()
  // finger lines
  ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1.2
  for (let f = -1; f <= 1; f++) {
    ctx.beginPath()
    ctx.moveTo(kx - 47 + f * 3, midTorso - 6)
    ctx.lineTo(kx - 47 + f * 3, midTorso - 10)
    ctx.stroke()
  }
  ctx.restore()

  // Right glove
  ctx.save()
  const gloveG2 = ctx.createRadialGradient(kx + 47, midTorso, 2, kx + 47, midTorso, 11)
  gloveG2.addColorStop(0, '#fde68a')
  gloveG2.addColorStop(1, '#d97706')
  ctx.fillStyle = gloveG2
  ctx.beginPath(); ctx.arc(kx + 47, midTorso, 10, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(kx + 47, midTorso, 10, 0, Math.PI * 2); ctx.stroke()
  for (let f = -1; f <= 1; f++) {
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(kx + 47 + f * 3, midTorso - 6)
    ctx.lineTo(kx + 47 + f * 3, midTorso - 10)
    ctx.stroke()
  }
  ctx.restore()

  // Shorts
  ctx.fillStyle = '#1e1b4b'
  ctx.beginPath()
  ctx.roundRect(kx - 14, torsoB - 2, 28, 18, [0, 0, 5, 5])
  ctx.fill()

  // Left leg
  ctx.save()
  ctx.strokeStyle = '#1e1b4b'
  ctx.lineWidth = 11
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(kx - 7, torsoB + 14)
  ctx.lineTo(kx - 8, torsoB + 28)
  ctx.stroke()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(kx - 8, torsoB + 24)
  ctx.lineTo(kx - 8, torsoB + 28)
  ctx.stroke()
  ctx.restore()

  // Right leg
  ctx.save()
  ctx.strokeStyle = '#1e1b4b'
  ctx.lineWidth = 11
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(kx + 7, torsoB + 14)
  ctx.lineTo(kx + 8, torsoB + 28)
  ctx.stroke()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(kx + 8, torsoB + 24)
  ctx.lineTo(kx + 8, torsoB + 28)
  ctx.stroke()
  ctx.restore()

  // Boots
  ctx.fillStyle = '#111'
  ctx.beginPath(); ctx.ellipse(kx - 8, torsoB + 30, 9, 5, -0.15, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(kx + 8, torsoB + 30, 9, 5, 0.15, 0, Math.PI * 2); ctx.fill()

  // Torso / Jersey body
  const jerseyG = ctx.createLinearGradient(kx - 20, torsoT, kx + 20, torsoT)
  jerseyG.addColorStop(0, '#9b1c1c')
  jerseyG.addColorStop(0.35, '#ef4444')
  jerseyG.addColorStop(0.65, '#ef4444')
  jerseyG.addColorStop(1, '#9b1c1c')
  ctx.fillStyle = jerseyG
  ctx.beginPath()
  ctx.moveTo(kx - 20, torsoT + 4)
  ctx.quadraticCurveTo(kx - 22, torsoT + torsoH / 2, kx - 18, torsoB)
  ctx.lineTo(kx + 18, torsoB)
  ctx.quadraticCurveTo(kx + 22, torsoT + torsoH / 2, kx + 20, torsoT + 4)
  ctx.quadraticCurveTo(kx, torsoT - 2, kx - 20, torsoT + 4)
  ctx.fill()

  // Jersey number 1
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = 'bold 13px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('1', kx, midTorso + 4)

  // Collar
  ctx.strokeStyle = '#fbbf24'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(kx, torsoT + 1, 7, Math.PI + 0.4, -0.4)
  ctx.stroke()

  // Neck
  const neckG = ctx.createLinearGradient(kx - 5, headY - 8, kx + 5, headY - 8)
  neckG.addColorStop(0, '#c07848')
  neckG.addColorStop(1, '#d4956a')
  ctx.fillStyle = neckG
  ctx.beginPath()
  ctx.roundRect(kx - 5, headY - 8, 10, 12, 3)
  ctx.fill()

  // Head
  const headG = ctx.createRadialGradient(kx - 3, headY - 5, 3, kx, headY, 14)
  headG.addColorStop(0, '#e8b090')
  headG.addColorStop(1, '#c07848')
  ctx.fillStyle = headG
  ctx.beginPath(); ctx.arc(kx, headY, 14, 0, Math.PI * 2); ctx.fill()

  // Hair (dark, cropped)
  ctx.fillStyle = '#2d1200'
  ctx.beginPath()
  ctx.arc(kx, headY - 2, 13, Math.PI + 0.15, -0.15)
  ctx.fill()
  // hair highlight
  ctx.fillStyle = '#4a2000'
  ctx.beginPath()
  ctx.arc(kx - 3, headY - 12, 6, Math.PI, 0)
  ctx.fill()

  // Eyebrows
  ctx.strokeStyle = '#2d1200'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(kx - 9, headY - 5); ctx.lineTo(kx - 4, headY - 6); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(kx + 4, headY - 6); ctx.lineTo(kx + 9, headY - 5); ctx.stroke()

  // Eyes
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.ellipse(kx - 5, headY - 1, 3.5, 3, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(kx + 5, headY - 1, 3.5, 3, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a0800'
  ctx.beginPath(); ctx.arc(kx - 5, headY - 1, 2, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(kx + 5, headY - 1, 2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.beginPath(); ctx.arc(kx - 4, headY - 2, 0.8, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(kx + 6, headY - 2, 0.8, 0, Math.PI * 2); ctx.fill()

  // Nose
  ctx.strokeStyle = '#a06040'
  ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.arc(kx, headY + 3, 2.5, 0.3, Math.PI - 0.3); ctx.stroke()

  // Mouth (focused expression)
  ctx.strokeStyle = '#8b4020'
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(kx - 4, headY + 7); ctx.lineTo(kx + 4, headY + 7); ctx.stroke()
}

function drawNeymar(ctx: CanvasRenderingContext2D) {
  const nx = BX0
  // Anchor at penalty spot - character stands just above it
  const footY = BY0 + 20

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.beginPath()
  ctx.ellipse(nx, footY + 2, 20, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  // --- Left leg (planted, slight bend) ---
  ctx.save()
  ctx.strokeStyle = '#1e3a8a'
  ctx.lineWidth = 11
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(nx - 6, footY - 22)
  ctx.quadraticCurveTo(nx - 10, footY - 10, nx - 9, footY)
  ctx.stroke()
  // shin guard highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(nx - 10, footY - 18)
  ctx.lineTo(nx - 10, footY - 8)
  ctx.stroke()
  ctx.restore()

  // Left boot
  ctx.save()
  ctx.fillStyle = '#111827'
  ctx.beginPath(); ctx.ellipse(nx - 10, footY + 3, 11, 5, -0.1, 0, Math.PI * 2); ctx.fill()
  // boot highlight
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath(); ctx.ellipse(nx - 12, footY + 1, 6, 2.5, -0.2, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // --- Right leg (kicking, raised forward and up) ---
  ctx.save()
  ctx.strokeStyle = '#1e3a8a'
  ctx.lineWidth = 11
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(nx + 6, footY - 22)
  ctx.quadraticCurveTo(nx + 18, footY - 14, nx + 26, footY - 6)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(nx + 14, footY - 16)
  ctx.lineTo(nx + 22, footY - 9)
  ctx.stroke()
  ctx.restore()

  // Right boot (kicking)
  ctx.save()
  ctx.fillStyle = '#111827'
  ctx.beginPath(); ctx.ellipse(nx + 30, footY - 5, 11, 5, 0.6, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath(); ctx.ellipse(nx + 28, footY - 7, 5, 2.5, 0.5, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Shorts
  ctx.save()
  const shortsG = ctx.createLinearGradient(nx - 15, footY - 30, nx + 15, footY - 30)
  shortsG.addColorStop(0, '#1e3a8a')
  shortsG.addColorStop(0.5, '#2d4fc0')
  shortsG.addColorStop(1, '#1e3a8a')
  ctx.fillStyle = shortsG
  ctx.beginPath()
  ctx.roundRect(nx - 15, footY - 32, 30, 14, [2, 2, 5, 5])
  ctx.fill()
  ctx.restore()

  // --- Left arm (back, for balance) ---
  ctx.save()
  ctx.strokeStyle = '#e6b800'
  ctx.lineWidth = 9
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(nx - 13, footY - 56)
  ctx.quadraticCurveTo(nx - 28, footY - 48, nx - 30, footY - 38)
  ctx.stroke()
  ctx.restore()

  // --- Right arm (forward, for kick balance) ---
  ctx.save()
  ctx.strokeStyle = '#e6b800'
  ctx.lineWidth = 9
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(nx + 13, footY - 56)
  ctx.quadraticCurveTo(nx + 22, footY - 46, nx + 18, footY - 36)
  ctx.stroke()
  ctx.restore()

  // Torso / Jersey
  const jerseyG = ctx.createLinearGradient(nx - 18, footY - 72, nx + 18, footY - 72)
  jerseyG.addColorStop(0, '#c9a800')
  jerseyG.addColorStop(0.3, '#FFD700')
  jerseyG.addColorStop(0.7, '#FFD700')
  jerseyG.addColorStop(1, '#c9a800')
  ctx.fillStyle = jerseyG
  ctx.beginPath()
  ctx.moveTo(nx - 17, footY - 68)
  ctx.quadraticCurveTo(nx - 20, footY - 50, nx - 16, footY - 34)
  ctx.lineTo(nx + 16, footY - 34)
  ctx.quadraticCurveTo(nx + 20, footY - 50, nx + 17, footY - 68)
  ctx.quadraticCurveTo(nx, footY - 74, nx - 17, footY - 68)
  ctx.fill()

  // Jersey green side stripes
  ctx.strokeStyle = '#009c3b'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(nx - 16, footY - 66); ctx.lineTo(nx - 15, footY - 36)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(nx + 16, footY - 66); ctx.lineTo(nx + 15, footY - 36)
  ctx.stroke()

  // Number 10
  ctx.fillStyle = '#002776'
  ctx.font = 'bold 12px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('10', nx, footY - 52)

  // Collar
  ctx.strokeStyle = '#009c3b'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(nx, footY - 69, 7, Math.PI + 0.3, -0.3)
  ctx.stroke()

  // Neck
  const neckG = ctx.createLinearGradient(nx - 5, footY - 82, nx + 5, footY - 82)
  neckG.addColorStop(0, '#b06840')
  neckG.addColorStop(1, '#c8856a')
  ctx.fillStyle = neckG
  ctx.beginPath()
  ctx.roundRect(nx - 5, footY - 82, 10, 14, 3)
  ctx.fill()

  // Head
  const headCy = footY - 96
  const headG = ctx.createRadialGradient(nx - 4, headCy - 4, 3, nx, headCy, 16)
  headG.addColorStop(0, '#e8b090')
  headG.addColorStop(1, '#b06840')
  ctx.fillStyle = headG
  ctx.beginPath(); ctx.arc(nx, headCy, 16, 0, Math.PI * 2); ctx.fill()

  // Hair - Neymar blond mohawk / styled
  ctx.fillStyle = '#d4a000'
  ctx.beginPath()
  ctx.arc(nx, headCy - 4, 15, Math.PI + 0.1, -0.1)
  ctx.fill()
  // Darker roots at sides
  ctx.fillStyle = '#7a4000'
  ctx.beginPath()
  ctx.arc(nx - 10, headCy - 4, 7, Math.PI, 0)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(nx + 10, headCy - 4, 7, Math.PI, 0)
  ctx.fill()
  // Blond top highlight
  ctx.fillStyle = '#ffe066'
  ctx.beginPath()
  ctx.ellipse(nx, headCy - 14, 7, 4, 0, 0, Math.PI * 2)
  ctx.fill()

  // Eyebrows (thick, Brazilian)
  ctx.strokeStyle = '#5a2a00'
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(nx - 10, headCy - 6); ctx.quadraticCurveTo(nx - 6, headCy - 8, nx - 2, headCy - 6); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(nx + 2, headCy - 6); ctx.quadraticCurveTo(nx + 6, headCy - 8, nx + 10, headCy - 6); ctx.stroke()

  // Eyes
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.ellipse(nx - 6, headCy - 1, 4, 3, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(nx + 6, headCy - 1, 4, 3, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a0800'
  ctx.beginPath(); ctx.arc(nx - 6, headCy - 1, 2.2, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(nx + 6, headCy - 1, 2.2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.beginPath(); ctx.arc(nx - 5, headCy - 2, 0.9, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(nx + 7, headCy - 2, 0.9, 0, Math.PI * 2); ctx.fill()

  // Nose
  ctx.strokeStyle = '#9a5030'
  ctx.lineWidth = 1.3
  ctx.beginPath(); ctx.arc(nx, headCy + 4, 3, 0.3, Math.PI - 0.3); ctx.stroke()

  // Smile / determined mouth
  ctx.strokeStyle = '#8b3820'
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(nx - 5, headCy + 9)
  ctx.quadraticCurveTo(nx, headCy + 11, nx + 5, headCy + 9)
  ctx.stroke()

  // Ear
  ctx.fillStyle = '#c07848'
  ctx.beginPath(); ctx.arc(nx - 15, headCy + 1, 4, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(nx + 15, headCy + 1, 4, 0, Math.PI * 2); ctx.fill()

  // NEYMAR label
  ctx.fillStyle = 'rgba(255,220,50,0.8)'
  ctx.font = 'bold 8px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('NEYMAR JR', nx, footY + 8)
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const r = 16 * scale

  // Shadow on ground (only when near ground)
  if (scale > 0.6) {
    const shadowScale = (scale - 0.6) / 0.4
    ctx.fillStyle = `rgba(0,0,0,${0.2 * shadowScale})`
    ctx.beginPath()
    ctx.ellipse(x, BY0 + 20, r * 1.2 * shadowScale, r * 0.3 * shadowScale, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Ball body
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()

  // Pentagon patches
  ctx.fillStyle = '#1a1a1a'
  const patches = [
    [0, 0], [0.6, -0.5], [-0.6, -0.5], [0.6, 0.5], [-0.6, 0.5]
  ]
  for (const [px, py] of patches) {
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI / 5) - Math.PI / 2
      const bx = x + (px * r * 0.55) + Math.cos(angle) * r * 0.28
      const by = y + (py * r * 0.55) + Math.sin(angle) * r * 0.28
      i === 0 ? ctx.moveTo(bx, by) : ctx.lineTo(bx, by)
    }
    ctx.closePath(); ctx.fill()
  }

  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.25, 0, Math.PI * 2); ctx.fill()

  // Outline
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
}

export default function PenaltiGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>()
  const [score, setScore] = useState({ goals: 0, shots: 0 })
  const [resultMsg, setResultMsg] = useState('')
  const [phase, setPhase] = useState<'idle' | 'fly' | 'done'>('idle')

  const G = useRef({
    phase: 'idle' as 'idle' | 'fly' | 'done',
    t: 0,
    bx: BX0, by: BY0, bscale: 1,
    tx: W / 2, ty: (GT + GB) / 2,
    kx: W / 2, ktx: W / 2,
    hx: -1, hy: -1,
    goals: 0, shots: 0,
  })

  function draw() {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const g = G.current
    ctx.clearRect(0, 0, W, H)
    drawField(ctx)
    drawGoal3D(ctx)

    // Hover highlight on goal
    if (g.phase === 'idle' && g.hx >= GL && g.hx <= GR && g.hy >= GT && g.hy <= GB) {
      ctx.fillStyle = 'rgba(255,220,0,0.1)'
      ctx.fillRect(GL, GT, GW, GH)
      ctx.strokeStyle = 'rgba(255,220,0,0.55)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(g.hx, GT); ctx.lineTo(g.hx, GB)
      ctx.moveTo(GL, g.hy); ctx.lineTo(GR, g.hy)
      ctx.stroke()
      ctx.setLineDash([])
      // Target dot
      ctx.fillStyle = 'rgba(255,220,0,0.8)'
      ctx.beginPath(); ctx.arc(g.hx, g.hy, 5, 0, Math.PI * 2); ctx.fill()
    }

    drawKeeper(ctx, g.kx)
    drawBall(ctx, g.bx, g.by, g.bscale)
    drawNeymar(ctx)

    // Hint
    if (g.phase === 'idle') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.font = '11px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText('👆 Clique no gol para chutar', W / 2, H - 6)
    }
  }

  function animate() {
    const g = G.current
    if (g.phase !== 'fly') return
    g.t = Math.min(g.t + 0.022, 1)
    const p = easeOut(g.t)

    // Ball arc trajectory
    g.bx = lerp(BX0, g.tx, p)
    const arc = Math.sin(g.t * Math.PI) * -30
    g.by = lerp(BY0, g.ty, p) + arc
    g.bscale = lerp(1, 0.3, p)

    // Keeper dives fast at start
    const kp = Math.min(g.t / 0.35, 1)
    g.kx = lerp(W / 2, g.ktx, easeOut(kp))

    draw()

    if (g.t < 1) {
      rafRef.current = requestAnimationFrame(animate)
    } else {
      // Check if goal
      const kLeft = g.kx - KW / 2 - 10
      const kRight = g.kx + KW / 2 + 10
      const inGoal = g.tx >= GL && g.tx <= GR && g.ty >= GT && g.ty <= GB
      const blocked = g.tx >= kLeft && g.tx <= kRight
      const scored = inGoal && !blocked

      g.goals += scored ? 1 : 0
      g.shots += 1
      g.phase = 'done'
      setScore({ goals: g.goals, shots: g.shots })
      setResultMsg(scored ? '⚽ GOOOL!' : '🧤 DEFENDEU!')
      setPhase('done')

      setTimeout(() => {
        g.phase = 'idle'; g.bx = BX0; g.by = BY0; g.bscale = 1
        g.kx = W / 2; g.t = 0
        setResultMsg(''); setPhase('idle')
        draw()
      }, 2200)
    }
  }

  useEffect(() => { draw() }, [])

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
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(animate)
  }

  function handleMouseMove(e: React.MouseEvent) {
    const g = G.current; if (g.phase !== 'idle') return
    const { cx, cy } = getCanvasPos(e)
    g.hx = cx; g.hy = cy; draw()
  }

  function handleMouseLeave() {
    G.current.hx = -1; G.current.hy = -1; draw()
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
          ref={canvasRef}
          width={W} height={H}
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
            letterSpacing: 4,
            padding: '10px 30px',
            borderRadius: 14,
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
