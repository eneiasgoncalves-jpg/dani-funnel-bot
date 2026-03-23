
-- Create enum types
CREATE TYPE public.lead_status AS ENUM ('novo', 'analise', 'proposta', 'contra_proposta', 'fechado', 'perdido');
CREATE TYPE public.lead_tag AS ENUM ('quente', 'duvida', 'sensivel_preco', 'frio');
CREATE TYPE public.sales_channel AS ENUM ('whatsapp', 'instagram', 'google', 'site', 'indicacao');

-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  event_date DATE,
  city TEXT DEFAULT '',
  neighborhood TEXT DEFAULT '',
  children_age TEXT DEFAULT '',
  children_count INTEGER DEFAULT 0,
  interest TEXT DEFAULT '',
  status public.lead_status NOT NULL DEFAULT 'novo',
  channel public.sales_channel NOT NULL DEFAULT 'whatsapp',
  tags public.lead_tag[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('client', 'ai')),
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (webhook needs access without auth)
CREATE POLICY "Allow public read leads" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Allow public insert leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update leads" ON public.leads FOR UPDATE USING (true);

CREATE POLICY "Allow public read messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Allow public insert messages" ON public.messages FOR INSERT WITH CHECK (true);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
