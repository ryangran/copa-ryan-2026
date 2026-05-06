
CREATE TABLE public.orders (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  cep TEXT NOT NULL,
  cidade TEXT NOT NULL DEFAULT 'Itu',
  estado TEXT NOT NULL DEFAULT 'SP',
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC NOT NULL DEFAULT 0,
  obs TEXT DEFAULT '',
  entregue BOOLEAN NOT NULL DEFAULT false,
  ref TEXT DEFAULT '',
  pago BOOLEAN NOT NULL DEFAULT false,
  entrega TEXT NOT NULL DEFAULT 'pendente',
  fonte TEXT NOT NULL DEFAULT 'online'
);

CREATE TABLE public.config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Insert default aviso config
INSERT INTO public.config (key, value) VALUES (
  'aviso',
  '{"ativo": false, "titulo": "Pedidos\nIndisponíveis", "mensagem": "No momento não estamos aceitando novos pedidos.\n\nEm breve abriremos o 3º lote de pedidos — fique ligado!", "rodape": "Acompanhe o grupo para saber quando abrir."}'::jsonb
);

-- Allow public read on config
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read config" ON public.config FOR SELECT USING (true);
CREATE POLICY "Anyone can update config" ON public.config FOR UPDATE USING (true);

-- Allow public insert on orders, read for admin
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Anyone can update orders" ON public.orders FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete orders" ON public.orders FOR DELETE USING (true);

-- Enable realtime for config changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.config;
