import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("EVOLUTION_API_URL")!.replace(/\/+$/, "");
  const key = Deno.env.get("EVOLUTION_API_KEY")!;
  const inst = Deno.env.get("EVOLUTION_INSTANCE_NAME")!;
  const result: Record<string, unknown> = { url, instance: inst };

  try {
    const r1 = await fetch(`${url}/instance/connectionState/${inst}`, { headers: { apikey: key } });
    result.connectionState = { status: r1.status, body: await r1.text() };
  } catch (e) { result.connectionStateError = String(e); }

  try {
    const r2 = await fetch(`${url}/instance/fetchInstances`, { headers: { apikey: key } });
    const txt = await r2.text();
    result.fetchInstances = { status: r2.status, body: txt.slice(0, 1500) };
  } catch (e) { result.fetchInstancesError = String(e); }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
