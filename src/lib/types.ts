export interface Item {
  id: string
  nome: string
  preco: number
  qty: number
}

export interface Order {
  id: number
  created_at: string
  nome: string
  telefone: string
  cep: string
  cidade: string
  estado: string
  itens: Item[]
  total: number
  obs: string
  entregue: boolean
  ref: string
  pago: boolean
  entrega: string
  fonte: string
}

export interface AvisoConfig {
  ativo: boolean
  titulo: string
  mensagem: string
  rodape: string
}

export const PRODUTOS = [
  { id: 'pacote',         nome: 'Figurinha Pacote',       emoji: '🎴', preco: 5.90,  destaque: true  },
  { id: 'capaDuraOuro',   nome: 'Álbum Capa Dura Ouro ✨', emoji: '🥇', preco: 67.92, destaque: false },
  { id: 'capaDuraPrata',  nome: 'Álbum Capa Dura Prata',   emoji: '🥈', preco: 66.92, destaque: false },
  { id: 'capaDuraNormal', nome: 'Álbum Capa Dura Normal',  emoji: '📚', preco: 62.62, destaque: false },
  { id: 'capaMole',       nome: 'Álbum Capa Mole',         emoji: '📗', preco: 21.92, destaque: false },
]

export const PRECOS: Record<string, number> = {
  pacote: 5.90, capaMole: 21.92, capaDuraNormal: 62.62, capaDuraPrata: 66.92, capaDuraOuro: 67.92,
}

export const CUSTOS: Record<string, number> = {
  pacote: 5.60, capaMole: 19.92, capaDuraNormal: 59.62, capaDuraPrata: 63.92, capaDuraOuro: 63.92,
}

export const TIPO_LABEL: Record<string, string> = {
  capaMole: 'Álbum Capa Mole',
  capaDuraNormal: 'Álbum Capa Dura Normal',
  capaDuraPrata: 'Álbum Capa Dura Prata',
  capaDuraOuro: 'Álbum Capa Dura Ouro ✨',
  pacote: 'Figurinha Pacote',
}

export const WPP_LOJA = '5511944804280'
export const PIX_CHAVE = '61.986.179/0001-92'
export const PIX_NOME = 'Ryan Granchelli'

export const AVISO_DEFAULT: AvisoConfig = {
  ativo: false,
  titulo: 'Pedidos\nIndisponíveis',
  mensagem: 'No momento não estamos aceitando novos pedidos.\n\nEm breve abriremos o 3º lote de pedidos — fique ligado!',
  rodape: 'Acompanhe o grupo para saber quando abrir.',
}

export function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function calcTotal(itens: Item[]) {
  return itens.reduce((s, i) => s + i.preco * i.qty, 0)
}

export function calcCusto(itens: Item[]) {
  return itens.reduce((s, i) => s + (CUSTOS[i.id] ?? i.preco) * i.qty, 0)
}
