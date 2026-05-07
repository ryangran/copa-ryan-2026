import { useState } from 'react'

type Zone = 'L' | 'C' | 'R'
type Phase = 'idle' | 'fly' | 'done'

const BALL_TARGET: Record<Zone, { left: string; top: string }> = {
  L: { left: '16%', top: '14%' },
  C: { left: '50%', top: '11%' },
  R: { left: '84%', top: '14%' },
}
const KEEPER_LEFT: Record<Zone, string> = { L: '8%', C: '42%', R: '72%' }

export default function PenaltiGame() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [shotZone, setShotZone] = useState<Zone>('C')
  const [keepZone, setKeepZone] = useState<Zone>('C')
  const [gol, setGol] = useState(false)
  const [score, setScore] = useState({ goals: 0, shots: 0 })

  function kick(zone: Zone) {
    if (phase !== 'idle') return
    const zones: Zone[] = ['L', 'C', 'R']
    const keeper = zones[Math.floor(Math.random() * 3)]
    setShotZone(zone)
    setKeepZone(keeper)
    setPhase('fly')

    setTimeout(() => {
      const scored = zone !== keeper
      setGol(scored)
      setScore(s => ({ goals: s.goals + (scored ? 1 : 0), shots: s.shots + 1 }))
      setPhase('done')
      setTimeout(() => { setPhase('idle'); setKeepZone('C') }, 2200)
    }, 750)
  }

  const ballPos = phase !== 'idle'
    ? { ...BALL_TARGET[shotZone], transition: 'all 0.75s cubic-bezier(0.15,0,0.5,1)', transform: 'scale(0.55)' }
    : { left: '50%', top: '76%', transition: 'none', transform: 'scale(1)' }

  return (
    <div className="pg-wrap">
      <div className="pg-header">
        <span className="pg-title">⚽ Bata um pênalti!</span>
        {score.shots > 0 && (
          <span className="pg-score">{score.goals} gol{score.goals !== 1 ? 's' : ''} em {score.shots} chute{score.shots !== 1 ? 's' : ''}</span>
        )}
      </div>

      <div className="pg-field">
        {/* Linha do gol */}
        <div className="pg-goal-line" />
        {/* Traves */}
        <div className="pg-post left" />
        <div className="pg-post right" />
        {/* Rede */}
        <div className="pg-net" />

        {/* Zona de chute */}
        {phase === 'idle' && (
          <div className="pg-zones">
            {(['L','C','R'] as Zone[]).map((z, i) => (
              <button key={z} className="pg-zone-btn" onClick={() => kick(z)}>
                {['◄','▲','►'][i]}
              </button>
            ))}
          </div>
        )}

        {/* Goleiro */}
        <div
          className="pg-keeper"
          style={{
            left: KEEPER_LEFT[keepZone],
            transition: phase === 'fly' ? 'left 0.35s ease-out' : 'left 0.15s',
          }}
        >
          <div className="pg-keeper-head" />
          <div className="pg-keeper-shirt">GK</div>
          <div className="pg-keeper-arms" />
        </div>

        {/* Bola */}
        <div className="pg-ball" style={ballPos}>⚽</div>

        {/* Neymar */}
        <div className="pg-neymar">
          <div className="pg-neymar-head" />
          <div className="pg-neymar-shirt">10</div>
          <div className="pg-neymar-label">NEYMAR</div>
        </div>

        {/* Ponto de pênalti */}
        <div className="pg-spot" />

        {/* Área */}
        <div className="pg-area" />

        {/* Resultado */}
        {phase === 'done' && (
          <div className={`pg-result-banner ${gol ? 'gol' : 'save'}`}>
            {gol ? '⚽ GOOOL!' : '🧤 DEFENDEU!'}
          </div>
        )}

        {phase === 'idle' && (
          <div className="pg-hint-txt">👆 Clique numa seta para chutar</div>
        )}
      </div>
    </div>
  )
}
