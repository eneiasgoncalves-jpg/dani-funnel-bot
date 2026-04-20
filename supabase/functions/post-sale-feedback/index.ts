import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  const EVOLUTION_INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME")?.trim();

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
    return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Find leads with status 'fechado', feedback not sent, and event_date <= 24h ago
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const cutoffDate = twentyFourHoursAgo.toISOString().split("T")[0]; // YYYY-MM-DD

    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, name, phone, event_date")
      .eq("status", "fechado")
      .eq("feedback_sent", false)
      .not("event_date", "is", null)
      .lte("event_date", cutoffDate);

    if (error) throw error;

    console.log(`Found ${leads?.length || 0} leads eligible for feedback`);

    let sent = 0;
    let errors = 0;

    for (const lead of leads || []) {
      const feedbackMessage =
        `Olá${lead.name ? `, ${lead.name}` : ""}! 🎉\n\n` +
        `Esperamos que a festa tenha sido incrível! Foi um prazer fazer parte desse momento especial. 🎈✨\n\n` +
        `Gostaríamos muito de saber como foi a sua experiência com a Dani Locações. Sua opinião é muito importante para nós!\n\n` +
        `Deixe sua avaliação aqui: https://g.co/kgs/i7NjifN ⭐\n\n` +
        `Muito obrigada pela confiança! 💛`;

      // Send via Evolution API
      const remoteJid = lead.phone.replace("+", "") + "@s.whatsapp.net";
      const evolutionUrl = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`;

      try {
        const evoResponse = await fetch(evolutionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EVOLUTION_API_KEY,
          },
          body: JSON.stringify({
            number: remoteJid,
            text: feedbackMessage,
          }),
        });

        if (evoResponse.ok) {
          // Mark as sent
          await supabase
            .from("leads")
            .update({ feedback_sent: true })
            .eq("id", lead.id);

          // Save message in history
          await supabase.from("messages").insert({
            lead_id: lead.id,
            sender: "ai",
            text: feedbackMessage,
          });

          sent++;
          console.log(`Feedback sent to ${lead.phone}`);
        } else {
          const errText = await evoResponse.text();
          console.error(`Failed to send to ${lead.phone}:`, errText);
          errors++;
        }
      } catch (e) {
        console.error(`Error sending to ${lead.phone}:`, e);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ status: "ok", sent, errors, total: leads?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Post-sale feedback error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ status: "error", message: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
