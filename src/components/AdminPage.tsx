import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AVISO_DEFAULT, CUSTOS, PRECOS, TIPO_LABEL, PIX_CHAVE, PIX_NOME, fmt, calcTotal, calcCusto } from '../lib/types'
import type { AvisoConfig, Item, Order } from '../lib/types'

const ADMIN_USER = 'Ryanzinkkj'
const ADMIN_PASS = '160206Ryan#'
const SESSION_KEY = 'copa_adm_v1'

const PRODS_MODAL = [
  { key: 'pacotes',        label: 'Pacotinhos de Figurinha', hint: `R$ ${(5.90).toFixed(2).replace('.', ',')} cada`, id: 'pacote',         nome: 'Figurinha Pacote',       preco: 5.90  },
  { key: 'capaMole',       label: 'Capa Mole',               hint: `R$ ${(21.92).toFixed(2).replace('.', ',')} cada`, id: 'capaMole',       nome: 'Álbum Capa Mole',        preco: 21.92 },
  { key: 'capaDuraNormal', label: 'Capa Dura Normal',        hint: `R$ ${(62.62).toFixed(2).replace('.', ',')} cada`, id: 'capaDuraNormal', nome: 'Álbum Capa Dura Normal', preco: 62.62 },
  { key: 'capaDuraPrata',  label: 'Capa Dura Prata',         hint: `R$ ${(66.92).toFixed(2).replace('.', ',')} cada`, id: 'capaDuraPrata',  nome: 'Álbum Capa Dura Prata',  preco: 66.92 },
  { key: 'capaDuraOuro',   label: 'Capa Dura Ouro ✨',       hint: `R$ ${(67.92).toFixed(2).replace('.', ',')} cada`, id: 'capaDuraOuro',   nome: 'Álbum Capa Dura Ouro ✨', preco: 67.92 },
]

type MQtys = { pacotes: number; capaMole: number; capaDuraNormal: number; capaDuraPrata: number; capaDuraOuro: number }
const MQTYS_ZERO: MQtys = { pacotes: 0, capaMole: 0, capaDuraNormal: 0, capaDuraPrata: 0, capaDuraOuro: 0 }

