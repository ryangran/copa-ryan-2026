import { useEffect, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { TIPO_LABEL, fmt } from '@/lib/types'
import type { Order } from '@/lib/types'

const ENTREGA_LABEL: Record<string, { icon: string; texto: string; cor: string }> = {
  pendente:  { icon: '⏳', texto: 'Aguardando separação', cor: '#f59e0b' },
  separado:  { icon: '📦', texto: 'Separado — em breve será entregue', cor: '#3b82f6' },
  entregue:  { icon: '🏠', texto: 'Entregue!', cor: '#10b981' },
}

export default function TrackingPage() {
  const { token } = useParams({ strict: false }) as { token: string }
  const [pedido, setPedido] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return }
    supabase.from('orders').select('*').eq('token', token).maybeSingle()
      .then(({ data }) => {
        if (data) setPedido(data as unknown as Order)
        else setNotFound(true)
        setLoading(false)
      })

    const ch = supabase.channel(`track-${token}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (p) => {
        const row = p.new as unknown as Order
        if (row.token === token) setPedido(row)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [token])

  if (loading) return (
    <div className="track-wrap">
      <div className="track-loading">🔄 Carregando pedido...</div>
    </div>
  )

  if (notFound) return (
    <div className="track-wrap">
      <div className="track-notfound">
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔍</div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>Pedido não encontrado</div>
        <div style={{ fontSize: '.87rem', color: 'rgba(255,255,255,.6)' }}>Verifique o link e tente novamente.</div>
      </div>
    </div>
  )

  const entrega = ENTREGA_LABEL[pedido!.entrega ?? 'pendente'] ?? ENTREGA_LABEL.pendente
  const data = new Date(pedido!.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="track-wrap">
      <header className="track-header">
        <div className="track-badge">🏆 Copa do Mundo 2026</div>
        <h1 className="track-title">Meu Pedido</h1>
        <div className="track-sub">Olá, <strong>{pedido!.nome.split(' ')[0]}</strong>! Aqui está o acompanhamento do seu pedido.</div>
      </header>

      <div className="track-card">
        <div className="track-section-title">📦 Status da entrega</div>
        <div className="track-status-row" style={{ borderColor: entrega.cor }}>
          <span style={{ fontSize: '1.6rem' }}>{entrega.icon}</span>
          <span className="track-status-text" style={{ color: entrega.cor }}>{entrega.texto}</span>
        </div>
      </div>

      <div className="track-card">
        <div className="track-section-title">💳 Pagamento</div>
        <div className={`track-pago-badge${pedido!.pago ? ' pago' : ''}`}>
          {pedido!.pago ? '✅ Pago' : '⏳ Aguardando pagamento'}
        </div>
      </div>

      <div className="track-card">
        <div className="track-section-title">🎴 Itens do pedido</div>
        {(pedido!.itens ?? []).map((item, i) => (
          <div key={i} className="track-item">
            <span>{item.id === 'pacote' ? '🎴' : '📚'} {TIPO_LABEL[item.id] ?? item.nome}</span>
            <span>{item.qty}x — <strong>{fmt(item.qty * item.preco)}</strong></span>
          </div>
        ))}
        <div className="track-total">
          <span>Total</span>
          <span>{fmt(pedido!.total)}</span>
        </div>
      </div>

      <div className="track-footer">
        Pedido feito em {data} · Itu/SP
      </div>
    </div>
  )
}
