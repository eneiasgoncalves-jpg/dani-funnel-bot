CREATE POLICY "Allow public delete messages" ON public.messages FOR DELETE USING (true);
CREATE POLICY "Allow public delete leads" ON public.leads FOR DELETE USING (true);