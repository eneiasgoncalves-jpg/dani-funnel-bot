import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `Você é uma atendente virtual da Dani Locações, empresa de locação de brinquedos infláveis para festas e eventos.

REGRAS DE ATENDIMENTO:
- Linguagem simples, natural, estilo WhatsApp
- Amigável, educada e profissional
- Respostas curtas e diretas
- Nunca parecer robô
- Sempre fazer perguntas para avançar o atendimento
- Foco em conversão (venda)
- NUNCA informar preço sem antes coletar: data do evento, cidade/bairro, idade e quantidade de crianças

FLUXO:
1. Saudar e coletar: data do evento, cidade/bairro, idade das crianças, quantidade de crianças
2. Após coletar, sugerir brinquedos ideais com benefícios
3. Perguntar: "Quer que eu veja disponibilidade e valores para sua data?"
4. Se interessado, informar valores e condições
5. Se hesitar, oferecer alternativas/combos mais acessíveis
6. Se aceitar: "Perfeito! Vou reservar sua data agora 🙌 Vou te passar os próximos passos para garantir tudo certinho."
7. Se recusar: "Qualquer coisa, fico à disposição 😊"

PRODUTOS:
- Tobogã Inflável (R$350-500)
- Pula-Pula (R$200-300)
- Piscina de Bolinhas (R$150-250)
- Futebol de Sabão (R$300-400)
- Combo Básico: Pula-Pula + Piscina (R$300-450)
- Combo Completo: Tobogã + Pula-Pula + Piscina (R$600-800)

Todos incluem montagem, monitores e seguro.

IMPORTANTE: Responda APENAS com o texto da mensagem. Sem formatação markdown, sem asteriscos, sem bullet points. Texto puro como no WhatsApp.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Twilio sends form-encoded data
    const formData = await req.formData();
    const from = formData.get("From") as string; // whatsapp:+5511...
    const body = formData.get("Body") as string;
    const to = formData.get("To") as string;

    if (!from || !body) {
      return new Response("Missing params", { status: 400, headers: corsHeaders });
    }

    const phone = from.replace("whatsapp:", "");
    console.log(`Message from ${phone}: ${body}`);

    // Find or create lead
    let { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("phone", phone)
      .single();

    if (!lead) {
      const { data: newLead, error: insertErr } = await supabase
        .from("leads")
        .insert({ phone, name: "", channel: "whatsapp", status: "novo", tags: [] })
        .select()
        .single();

      if (insertErr) throw new Error(`Failed to create lead: ${insertErr.message}`);
      lead = newLead;
    }

    // Save incoming message
    await supabase.from("messages").insert({
      lead_id: lead.id,
      sender: "client",
      text: body,
    });

    // Get conversation history
    const { data: history } = await supabase
      .from("messages")
      .select("sender, text")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: true })
      .limit(20);

    const messages = (history || []).map((m) => ({
      role: m.sender === "client" ? "user" : "assistant",
      content: m.text,
    }));

    // Add current lead context
    const context = `Contexto do lead: Nome: ${lead.name || "não informado"}, Telefone: ${phone}, Data do evento: ${lead.event_date || "não informada"}, Cidade: ${lead.city || "não informada"}, Bairro: ${lead.neighborhood || "não informado"}, Idade das crianças: ${lead.children_age || "não informada"}, Qtd crianças: ${lead.children_count || "não informada"}, Interesse: ${lead.interest || "não informado"}, Status: ${lead.status}`;

    // Call AI
    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + "\n\n" + context },
          ...messages,
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "update_lead",
              description: "Update lead info extracted from conversation",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  event_date: { type: "string", description: "YYYY-MM-DD format" },
                  city: { type: "string" },
                  neighborhood: { type: "string" },
                  children_age: { type: "string" },
                  children_count: { type: "number" },
                  interest: { type: "string" },
                  new_status: { type: "string", enum: ["novo", "analise", "proposta", "contra_proposta", "fechado", "perdido"] },
                  tags: { type: "array", items: { type: "string", enum: ["quente", "duvida", "sensivel_preco", "frio"] } },
                },
              },
            },
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(`AI gateway error [${aiResponse.status}]: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const choice = aiData.choices?.[0];
    let replyText = choice?.message?.content || "Desculpe, tive um problema. Pode repetir? 😊";

    // Process tool calls (update lead data)
    if (choice?.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        if (tc.function?.name === "update_lead") {
          try {
            const updates = JSON.parse(tc.function.arguments);
            const leadUpdate: Record<string, unknown> = {};
            if (updates.name) leadUpdate.name = updates.name;
            if (updates.event_date) leadUpdate.event_date = updates.event_date;
            if (updates.city) leadUpdate.city = updates.city;
            if (updates.neighborhood) leadUpdate.neighborhood = updates.neighborhood;
            if (updates.children_age) leadUpdate.children_age = updates.children_age;
            if (updates.children_count) leadUpdate.children_count = updates.children_count;
            if (updates.interest) leadUpdate.interest = updates.interest;
            if (updates.new_status) leadUpdate.status = updates.new_status;
            if (updates.tags) leadUpdate.tags = updates.tags;

            if (Object.keys(leadUpdate).length > 0) {
              await supabase.from("leads").update(leadUpdate).eq("id", lead.id);
              console.log("Lead updated:", leadUpdate);
            }
          } catch (e) {
            console.error("Failed to parse tool call:", e);
          }
        }
      }
    }

    // Save AI response
    await supabase.from("messages").insert({
      lead_id: lead.id,
      sender: "ai",
      text: replyText,
    });

    // Send reply via Twilio WhatsApp
    const twilioResponse = await fetch(`${TWILIO_GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: from,
        From: to,
        Body: replyText,
      }),
    });

    if (!twilioResponse.ok) {
      const twilioErr = await twilioResponse.text();
      console.error("Twilio error:", twilioResponse.status, twilioErr);
    } else {
      const twilioData = await twilioResponse.json();
      console.log("Message sent:", twilioData.sid);
    }

    // Return TwiML empty response
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      }
    );
  }
});
