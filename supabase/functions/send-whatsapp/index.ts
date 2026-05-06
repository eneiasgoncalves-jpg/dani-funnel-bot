import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function resolveRecipient(
  phone: string,
  baseUrl: string,
  apiKey: string,
  instance: string,
): Promise<string> {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 13) return digits;

  // Likely a @lid identifier — resolve to real phone via Evolution.
  const lidJid = `${digits}@lid`;
  try {
    const res = await fetch(`${baseUrl}/chat/findContacts/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ where: { id: lidJid } }),
    });
    if (res.ok) {
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      for (const c of arr) {
        const candidates = [c?.remoteJid, c?.jid, c?.id];
        for (const cand of candidates) {
          if (typeof cand === "string" && cand.includes("@s.whatsapp.net")) {
            const realDigits = cand.replace(/@.+$/, "").replace(/\D/g, "");
            if (realDigits) return realDigits;
          }
        }
      }
    } else {
      console.warn("findContacts non-OK:", res.status, await res.text());
    }
  } catch (e) {
    console.warn("findContacts error:", e);
  }
  return lidJid;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  const EVOLUTION_INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME")?.trim();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
    return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { leadId, text } = await req.json();

    if (!leadId || !text) {
      return new Response(JSON.stringify({ error: "leadId and text are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("phone")
      .eq("id", leadId)
      .single();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
    const number = await resolveRecipient(lead.phone, baseUrl, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME);
    const evolutionUrl = `${baseUrl}/message/sendText/${EVOLUTION_INSTANCE_NAME}`;
    console.log("Sending to Evolution:", evolutionUrl, "number:", number);

    const evoResponse = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number,
        text,
      }),
    });

    if (!evoResponse.ok) {
      const evoErr = await evoResponse.text();
      console.error("Evolution API error:", evoResponse.status, evoErr);
      return new Response(JSON.stringify({ error: "Failed to send WhatsApp message", details: evoErr }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evoData = await evoResponse.json();
    console.log("Message sent via Evolution:", JSON.stringify(evoData));

    const evolutionId =
      evoData?.key?.id ||
      evoData?.messageId ||
      evoData?.id ||
      null;

    await supabase.from("messages").insert({
      lead_id: leadId,
      sender: "ai",
      text,
      evolution_id: evolutionId,
    });

    return new Response(JSON.stringify({ status: "sent", evolution: evoData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send WhatsApp error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});