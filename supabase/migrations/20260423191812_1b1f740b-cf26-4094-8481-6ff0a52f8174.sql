CREATE TABLE public.lid_mappings (
  lid TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lid_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read lid_mappings"
ON public.lid_mappings FOR SELECT
USING (true);

CREATE POLICY "Allow public insert lid_mappings"
ON public.lid_mappings FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update lid_mappings"
ON public.lid_mappings FOR UPDATE
USING (true);