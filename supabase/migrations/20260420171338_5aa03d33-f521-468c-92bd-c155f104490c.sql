CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  cidade TEXT,
  bairro TEXT,
  endereco_completo TEXT,
  cep TEXT,
  data_nascimento DATE,
  observacoes TEXT,
  valor_contrato NUMERIC DEFAULT 0,
  data_evento DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read clientes" ON public.clientes FOR SELECT USING (true);
CREATE POLICY "Allow public insert clientes" ON public.clientes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update clientes" ON public.clientes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete clientes" ON public.clientes FOR DELETE USING (true);

CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_clientes_telefone ON public.clientes(telefone);
CREATE INDEX idx_clientes_lead_id ON public.clientes(lead_id);