export default function AdminPage() {
  const [logado, setLogado] = useState(false)
  const [lUser, setLUser] = useState('')
  const [lPass, setLPass] = useState('')
  const [loginErr, setLoginErr] = useState(false)
  const [loginShake, setLoginShake] = useState(false)

  const [pedidos, setPedidos] = useState<Order[]>([])
  const [filtro, setFiltro] = useState('todos')
  const [syncMsg, setSyncMsg] = useState('')

  const [aviso, setAviso] = useState<AvisoConfig>(AVISO_DEFAULT)
  const [avisoPanelOpen, setAvisoPanelOpen] = useState(false)
  const [avisoTitulo, setAvisoTitulo] = useState(AVISO_DEFAULT.titulo)
  const [avisoMsg, setAvisoMsg] = useState(AVISO_DEFAULT.mensagem)
  const [avisoRodape, setAvisoRodape] = useState(AVISO_DEFAULT.rodape)

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [mNome, setMNome] = useState('')
  const [mRef, setMRef] = useState('')
  const [mTel, setMTel] = useState('')
  const [mQtys, setMQtys] = useState<MQtys>({ ...MQTYS_ZERO })
  const [mErro, setMErro] = useState(false)

  const [zapId, setZapId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const [toast, setToast] = useState('')
  const [toastShow, setToastShow] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === 'ok') setLogado(true)
  }, [])

  useEffect(() => {
    if (!logado) return
    carregar()
    const ch = supabase.channel('admin-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => carregar())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'config' }, (p) => {
        if ((p.new as { key: string }).key === 'aviso') applyAviso((p.new as { key: string; value: AvisoConfig }).value)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [logado])

  function applyAviso(cfg: AvisoConfig) {
    setAviso(cfg); setAvisoTitulo(cfg.titulo); setAvisoMsg(cfg.mensagem); setAvisoRodape(cfg.rodape)
  }

  async function carregar() {
    setSyncMsg('🔄 Sincronizando...')
    const [{ data: orders }, { data: cfg }] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('config').select('value').eq('key', 'aviso').single(),
    ])
    if (orders) setPedidos(orders as Order[])
    if (cfg) applyAviso(cfg.value as AvisoConfig)
    setSyncMsg('')
  }

  function showToast(msg: string) {
    setToast(msg); setToastShow(true)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastShow(false), 2800)
  }

  function doLogin(e: React.FormEvent) {
    e.preventDefault()
    if (lUser === ADMIN_USER && lPass === ADMIN_PASS) {
      sessionStorage.setItem(SESSION_KEY, 'ok'); setLogado(true)
      setLoginErr(false)
    } else {
      setLoginErr(true); setLoginShake(true); setLPass('')
      setTimeout(() => setLoginShake(false), 2000)
    }
  }

  function doLogout() {
    sessionStorage.removeItem(SESSION_KEY); setLogado(false)
    setLUser(''); setLPass('')
  }

  async function togglePago(id: number) {
    const c = pedidos.find(x => x.id === id); if (!c) return
    await supabase.from('orders').update({ pago: !c.pago }).eq('id', id)
    showToast(!c.pago ? `✅ ${c.nome} marcado como pago!` : `↩️ ${c.nome} voltou para pendente`)
  }

  async function setEntrega(id: number, val: string) {
    const c = pedidos.find(x => x.id === id); if (!c) return
    await supabase.from('orders').update({ entrega: val, entregue: val === 'entregue' }).eq('id', id)
    const labels: Record<string, string> = { pendente: '⏳ Pendente', separado: '📦 Separado', entregue: '🏠 Entregue' }
    showToast(`${c.nome}: ${labels[val] ?? val}`)
  }

  async function confirmarDelete() {
    if (deleteId === null) return
    const c = pedidos.find(x => x.id === deleteId)
    await supabase.from('orders').delete().eq('id', deleteId)
    setDeleteId(null)
    if (c) showToast(`🗑️ ${c.nome} removido(a)`)
  }

  async function toggleAviso() {
    const novo = { titulo: avisoTitulo, mensagem: avisoMsg, rodape: avisoRodape, ativo: !aviso.ativo }
    await supabase.from('config').update({ value: novo }).eq('key', 'aviso')
    showToast(novo.ativo ? '🔴 Pedidos fechados!' : '🟢 Pedidos abertos!')
  }

  async function salvarAviso() {
    const novo = { ativo: aviso.ativo, titulo: avisoTitulo || AVISO_DEFAULT.titulo, mensagem: avisoMsg || AVISO_DEFAULT.mensagem, rodape: avisoRodape || AVISO_DEFAULT.rodape }
    await supabase.from('config').update({ value: novo }).eq('key', 'aviso')
    showToast('✅ Notificação salva!')
  }

  // ── MODAL ──
  function abrirModal() {
    setEditId(null); setMNome(''); setMRef(''); setMTel(''); setMQtys({ ...MQTYS_ZERO }); setMErro(false); setModalOpen(true)
  }

  function abrirEditar(id: number) {
    const c = pedidos.find(x => x.id === id); if (!c) return
    setEditId(id); setMNome(c.nome); setMRef(c.ref || ''); setMTel(c.telefone || '')
    const qtys = { ...MQTYS_ZERO }
    c.itens.forEach(i => {
      if (i.id === 'pacote') qtys.pacotes = i.qty
      else if (i.id in qtys) (qtys as Record<string, number>)[i.id] = i.qty
    })
    setMQtys(qtys); setMErro(false); setModalOpen(true)
  }

  async function salvarCliente() {
    if (!mNome.trim()) { setMErro(true); return }
    setMErro(false)
    const itens: Item[] = []
    PRODS_MODAL.forEach(p => {
      const qty = mQtys[p.key as keyof MQtys]
      if (qty > 0) itens.push({ id: p.id, nome: p.nome, preco: p.preco, qty })
    })
    const total = calcTotal(itens)

    if (editId !== null) {
      await supabase.from('orders').update({ nome: mNome.trim(), ref: mRef.trim(), telefone: mTel.replace(/\D/g, ''), itens, total }).eq('id', editId)
      setModalOpen(false); showToast(`✏️ ${mNome.trim()} atualizado(a)!`)
    } else {
      await supabase.from('orders').insert({
        nome: mNome.trim(), ref: mRef.trim(), telefone: mTel.replace(/\D/g, ''),
        cep: '', cidade: 'Itu', estado: 'SP', itens, total, obs: '',
        entregue: false, pago: false, entrega: 'pendente', fonte: 'manual',
      })
      setModalOpen(false); setFiltro('todos'); showToast(`✅ ${mNome.trim()} adicionado(a)!`)
    }
  }

  // ── ZAP ──
  function resumoPedido(c: Order) {
    return c.itens.map(i => `${i.qty}x ${TIPO_LABEL[i.id] ?? i.nome}`).join(', ')
  }

  function enviarZap(c: Order, tipo: number) {
    const num = c.telefone.replace(/\D/g, '')
    const total = fmt(c.total)
    const resumo = resumoPedido(c)
    const msgs = [
      `Olá, ${c.nome}! 🏆🇧🇷\n\nPassando para confirmar o valor do seu pedido das figurinhas da Copa:\n\n📦 *Pedido:* ${resumo}\n💰 *Total: ${total}*\n\nPara pagamento via Pix:\n🔑 *Chave:* ${PIX_CHAVE}\n👤 *Beneficiário:* ${PIX_NOME}\n\nQualquer dúvida é só falar! 🙏`,
      `Olá, ${c.nome}! 🏆🇧🇷\n\nPassando para confirmar o seu pedido das figurinhas da Copa do Mundo:\n\n📦 *${resumo}*\n💰 *Total: ${total}*\n\nEstá certo assim? Me confirma para eu separar! 😄`,
      `Boa notícia, ${c.nome}! 🏆🇧🇷\n\nSeu pedido das figurinhas da Copa chegou e já está separadinho:\n\n📦 *${resumo}*\n\nCombina de nos falar quando puder retirar! 😄`,
    ]
    const texto = msgs[tipo]
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(texto).catch(() => {})
    }
    setTimeout(() => window.open(`https://wa.me/55${num}`, '_blank'), 400)
    showToast('Mensagem copiada! Abrindo WhatsApp...')
    setZapId(null)
  }

  // ── PREVIEW MODAL ──
  function previewItens(): Item[] {
    return PRODS_MODAL.flatMap(p => {
      const qty = mQtys[p.key as keyof MQtys]
      return qty > 0 ? [{ id: p.id, nome: p.nome, preco: p.preco, qty }] : []
    })
  }
  const previewTotal = calcTotal(previewItens())

  // ── FILTRO ──
  const pedidosFiltrados = pedidos.filter(c =>
    filtro === 'pendente' ? !c.pago :
    filtro === 'pago' ? c.pago :
    filtro === 'entregue' ? c.entrega === 'entregue' : true
  )

  // ── TOTAIS ──
  const totalGeral = pedidos.reduce((s, c) => s + c.total, 0)
  const totalPacotes = pedidos.reduce((s, c) => s + (c.itens.find(i => i.id === 'pacote')?.qty ?? 0), 0)
  const totalAlbuns = pedidos.reduce((s, c) => s + c.itens.filter(i => i.id !== 'pacote').reduce((a, i) => a + i.qty, 0), 0)
  const totalPago = pedidos.filter(c => c.pago).reduce((s, c) => s + c.total, 0)
  const totalCusto = pedidos.reduce((s, c) => s + calcCusto(c.itens), 0)
  const lucroTotal = totalGeral - totalCusto
  const lucroRecebido = pedidos.filter(c => c.pago).reduce((s, c) => s + (c.total - calcCusto(c.itens)), 0)
  const pct = totalGeral > 0 ? ((lucroTotal / totalGeral) * 100).toFixed(1) : '0.0'
  const totalOnline = pedidos.filter(c => c.fonte === 'online').length

  const zapPedido = zapId !== null ? pedidos.find(x => x.id === zapId) : null
  const deletePedido = deleteId !== null ? pedidos.find(x => x.id === deleteId) : null

  // ── LOGIN ──
  if (!logado) {
    return (
      <div className="login-ov">
        <form className="login-box" onSubmit={doLogin}>
          <span className="login-ball">⚽</span>
          <div className="login-ttl">Painel Admin</div>
          <div className="login-sub">Vendas Copa 2026 · Acesso restrito</div>
          <div className="login-fg">
            <label className="login-lbl">Usuário</label>
            <input type="text" className={`login-inp${loginShake ? ' err' : ''}`} placeholder="Usuário" value={lUser} onChange={e => setLUser(e.target.value)} autoComplete="username" />
          </div>
          <div className="login-fg">
            <label className="login-lbl">Senha</label>
            <input type="password" className={`login-inp${loginShake ? ' err' : ''}`} placeholder="••••••••" value={lPass} onChange={e => setLPass(e.target.value)} autoComplete="current-password" />
          </div>
          <button type="submit" className="login-btn">ENTRAR</button>
          {loginErr && <div className="login-err">Usuário ou senha incorretos.</div>}
        </form>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <button className="logout-btn" onClick={doLogout}>🔒 Sair</button>

      <header className="adm-header">
        <div className="header-inner">
          <div className="header-left">
            <h1>⚽ Vendas Copa</h1>
            <p>Controle de pedidos — Figurinhas & Álbuns</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div className="copa-badge">2026</div>
            <div className="sync-status" style={{ opacity: syncMsg ? 1 : 0 }}>{syncMsg}</div>
          </div>
        </div>
      </header>

      <div className="summary-bar">
        <div className="sum-item"><div className="sum-label">Clientes</div><div className="sum-value">{pedidos.length}</div></div>
        <div className="sum-item"><div className="sum-label">Pacotinhos</div><div className="sum-value">{totalPacotes}</div></div>
        <div className="sum-item"><div className="sum-label">Álbuns</div><div className="sum-value">{totalAlbuns}</div></div>
        <div className="sum-item"><div className="sum-label">Faturamento Total</div><div className="sum-value">{fmt(totalGeral)}</div></div>
        {totalOnline > 0 && (
          <div className="sum-item" style={{ borderLeft: '2px solid #3b82f6', paddingLeft: 16, marginLeft: 4 }}>
            <div className="sum-label" style={{ color: '#93c5fd' }}>🌐 Pedidos Online</div>
            <div className="sum-value" style={{ color: '#60a5fa' }}>{totalOnline}</div>
          </div>
        )}
      </div>

      <main className="adm-main">
        {/* AVISO CTRL */}
        <div className="aviso-ctrl">
          <div className="aviso-ctrl-header" onClick={() => setAvisoPanelOpen(o => !o)}>
            <span style={{ fontSize: '1rem' }}>🔔</span>
            <span className="aviso-ctrl-title">Notificação & Pedidos</span>
            <span className={`aviso-status ${aviso.ativo ? 'fechado' : 'aberto'}`}>{aviso.ativo ? '🔴 FECHADO' : '🟢 ABERTO'}</span>
            <span className={`aviso-chevron${avisoPanelOpen ? ' open' : ''}`}>▼</span>
          </div>
          <div className={`aviso-ctrl-body${avisoPanelOpen ? ' open' : ''}`}>
            <button
              className={`aviso-toggle-btn ${aviso.ativo ? 'abrir' : 'fechar'}`}
              onClick={toggleAviso}
            >
              {aviso.ativo ? '🟢 ABRIR PEDIDOS (remover notificação)' : '🔴 FECHAR PEDIDOS (ativar notificação)'}
            </button>
            <div className="aviso-field">
              <label>Título da notificação</label>
              <input type="text" className="aviso-input" placeholder="Pedidos Indisponíveis" value={avisoTitulo} onChange={e => setAvisoTitulo(e.target.value)} />
            </div>
            <div className="aviso-field">
              <label>Mensagem (use Enter para quebra de linha)</label>
              <textarea className="aviso-input aviso-textarea" placeholder="Texto da mensagem..." value={avisoMsg} onChange={e => setAvisoMsg(e.target.value)} />
            </div>
            <div className="aviso-field">
              <label>Rodapé (linha pequena abaixo)</label>
              <input type="text" className="aviso-input" placeholder="Acompanhe o grupo..." value={avisoRodape} onChange={e => setAvisoRodape(e.target.value)} />
            </div>
            <button className="aviso-save-btn" onClick={salvarAviso}>💾 SALVAR NOTIFICAÇÃO</button>
            <p className="aviso-hint">As alterações aparecem imediatamente para quem abrir o site.</p>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="toolbar">
          <span className="filters-label">Filtrar:</span>
          {['todos', 'pendente', 'pago', 'entregue'].map(f => (
            <button key={f} className={`filter-btn${filtro === f ? ' active' : ''}`} onClick={() => setFiltro(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button className="add-btn" onClick={abrirModal}>➕ Novo Cliente</button>
        </div>

        {/* GRID */}
        <div className="grid">
          {pedidosFiltrados.length === 0
            ? <div className="no-results">Nenhum cliente nessa categoria.</div>
            : pedidosFiltrados.map(c => {
              const isOnline = c.fonte === 'online'
              const temTel = c.telefone.replace(/\D/g, '').length > 0
              return (
                <div key={c.id} className={`card${c.pago ? ' pago' : ''}${isOnline ? ' online' : ''}`}>
                  <div className="card-header">
                    <div className="client-avatar">{c.nome.charAt(0).toUpperCase()}</div>
                    <div className="client-info">
                      <div className="client-name">
                        {c.nome}
                        {isOnline && <span className="online-tag">🌐 Online</span>}
                      </div>
                      {c.ref && <div className="client-ref">{c.ref}</div>}
                    </div>
                    <button className={`status-badge${c.pago ? ' pago' : ''}`} onClick={() => togglePago(c.id)}>
                      {c.pago ? 'Pago ✓' : 'Pendente'}
                    </button>
                  </div>
                  <div className="card-body">
                    {c.itens.length === 0
                      ? <div style={{ fontSize: '.8rem', color: '#999', padding: '3px 0' }}>Sem itens</div>
                      : c.itens.map((i, idx) => (
                        <div key={idx} className="item-line">
                          <div className="item-desc"><span>{i.id === 'pacote' ? '🎴' : '📚'}</span>{i.qty}x {TIPO_LABEL[i.id] ?? i.nome}</div>
                          <div className="item-price">{fmt(i.qty * i.preco)}</div>
                        </div>
                      ))
                    }
                  </div>
                  {c.obs && <div className="obs-linha">💬 {c.obs}</div>}
                  <div className="entrega-row">
                    <span className="entrega-label">Entrega:</span>
                    <select className="entrega-select" value={c.entrega || 'pendente'} onChange={e => setEntrega(c.id, e.target.value)}>
                      <option value="pendente">Pendente</option>
                      <option value="separado">Separado</option>
                      <option value="entregue">Entregue</option>
                    </select>
                  </div>
                  <div className="card-footer">
                    <div className="total-label">Total</div>
                    <div className="total-value">{fmt(c.total)}</div>
                  </div>
                  <div className="card-actions">
                    <div className="action-left">
                      <button className="zap-btn" onClick={() => setZapId(c.id)} title={temTel ? 'Enviar mensagem' : 'Sem número cadastrado'}>
                        {temTel ? <><span>📱</span> WhatsApp</> : <><span>📵</span> Sem número</>}
                      </button>
                      <button className="edit-btn" onClick={() => abrirEditar(c.id)}>✏️ Editar</button>
                    </div>
                    <button className="del-btn" onClick={() => setDeleteId(c.id)}>🗑️ remover</button>
                  </div>
                </div>
              )
            })
          }
        </div>

        {/* TOTALS BANNER */}
        <div className="totals-banner">
          <div className="sum-item"><div className="sum-label">💰 Total a Receber</div><div className="sum-value">{fmt(totalGeral)}</div></div>
          <div className="sum-item"><div className="sum-label">✅ Já Recebido</div><div className="sum-value">{fmt(totalPago)}</div></div>
          <div className="sum-item"><div className="sum-label">⏳ Ainda Pendente</div><div className="sum-value">{fmt(totalGeral - totalPago)}</div></div>
          <div className="sum-item" style={{ borderLeft: '2px solid rgba(255,255,255,.2)', paddingLeft: 28, marginLeft: 4 }}>
            <div className="sum-label">📦 Custo Total</div>
            <div className="sum-value" style={{ color: 'rgba(255,255,255,.75)' }}>{fmt(totalCusto)}</div>
          </div>
          <div className="sum-item"><div className="sum-label">🤑 Lucro Projetado</div><div className="sum-value" style={{ color: '#7dffb0' }}>{fmt(lucroTotal)}</div></div>
          <div className="sum-item"><div className="sum-label">✅ Lucro Recebido</div><div className="sum-value" style={{ color: '#7dffb0' }}>{fmt(lucroRecebido)}</div></div>
          <div className="sum-item"><div className="sum-label">📈 Margem</div><div className="sum-value" style={{ color: '#ffe680' }}>{pct}%</div></div>
        </div>

        {/* TABELA PRECOS */}
        <div className="preco-section">
          <div className="section-title">📋 Preços, Custos & Margem</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '2px solid var(--borda)' }}>
                  {['Produto', 'Venda', 'Custo', 'Lucro/un', 'Margem'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: i === 0 ? 'left' : 'right', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--sub)', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { nome: '🎴 Pacotinho',       key: 'pacote'         },
                  { nome: '📚 Álbum Capa Mole', key: 'capaMole'       },
                  { nome: '📚 C. Dura Normal',  key: 'capaDuraNormal' },
                  { nome: '📚 C. Dura Prata',   key: 'capaDuraPrata'  },
                  { nome: '📚 C. Dura Ouro ✨', key: 'capaDuraOuro'   },
                ].map((r, i) => {
                  const venda = PRECOS[r.key]; const custo = CUSTOS[r.key]
                  const lucro = venda - custo; const margem = ((lucro / venda) * 100).toFixed(1)
                  return (
                    <tr key={r.key} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid var(--borda)' }}>
                      <td style={{ padding: '10px 18px', fontWeight: 500 }}>{r.nome}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{fmt(venda)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--sub)' }}>{fmt(custo)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--verde-claro)', fontWeight: 700 }}>+{fmt(lucro)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <span style={{ background: '#e8fdf2', color: '#065f46', padding: '3px 8px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 700 }}>{margem}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* TOAST */}
      <div className={`adm-toast${toastShow ? ' show' : ''}`}>{toast}</div>

      {/* MODAL ADD/EDIT */}
      <div className={`modal-overlay${modalOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
        <div className="modal-box">
          <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
          <div className="modal-title">{editId !== null ? '✏️ Editar Cliente' : '➕ Novo Cliente'}</div>
          <div className="m-group">
            <label className="m-label">Nome *</label>
            <input className="m-input" type="text" placeholder="Ex: Maria" value={mNome} onChange={e => setMNome(e.target.value)} />
          </div>
          <div className="m-group">
            <label className="m-label">Referência / Apelido</label>
            <input className="m-input" type="text" placeholder="Ex: K23, UNA, vizinha... (opcional)" value={mRef} onChange={e => setMRef(e.target.value)} />
          </div>
          <div className="m-group">
            <label className="m-label">WhatsApp (opcional)</label>
            <input className="m-input" type="tel" placeholder="Ex: 11999998888 (só números)" value={mTel} onChange={e => setMTel(e.target.value)} />
          </div>
          <div className="m-group">
            <label className="m-label">Pacotinhos de Figurinha</label>
            <div className="qty-control">
              <button className="qty-btn-sm" onClick={() => setMQtys(q => ({ ...q, pacotes: Math.max(0, q.pacotes - 1) }))}>−</button>
              <input className="qty-input" type="number" min={0} value={mQtys.pacotes} onChange={e => setMQtys(q => ({ ...q, pacotes: Math.max(0, parseInt(e.target.value) || 0) }))} />
              <button className="qty-btn-sm" onClick={() => setMQtys(q => ({ ...q, pacotes: q.pacotes + 1 }))}>+</button>
              <span style={{ fontSize: '0.73rem', color: 'var(--sub)' }}>× {fmt(5.90)}</span>
            </div>
          </div>
          <div className="albums-section">
            <span className="albums-title">📚 Álbuns</span>
            {PRODS_MODAL.slice(1).map(p => (
              <div key={p.key} className="album-row">
                <div className="album-row-label">{p.label}<span className="album-price-hint">{p.hint}</span></div>
                <div className="qty-control">
                  <button className="qty-btn-sm" onClick={() => setMQtys(q => ({ ...q, [p.key]: Math.max(0, (q[p.key as keyof MQtys] as number) - 1) }))}>−</button>
                  <input className="qty-input" type="number" min={0} value={mQtys[p.key as keyof MQtys]} onChange={e => setMQtys(q => ({ ...q, [p.key]: Math.max(0, parseInt(e.target.value) || 0) }))} />
                  <button className="qty-btn-sm" onClick={() => setMQtys(q => ({ ...q, [p.key]: (q[p.key as keyof MQtys] as number) + 1 }))}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="m-preview">
            {previewItens().length === 0
              ? <span className="m-preview-empty">Preencha os campos para ver o resumo do pedido.</span>
              : <>
                {previewItens().map((i, idx) => (
                  <span key={idx}>{i.id === 'pacote' ? '🎴' : '📚'} {i.qty}x {TIPO_LABEL[i.id] ?? i.nome} — <strong>{fmt(i.qty * i.preco)}</strong><br /></span>
                ))}
                <span style={{ color: 'var(--verde)', fontWeight: 700, fontSize: '.93rem' }}>Total: {fmt(previewTotal)}</span>
              </>
            }
          </div>
          {mErro && <div className="m-erro">⚠️ Por favor, informe o nome do cliente.</div>}
          <button className="m-save" onClick={salvarCliente}>✅ SALVAR CLIENTE</button>
        </div>
      </div>

      {/* ZAP MODAL */}
      <div className={`modal-overlay${zapId !== null ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setZapId(null) }}>
        <div className="zap-modal-box">
          <button className="modal-close" onClick={() => setZapId(null)}>✕</button>
          <div className="zap-modal-title">💬 WhatsApp</div>
          <div className="zap-client-name">Para: {zapPedido?.nome}{zapPedido?.ref ? ` (${zapPedido.ref})` : ''}</div>
          <div style={{ background: '#f0fff4', border: '1px solid #b7ebc8', borderRadius: 8, padding: '10px 13px', fontSize: '0.75rem', color: '#065f46', marginBottom: 14 }}>
            Clique na mensagem desejada: ela será <strong>copiada automaticamente</strong> e o WhatsApp será aberto. Basta colar na conversa.
          </div>
          {zapPedido && zapPedido.telefone.replace(/\D/g, '').length === 0
            ? <div className="zap-no-phone">Nenhum número cadastrado para <strong>{zapPedido.nome}</strong>.<br /><br />Edite o cliente para adicionar o WhatsApp.</div>
            : zapPedido && [
              { icon: '💰', label: 'Cobrança Pix',     desc: 'Enviar valor total + chave Pix' },
              { icon: '✅', label: 'Confirmar Pedido', desc: 'Enviar resumo do pedido para confirmar' },
              { icon: '🚀', label: 'Pedido Chegou!',   desc: 'Avisar que o pedido chegou' },
            ].map((m, i) => (
              <div key={i} className="zap-option" onClick={() => zapPedido && enviarZap(zapPedido, i)}>
                <div className="zap-option-icon">{m.icon}</div>
                <div className="zap-option-info">
                  <div className="zap-option-label">{m.label}</div>
                  <div className="zap-option-desc">{m.desc}</div>
                </div>
                <span style={{ color: 'var(--zap)', fontSize: '1rem' }}>→</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* CONFIRM DELETE */}
      <div className={`confirm-overlay${deleteId !== null ? ' open' : ''}`}>
        <div className="confirm-box">
          <div className="confirm-title">🗑️ Remover Cliente</div>
          <div className="confirm-msg">
            Remover &quot;{deletePedido?.nome}&quot; da lista? Esta ação não pode ser desfeita.
          </div>
          <div className="confirm-btns">
            <button className="confirm-btn cancel" onClick={() => setDeleteId(null)}>Cancelar</button>
            <button className="confirm-btn danger" onClick={confirmarDelete}>Remover</button>
          </div>
        </div>
      </div>
    </div>
  )
}
