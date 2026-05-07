import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TIPO_LABEL, fmt } from '@/lib/types'
import type { Order } from '@/lib/types'

const STATUS_ENTREGA: Record<string, { icon: string; texto: string; cor: string; bg: string }> = {
  pendente: { icon: '⏳', texto: 'Aguardando separação', cor: '#f59e0b', bg: 'rgba(245,158,11,.15)' },
  separado: { icon: '📦', texto: 'Separado — em breve!',  cor: '#60a5fa', bg: 'rgba(96,165,250,.15)' },
  entregue: { icon: '✅', texto: 'Entregue!',              cor: '#34d399', bg: 'rgba(52,211,153,.15)' },
}

function maskFone(val: string) {
  let v = val.replace(/\D/g, '').substring(0, 11)
  if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`
  else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`
  else if (v.length) v = `(${v}`
  return v
}

export default function MyOrdersPage() {
  const [telefone, setTelefone] = useState('')
  const [pedidos, setPedidos] = useState<Order[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [digits, setDigits] = useState('')
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    return () => { if (chRef.current) supabase.removeChannel(chRef.current) }
  }, [])

  async function buscar(tel: string) {
    const d = tel.replace(/\D/g, '')
    if (d.length < 10) return
    setDigits(d)
    setLoading(true)
    setBuscado(false)
    if (chRef.current) supabase.removeChannel(chRef.current)

    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('telefone', d)
      .order('created_at', { ascending: false })

    setPedidos((data as unknown as Order[]) ?? [])
    setBuscado(true)
    setLoading(false)

    chRef.current = supabase.channel(`mp-${d}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        supabase.from('orders').select('*').eq('telefone', d).order('created_at', { ascending: false })
          .then(({ data: fresh }) => { if (fresh) setPedidos(fresh as unknown as Order[]) })
      })
      .subscribe()
  }

  function handleFone(val: string) {
    const masked = maskFone(val)
    setTelefone(masked)
    const d = val.replace(/\D/g, '')
    if (d.length >= 10) buscar(masked)
  }

  return (
    <div className="mp-wrap">
      <div className="mp-inner">
        <header className="mp-header">
          <a href="/" className="mp-back">← Voltar ao site</a>
          <div className="mp-badge">🏆 Copa do Mundo 2026</div>
          <h1 className="mp-title">Meus Pedidos</h1>
          <p className="mp-sub">Acompanhe seus pedidos em tempo real</p>
        </header>

        <form className="mp-form" onSubmit={e => { e.preventDefault(); buscar(telefone) }}>
          <div className="mp-input-wrap">
            <span className="mp-input-icon">📱</span>
            <input
              type="tel"
              className="mp-input"
              placeholder="(11) 99999-9999"
              value={telefone}
              maxLength={15}
              onChange={e => handleFone(e.target.value)}
              autoFocus
            />
          </div>
          <button type="submit" className="mp-btn" disabled={loading || telefone.replace(/\D/g,'').length < 10}>
            {loading
              ? <><span className="mp-spinner" /> Buscando...</>
              : '🔍 Buscar pedidos'
            }
          </button>
        </form>

        {buscado && !loading && (
          pedidos?.length === 0
            ? (
              <div className="mp-empty">
                <div className="mp-empty-icon">🤔</div>
                <div className="mp-empty-title">Nenhum pedido encontrado</div>
                <div className="mp-empty-sub">Verifique se digitou o número correto ou entre em contato pelo WhatsApp.</div>
              </div>
            )
            : (
              <div className="mp-list">
                <div className="mp-count">{pedidos?.length} pedido{(pedidos?.length ?? 0) > 1 ? 's' : ''} encontrado{(pedidos?.length ?? 0) > 1 ? 's' : ''}</div>
                {pedidos?.map((p, idx) => {
                  const st = STATUS_ENTREGA[p.entrega ?? 'pendente'] ?? STATUS_ENTREGA.pendente
                  const data = new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  return (
                    <div key={p.id} className="mp-card" style={{ animationDelay: `${idx * 60}ms` }}>
                      <div className="mp-card-header">
                        <div className="mp-card-data">📅 {data}</div>
                        <div className={`mp-pago-badge${p.pago ? ' pago' : ''}`}>
                          {p.pago ? '✅ Pago' : '⏳ Pendente'}
                        </div>
                      </div>

                      <div className="mp-card-itens">
                        {(p.itens ?? []).map((item, i) => (
                          <div key={i} className="mp-item-row">
                            <span className="mp-item-nome">{item.id === 'pacote' ? '🎴' : '📚'} {TIPO_LABEL[item.id] ?? item.nome}</span>
                            <span className="mp-item-val">{item.qty}× {fmt(item.qty * item.preco)}</span>
                          </div>
                        ))}
                      </div>

                      {p.obs && (
                        <div className="mp-obs">💬 {p.obs}</div>
                      )}

                      <div className="mp-card-footer">
                        <div className="mp-entrega-pill" style={{ color: st.cor, background: st.bg }}>
                          {st.icon} {st.texto}
                        </div>
                        <div className="mp-total-val">{fmt(p.total)}</div>
                      </div>
                    </div>
                  )
                })}
                <div className="mp-realtime-hint">🔄 Atualiza automaticamente</div>
              </div>
            )
        )}
      </div>

      <div className="mp-rodape">🏆 Vendas Copa 2026 · Itu/SP</div>
    </div>
  )
}
