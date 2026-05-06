import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PRODUTOS, WPP_LOJA, AVISO_DEFAULT, fmt } from '../lib/types'
import type { AvisoConfig } from '../lib/types'

type Qtds = Record<string, number>

export default function OrderPage() {
  const [aviso, setAviso] = useState<AvisoConfig>(AVISO_DEFAULT)
  const [avisoFechado, setAvisoFechado] = useState(false)
  const [qtys, setQtys] = useState<Qtds>({})
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cep, setCep] = useState('')
  const [logradouro, setLogradouro] = useState('')
  const [bairro, setBairro] = useState('')
  const [complemento, setComplemento] = useState('')
  const [cidade, setCidade] = useState('Itu')
  const [estado, setEstado] = useState('SP')
  const [obs, setObs] = useState('')
  const [erros, setErros] = useState<string[]>([])
  const [cepErro, setCepErro] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [sucTotal, setSucTotal] = useState(0)
  const [wppLink, setWppLink] = useState('')
  const [toast, setToast] = useState('')
  const [toastShow, setToastShow] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    supabase.from('config').select('value').eq('key', 'aviso').single()
      .then(({ data }) => { if (data) setAviso(data.value as AvisoConfig) })

    const ch = supabase.channel('order-cfg')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'config' }, (p) => {
        if ((p.new as { key: string }).key === 'aviso')
          setAviso((p.new as { key: string; value: AvisoConfig }).value)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  function showToast(msg: string) {
    setToast(msg); setToastShow(true)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastShow(false), 3200)
  }

  function setQty(id: string, val: number) {
    setQtys(q => ({ ...q, [id]: Math.max(0, isNaN(val) ? 0 : val) }))
  }

  function maskFone(val: string) {
    let v = val.replace(/\D/g, '').substring(0, 11)
    if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`
    else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`
    else if (v.length) v = `(${v}`
    return v
  }

  function maskCEP(val: string) {
    let v = val.replace(/\D/g, '').substring(0, 8)
    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5)
    return v
  }

  async function lookupCEP(raw: string) {
    const digits = raw.replace(/\D/g, '')
    if (digits.length !== 8) return
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const d = await r.json()
      if (d.erro || d.localidade?.toLowerCase() !== 'itu') {
        setCepErro(true)
        showToast('⚠️ No momento, aceitamos pedidos apenas para Itu/SP.')
        setLogradouro(''); setBairro('')
        return
      }
      setCepErro(false)
      if (d.logradouro) setLogradouro(d.logradouro)
      if (d.bairro) setBairro(d.bairro)
      setCidade(d.localidade); setEstado(d.uf)
      showToast('✅ Endereço preenchido automaticamente!')
    } catch { /* silent */ }
  }

  const ativos = PRODUTOS.filter(p => (qtys[p.id] ?? 0) > 0)
  const total = ativos.reduce((s, p) => s + p.preco * (qtys[p.id] ?? 0), 0)

  function buildTexto() {
    const t_br = String.fromCodePoint(0x1F3C6)
    const br = String.fromCodePoint(0x1F1E7) + String.fromCodePoint(0x1F1F7)
    const comp = complemento.trim()
    const obsStr = obs.trim()
    let t = `🏆 *PEDIDO COPA 2026*\n━━━━━━━━━━━━━━━━\n\n`
    t += `👤 *Nome:* ${nome.trim()}\n📱 *WhatsApp:* ${telefone.trim()}\n\n`
    t += `📍 *Endereço:* ${logradouro.trim()}${comp ? ', ' + comp : ''}\n`
    t += `🏘️ *Bairro:* ${bairro.trim()}\n🏙️ *Cidade:* Itu/SP\n📮 *CEP:* ${cep.trim()}\n`
    if (obsStr) t += `💬 *Obs:* ${obsStr}\n`
    t += `\n📦 *Produtos escolhidos:*\n`
    ativos.forEach(p => {
      const sub = (qtys[p.id] ?? 0) * p.preco
      t += `  ${p.emoji} ${p.nome}\n     ${qtys[p.id]}x ${fmt(p.preco)} = *${fmt(sub)}*\n`
    })
    t += `\n💰 *TOTAL: ${fmt(total)}*\n\n_Pedido enviado pelo site — Copa 2026_`
    void t_br; void br
    return t
  }

  function validar() {
    const errs: string[] = []
    if (!nome.trim()) errs.push('Nome completo é obrigatório')
    if (!telefone.trim()) errs.push('WhatsApp é obrigatório')
    if (!cep.trim()) errs.push('CEP é obrigatório')
    if (!logradouro.trim()) errs.push('Endereço completo é obrigatório')
    if (!bairro.trim()) errs.push('Bairro é obrigatório')
    const digits = cep.replace(/\D/g, '')
    if (digits.length === 8 && !digits.startsWith('1330'))
      errs.push('No momento, aceitamos pedidos apenas para Itu/SP.')
    if (!ativos.length) errs.push('Selecione pelo menos um produto para continuar.')
    return errs
  }

  async function enviarPedido(e: React.FormEvent) {
    e.preventDefault()
    const errs = validar()
    if (errs.length) { setErros(errs); document.getElementById('erroBox')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
    setErros([])
    setEnviando(true)

    const texto = buildTexto()

    await supabase.from('orders').insert({
      nome: nome.trim(),
      telefone: telefone.replace(/\D/g, ''),
      cep: cep.replace(/\D/g, ''),
      cidade,
      estado,
      itens: ativos.map(p => ({ id: p.id, nome: p.nome, preco: p.preco, qty: qtys[p.id] ?? 0 })),
      total,
      obs: obs.trim(),
      entregue: false,
      ref: [bairro.trim(), `${logradouro.trim()}${complemento ? ', ' + complemento : ''}`, `CEP ${cep.trim()}`].filter(Boolean).join(' | '),
      pago: false,
      entrega: 'pendente',
      fonte: 'online',
    })

    const link = `https://wa.me/${WPP_LOJA}?text=${encodeURIComponent(texto)}`
    setWppLink(link)
    setSucTotal(total)
    setEnviando(false)
    setSucesso(true)
  }

  function novoPedido() {
    setSucesso(false); setQtys({}); setNome(''); setTelefone(''); setCep('')
    setLogradouro(''); setBairro(''); setComplemento(''); setObs(''); setErros([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* AVISO MODAL */}
      <div className={`aviso-lote-ov${aviso.ativo && !avisoFechado ? ' show' : ''}`}>
        <div className="aviso-lote-box">
          <div className="aviso-lote-top">
            <div style={{ fontSize: '3rem', marginBottom: 8 }}>⏳</div>
            <div className="aviso-lote-titulo" dangerouslySetInnerHTML={{ __html: aviso.titulo.replace(/\n/g, '<br>') }} />
          </div>
          <div className="aviso-lote-body">
            <p className="aviso-lote-msg" dangerouslySetInnerHTML={{ __html: aviso.mensagem.replace(/\n/g, '<br>') }} />
            <p className="aviso-lote-rodape">{aviso.rodape}</p>
            <button className="aviso-lote-btn" onClick={() => setAvisoFechado(true)}>ENTENDI ⚽</button>
          </div>
        </div>
      </div>

      {/* HERO */}
      <header className="hero">
        <span className="hero-ball">⚽</span>
        <div className="hero-badge">🏆 Copa do Mundo 2026</div>
        <h1>Monte seu pedido<br />Copa 2026</h1>
        <p>Escolha seus álbuns e pacotes de figurinhas e envie seu pedido de forma rápida.</p>
        <div className="hero-flags">🇧🇷 🇺🇸 🇨🇦 🇲🇽</div>
        <span className="hero-dec">🏟️</span>
      </header>

      <div className="aviso-itu">
        🏙️ Atendimento disponível somente para <span className="tag">Itu / SP</span>
      </div>

      <main>
        {/* PRODUTOS */}
        <div className="sec-title">🎴 Produtos</div>
        <div className="produtos-grid">
          {PRODUTOS.map(p => {
            const qty = qtys[p.id] ?? 0
            return (
              <div key={p.id} className={`prod-card${p.destaque ? ' destaque' : ''}${qty > 0 ? ' selected' : ''}`}>
                <div className="prod-qty-badge">{qty}</div>
                <span className="prod-emoji">{p.emoji}</span>
                <div className="prod-nome">{p.nome}</div>
                <div className="prod-preco">{fmt(p.preco)}</div>
                <div className="qty-ctrl">
                  <button className="qty-btn" onClick={() => setQty(p.id, qty - 1)}>−</button>
                  <input
                    type="number"
                    className="qty-num"
                    value={qty}
                    min={0}
                    inputMode="numeric"
                    onChange={e => setQty(p.id, parseInt(e.target.value))}
                    onBlur={e => { if (!e.target.value) setQty(p.id, 0) }}
                    onClick={e => (e.target as HTMLInputElement).select()}
                  />
                  <button className="qty-btn" onClick={() => setQty(p.id, qty + 1)}>+</button>
                </div>
              </div>
            )
          })}
        </div>

        {/* RESUMO */}
        <div className="sec-title">🧾 Resumo do pedido</div>
        <div className="resumo-box">
          <div>
            {ativos.length === 0
              ? <div className="resumo-vazio">Nenhum produto selecionado ainda.</div>
              : ativos.map(p => (
                <div key={p.id} className="resumo-item">
                  <div>
                    <div className="ri-nome">{p.emoji} {p.nome}</div>
                    <div className="ri-qtd">{qtys[p.id]}x {fmt(p.preco)} cada</div>
                  </div>
                  <div className="ri-sub">{fmt((qtys[p.id] ?? 0) * p.preco)}</div>
                </div>
              ))
            }
          </div>
          <div className="total-row">
            <span className="total-row-label">Total do pedido</span>
            <span className="total-row-val">{fmt(total)}</span>
          </div>
        </div>

        {/* DADOS */}
        <div className="sec-title">📋 Seus dados</div>
        {erros.length > 0 && (
          <div id="erroBox" className="erro-box show">
            {erros.map((e, i) => <span key={i}>⚠️ {e}<br /></span>)}
          </div>
        )}

        <form className="form-grid" onSubmit={enviarPedido}>
          <div className="fgroup">
            <label className="flabel">Nome completo *</label>
            <input type="text" className="finput" placeholder="Seu nome completo" value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" />
          </div>
          <div className="fgroup">
            <label className="flabel">WhatsApp *</label>
            <input type="tel" className="finput" placeholder="(11) 99999-9999" maxLength={15} value={telefone} onChange={e => setTelefone(maskFone(e.target.value))} autoComplete="tel" />
          </div>
          <div className="fgroup">
            <label className="flabel">CEP *</label>
            <input
              type="text"
              className={`finput${cepErro ? ' erro' : ''}`}
              placeholder="00000-000"
              maxLength={9}
              value={cep}
              onChange={e => { const v = maskCEP(e.target.value); setCep(v); lookupCEP(v) }}
            />
            <span className="fhint">Digite o CEP para preencher o endereço automaticamente</span>
          </div>
          <div className="fgroup">
            <label className="flabel">Endereço (rua e número) *</label>
            <input type="text" className="finput" placeholder="Rua Exemplo, 123" value={logradouro} onChange={e => setLogradouro(e.target.value)} autoComplete="address-line1" />
          </div>
          <div className="form-row-2">
            <div className="fgroup">
              <label className="flabel">Bairro *</label>
              <input type="text" className="finput" placeholder="Seu bairro" value={bairro} onChange={e => setBairro(e.target.value)} />
            </div>
            <div className="fgroup">
              <label className="flabel">Complemento</label>
              <input type="text" className="finput" placeholder="Apto, casa..." value={complemento} onChange={e => setComplemento(e.target.value)} />
            </div>
          </div>
          <div className="form-row-2">
            <div className="fgroup">
              <label className="flabel">Cidade</label>
              <input type="text" className="finput locked" value="Itu" disabled />
            </div>
            <div className="fgroup">
              <label className="flabel">Estado</label>
              <input type="text" className="finput locked" value="SP" disabled />
            </div>
          </div>
          <div className="fgroup">
            <label className="flabel">Observações do pedido</label>
            <textarea className="ftextarea" placeholder="Horário preferido, ponto de referência, forma de pagamento preferida..." value={obs} onChange={e => setObs(e.target.value)} />
          </div>

          {aviso.ativo && (
            <div className="lock-msg">
              🔒 <strong>Pedidos fechados no momento.</strong><br />Aguarde a abertura do próximo lote.
            </div>
          )}

          <button type="submit" className="btn-enviar" disabled={enviando || aviso.ativo}>
            {enviando
              ? <><span className="spinner" /> Enviando...</>
              : '⚽ ENVIAR PEDIDO'
            }
          </button>
        </form>
      </main>

      <footer>🏆 Vendas Copa 2026 · Itu/SP · Atendimento exclusivo para Itu/SP</footer>

      {/* TOTAL STICKY */}
      <div className="total-sticky">
        <div>
          <div className="total-sticky-label">Total do pedido</div>
          <div className="total-sticky-val">{fmt(total)}</div>
        </div>
        <span style={{ fontSize: '1.8rem' }}>⚽</span>
      </div>

      {/* SUCCESS */}
      <div className={`sucesso-overlay${sucesso ? ' show' : ''}`}>
        <div className="suc-icon">🏆</div>
        <div className="suc-title">Pedido enviado!</div>
        <div className="suc-msg">
          Recebemos seu pedido com sucesso!<br />
          Em breve entraremos em contato pelo WhatsApp para confirmar e combinar a entrega.
        </div>
        <div className="suc-total">
          <div className="suc-total-label">Valor do pedido</div>
          <div className="suc-total-val">{fmt(sucTotal)}</div>
        </div>
        <a href={wppLink} className="btn-wpp" target="_blank" rel="noopener noreferrer">
          💬 Confirmar pelo WhatsApp
        </a>
        <button className="btn-novo" onClick={novoPedido}>Fazer novo pedido</button>
      </div>

      {/* TOAST */}
      <div className={`toast${toastShow ? ' show' : ''}`}>{toast}</div>
    </div>
  )
}
