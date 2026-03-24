CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'true'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Allow public update on settings" ON public.settings FOR UPDATE USING (true);

INSERT INTO public.settings (key, value) VALUES ('auto_attendance', 'true'::jsonb);