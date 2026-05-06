# Vendas Copa 2026

Site de controle de vendas de figurinhas e álbuns da Copa do Mundo 2026.

## Stack

- React + Vite + TypeScript + Tailwind CSS
- Supabase (PostgreSQL + Realtime) para persistência e sync entre dispositivos
- TanStack Router (rotas: `/` e `/admin`)
- Hospedagem: Lovable Cloud (repo: ryangran/copa-ryan-2026)
- Deploy automático: push para `main` dispara rebuild no Lovable

## Estrutura

```
copa-ryan-2026/
├── src/
│   ├── components/
│   │   ├── AdminPage.tsx     # painel admin completo (login + gestão de pedidos)
│   │   └── OrderPage.tsx     # página de pedidos para clientes
│   ├── routes/
│   │   ├── index.tsx         # rota /  → OrderPage
│   │   └── admin.tsx         # rota /admin → AdminPage
│   ├── lib/
│   │   ├── types.ts          # tipos, constantes, PRODUTOS, PRECOS, CUSTOS
│   │   └── supabase.ts       # re-export do client Supabase
│   ├── integrations/supabase/
│   │   ├── client.ts         # client Supabase (lazy, com env vars)
│   │   └── types.ts          # tipos gerados do schema Supabase
│   └── copa.css              # CSS original (variáveis, hero, cards, admin)
├── .env                      # VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
└── CLAUDE.md                 # este arquivo
```

## Como fazer deploy

```bash
git add .
git commit -m "descrição da mudança"
git push
```

O Lovable detecta o push e publica automaticamente.

## Dados e preços

Definidos em `src/lib/types.ts`:

| Produto              | Venda    | Custo    |
|----------------------|----------|----------|
| Figurinha Pacote     | R$ 5,90  | R$ 5,60  |
| Álbum Capa Mole      | R$ 21,92 | R$ 19,92 |
| Álbum Capa Dura Norm | R$ 62,62 | R$ 59,62 |
| Álbum Capa Dura Prat | R$ 66,92 | R$ 63,92 |
| Álbum Capa Dura Ouro | R$ 67,92 | R$ 63,92 |

## Supabase

- URL: `https://thawbhzdgzfpltobaqoy.supabase.co`
- Tabelas: `orders` (pedidos), `config` (aviso/notificação)
- RLS: anon pode INSERT em orders (pedidos online), admin usa anon key com políticas abertas

## Admin

- URL: `/admin`
- Usuário: `Ryanzinkkj`
- Senha: `160206Ryan#`
- Sessão salva em `sessionStorage` com chave `copa_adm_v1`

## Chave Pix

- Chave: `61.986.179/0001-92`
- Beneficiário: `Ryan Granchelli`

## Regras importantes

- **Sempre fazer commit após alterações** — o Lovable só publica o que está no `main`
- Nunca commitar segredos (tokens, service role key)
- O `CLAUDE.md` deve ser mantido atualizado com mudanças de stack ou configuração
