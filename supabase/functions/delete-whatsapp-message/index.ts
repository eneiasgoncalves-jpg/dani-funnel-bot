import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  const EVOLUTION_INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME")?.trim();

  try {
    const { messageId, scope } = await req.json();
    if (!messageId || !["me", "everyone"].includes(scope)) {
      return new Response(JSON.stringify({ error: "messageId and scope (me|everyone) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: msg } = await supabase
      .from("messages")
      .select("id, lead_id, evolution_id, sender, leads(phone)")
      .eq("id", messageId)
      .maybeSingle();

    if (!msg) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (scope === "everyone") {
      if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
        return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!msg.evolution_id) {
        return new Response(
          JSON.stringify({ error: "Mensagem sem ID do WhatsApp; só é possível excluir para mim." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const phone = (msg as any).leads?.phone || "";
      const digits = phone.replace(/\D/g, "");
      const remoteJid = digits.length > 13 ? `${digits}@lid` : `${digits}@s.whatsapp.net`;
      const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");

      const evoRes = await fetch(`${baseUrl}/chat/deleteMessageForEveryone/${EVOLUTION_INSTANCE_NAME}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({
          id: msg.evolution_id,
          remoteJid,
          fromMe: true,
          participant: remoteJid,
        }),
      });
      const bodyTxt = await evoRes.text();
      console.log("Delete for everyone:", evoRes.status, bodyTxt);
      if (!evoRes.ok) {
        return new Response(
          JSON.stringify({ error: "Falha ao excluir no WhatsApp", details: bodyTxt }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    await supabase.from("messages").delete().eq("id", messageId);

    return new Response(JSON.stringify({ status: "deleted", scope }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});