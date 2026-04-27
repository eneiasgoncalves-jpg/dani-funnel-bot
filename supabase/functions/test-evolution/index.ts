const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("EVOLUTION_API_URL")!.replace(/\/+$/, "");
  const key = Deno.env.get("EVOLUTION_API_KEY")!;
  const inst = Deno.env.get("EVOLUTION_INSTANCE_NAME")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
  const result: Record<string, unknown> = { url, instance: inst, webhookUrl };

  // Allow ?action=set-webhook to reconfigure
  const reqUrl = new URL(req.url);
  const action = reqUrl.searchParams.get("action");

  try {
    const r1 = await fetch(`${url}/instance/connectionState/${inst}`, { headers: { apikey: key } });
    result.connectionState = { status: r1.status, body: await r1.text() };
  } catch (e) { result.connectionStateError = String(e); }

  try {
    const r2 = await fetch(`${url}/instance/fetchInstances`, { headers: { apikey: key } });
    const txt = await r2.text();
    result.fetchInstances = { status: r2.status, body: txt.slice(0, 1500) };
  } catch (e) { result.fetchInstancesError = String(e); }

  // Inspect current webhook config
  try {
    const r3 = await fetch(`${url}/webhook/find/${inst}`, { headers: { apikey: key } });
    result.webhookFind = { status: r3.status, body: (await r3.text()).slice(0, 2000) };
  } catch (e) { result.webhookFindError = String(e); }

  // Optionally (re)set the webhook with the right events
  if (action === "set-webhook") {
    const events = [
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "CONNECTION_UPDATE",
      "PRESENCE_UPDATE",
    ];
    const payload = {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events,
      },
    };
    try {
      const r4 = await fetch(`${url}/webhook/set/${inst}`, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      result.webhookSet = { status: r4.status, body: (await r4.text()).slice(0, 2000) };
    } catch (e) { result.webhookSetError = String(e); }
  }

  if (action === "restart") {
    try {
      const r5 = await fetch(`${url}/instance/restart/${inst}`, {
        method: "POST",
        headers: { apikey: key },
      });
      result.restart = { status: r5.status, body: (await r5.text()).slice(0, 1000) };
    } catch (e) { result.restartError = String(e); }
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
