CREATE TABLE public.catalog_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(10,2) DEFAULT 0,
  image_url TEXT,
  category TEXT DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read catalog_items" ON public.catalog_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert catalog_items" ON public.catalog_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update catalog_items" ON public.catalog_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete catalog_items" ON public.catalog_items FOR DELETE USING (true);

CREATE TRIGGER catalog_items_updated_at
BEFORE UPDATE ON public.catalog_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_catalog_items_active ON public.catalog_items(active, sort_order);