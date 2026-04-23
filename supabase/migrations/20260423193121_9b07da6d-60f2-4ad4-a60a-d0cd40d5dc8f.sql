CREATE TABLE public.processed_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL UNIQUE,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_processed_messages_message_id ON public.processed_messages(message_id);
CREATE INDEX idx_processed_messages_created_at ON public.processed_messages(created_at);

ALTER TABLE public.processed_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read processed_messages"
ON public.processed_messages FOR SELECT
USING (true);

CREATE POLICY "Allow public insert processed_messages"
ON public.processed_messages FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public delete processed_messages"
ON public.processed_messages FOR DELETE
USING (true);

-- Function to cleanup messages older than 7 days
CREATE OR REPLACE FUNCTION public.cleanup_old_processed_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.processed_messages
  WHERE created_at < now() - INTERVAL '7 days';
END;
$$;