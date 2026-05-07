import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TIPO_LABEL, fmt } from '@/lib/types'
import type { Order } from '@/lib/types'

const ENTREGA_LABEL: Record<string, { icon: string; texto: string }> = {
  pendente: { icon: '⏳', texto: 'Aguardando' },
  separado: { icon: '📦', texto: 'Separado' },
  entregue: { icon: '🏠', texto: 'Entregue' },
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

  async function buscar(e: React.FormEvent) {
    e.preventDefault()
    const digits = telefone.replace(/\D/g, '')
    if (digits.length < 10) return
    setLoading(true)
    setBuscado(false)
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('telefone', digits)
      .order('created_at', { ascending: false })
    setPedidos((data as unknown as Order[]) ?? [])
    setBuscado(true)
    setLoading(false)
  }

  return (
    <div className="mp-wrap">
      <header className="mp-header">
        <a href="/" className="mp-back">← Voltar</a>
        <div className="mp-badge">🏆 Copa do Mundo 2026</div>
        <h1 className="mp-title">Meus Pedidos</h1>
        <p className="mp-sub">Digite seu WhatsApp para ver seus pedidos</p>
      </header>

      <form className="mp-form" onSubmit={buscar}>
        <input
          type="tel"
          className="mp-input"
          placeholder="(11) 99999-9999"
          value={telefone}
          maxLength={15}
          onChange={e => setTelefone(maskFone(e.target.value))}
          autoFocus
        />
        <button type="submit" className="mp-btn" disabled={loading}>
          {loading ? '🔄 Buscando...' : '🔍 Buscar pedidos'}
        </button>
      </form>

      {buscado && pedidos !== null && (
        pedidos.length === 0
          ? (
            <div className="mp-empty">
              <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🤔</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Nenhum pedido encontrado</div>
              <div style={{ fontSize: '.83rem', color: 'rgba(255,255,255,.5)' }}>
                Verifique se digitou o número correto.
              </div>
            </div>
          )
          : (
            <div className="mp-list">
              {pedidos.map(p => {
                const entrega = ENTREGA_LABEL[p.entrega ?? 'pendente'] ?? ENTREGA_LABEL.pendente
                const data = new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                return (
                  <div key={p.id} className="mp-card">
                    <div className="mp-card-top">
                      <span className="mp-data">{data}</span>
                      <span className={`mp-pago${p.pago ? ' pago' : ''}`}>
                        {p.pago ? '✅ Pago' : '⏳ Pendente'}
                      </span>
                    </div>

                    <div className="mp-itens">
                      {(p.itens ?? []).map((item, i) => (
                        <div key={i} className="mp-item">
                          <span>{item.id === 'pacote' ? '🎴' : '📚'} {TIPO_LABEL[item.id] ?? item.nome}</span>
                          <span>{item.qty}x — {fmt(item.qty * item.preco)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mp-card-footer">
                      <div className="mp-entrega">
                        {entrega.icon} {entrega.texto}
                      </div>
                      <div className="mp-total">{fmt(p.total)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
      )}

      <footer className="mp-footer">🏆 Vendas Copa 2026 · Itu/SP</footer>
    </div>
  )
}
