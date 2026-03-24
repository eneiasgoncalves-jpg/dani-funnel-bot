
CREATE TABLE public.leads_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_whatsapp text NOT NULL,
  cidade text,
  plataforma text NOT NULL DEFAULT 'Orgânico',
  status text NOT NULL DEFAULT 'aberto',
  data_entrada timestamp with time zone NOT NULL DEFAULT now(),
  data_fechamento timestamp with time zone,
  valor_contrato numeric DEFAULT 0
);

ALTER TABLE public.leads_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on leads_analytics"
  ON public.leads_analytics FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on leads_analytics"
  ON public.leads_analytics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on leads_analytics"
  ON public.leads_analytics FOR UPDATE
  USING (true);
