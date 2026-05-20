CREATE OR REPLACE FUNCTION public.bump_lead_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.leads SET updated_at = now() WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_bump_lead_updated_at ON public.messages;
CREATE TRIGGER messages_bump_lead_updated_at
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_lead_updated_at();