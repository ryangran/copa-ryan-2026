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
  const ky = GT + GH * 0.5

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.ellipse(kx, GB - 4, KW / 2, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  // Body (jersey)
  const bodyGrad = ctx.createLinearGradient(kx - KW/2, 0, kx + KW/2, 0)
  bodyGrad.addColorStop(0, '#b91c1c')
  bodyGrad.addColorStop(0.5, '#ef4444')
  bodyGrad.addColorStop(1, '#b91c1c')
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.roundRect(kx - KW/2, GT + 18, KW, GH - 24, 4)
  ctx.fill()

  // Arms stretched out
  ctx.fillStyle = '#ef4444'
  ctx.fillRect(kx - KW/2 - 14, ky - 6, 16, 12)
  ctx.fillRect(kx + KW/2 - 2, ky - 6, 16, 12)

  // Gloves
  ctx.fillStyle = '#facc15'
  ctx.beginPath(); ctx.arc(kx - KW/2 - 14, ky, 9, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(kx + KW/2 + 14, ky, 9, 0, Math.PI * 2); ctx.fill()

  // Head
  ctx.fillStyle = '#d4956a'
  ctx.beginPath(); ctx.arc(kx, GT + 10, 12, 0, Math.PI * 2); ctx.fill()
  // Hair
  ctx.fillStyle = '#3d1a00'
  ctx.beginPath(); ctx.arc(kx, GT + 6, 10, Math.PI, 0); ctx.fill()

  // Number
  ctx.fillStyle = 'white'
  ctx.font = 'bold 11px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('1', kx, ky)
}

function drawNeymar(ctx: CanvasRenderingContext2D) {
  const nx = BX0, ny = BY0

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath(); ctx.ellipse(nx, ny + 36, 16, 5, 0, 0, Math.PI * 2); ctx.fill()

  // Legs
  ctx.fillStyle = '#1e3a6e'
  ctx.fillRect(nx - 12, ny + 18, 10, 18)
  ctx.fillRect(nx + 2, ny + 18, 10, 18)
  // Boots
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(nx - 14, ny + 32, 13, 6)
  ctx.fillRect(nx + 1, ny + 32, 13, 6)

  // Body (Brazil yellow)
  const bodyG = ctx.createLinearGradient(nx - 14, 0, nx + 14, 0)
  bodyG.addColorStop(0, '#ca9f00')
  bodyG.addColorStop(0.5, '#FFD700')
  bodyG.addColorStop(1, '#ca9f00')
  ctx.fillStyle = bodyG
  ctx.beginPath(); ctx.roundRect(nx - 14, ny, 28, 20, 3); ctx.fill()

  // Green collar
  ctx.strokeStyle = '#009c3b'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(nx, ny + 2, 6, 0, Math.PI); ctx.stroke()

  // Number 10
  ctx.fillStyle = '#002776'
  ctx.font = 'bold 9px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('10', nx, ny + 10)

  // Arms
  ctx.fillStyle = '#FFD700'
  ctx.fillRect(nx - 22, ny + 2, 10, 8)
  ctx.fillRect(nx + 12, ny + 2, 10, 8)

  // Head
  ctx.fillStyle = '#c8856a'
  ctx.beginPath(); ctx.arc(nx, ny - 12, 13, 0, Math.PI * 2); ctx.fill()

  // Hair (Neymar style)
  ctx.fillStyle = '#f5d020'
  ctx.beginPath(); ctx.arc(nx, ny - 19, 9, Math.PI, 0); ctx.fill()
  ctx.fillStyle = '#1a0a00'
  ctx.beginPath(); ctx.arc(nx - 4, ny - 20, 5, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(nx + 4, ny - 20, 5, 0, Math.PI * 2); ctx.fill()

  // Eyes
  ctx.fillStyle = '#1a0a00'
  ctx.beginPath(); ctx.arc(nx - 4, ny - 12, 2, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(nx + 4, ny - 12, 2, 0, Math.PI * 2); ctx.fill()

  // Label
  ctx.fillStyle = 'rgba(255,215,0,0.65)'
  ctx.font = 'bold 7px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('NEYMAR', nx, ny + 40)
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
