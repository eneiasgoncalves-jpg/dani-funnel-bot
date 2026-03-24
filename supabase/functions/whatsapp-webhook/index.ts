import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `Você é a assistente virtual da Dani Locações, empresa de locação de brinquedos para festas e eventos no Rio Grande do Sul.

Tom: Prestativo, profissional e alegre. Linguagem simples e natural (estilo WhatsApp). Respostas curtas e diretas.

FLUXO DE ATENDIMENTO (siga na ordem):

PASSO 1 - Saudação e tipo de evento:
- Cumprimente o cliente com simpatia
- Pergunte qual o tipo de evento (aniversário, festa infantil, evento corporativo, etc.)

PASSO 2 - Filtro de localização:
- Pergunte a cidade/bairro do evento
- Cidades permitidas para festas particulares: Cachoeirinha, Gravataí, Canoas e Nova Santa Rita
- Se a cidade NÃO estiver na lista E o evento NÃO for corporativo, informe: "Atendemos festas particulares exclusivamente em Cachoeirinha, Gravataí, Canoas e Nova Santa Rita. Para outras regiões, atendemos apenas eventos corporativos."
- Se o evento for CORPORATIVO, aceite qualquer cidade do RS

PASSO 3 - Coleta de dados da festa:
- Para aniversários: pergunte a idade do aniversariante
- Para todos os eventos: pergunte o horário de início e a quantidade de crianças
- Pergunte também a data do evento

PASSO 4 - Seleção de brinquedos:
- Pergunte se o cliente já tem ideia dos brinquedos que deseja
- Se não tiver, sugira que visite nosso catálogo: https://www.danilocacoes.com.br
- Ajude a escolher com base na idade e quantidade de crianças

PASSO 5 - Finalização e transferência:
- Quando tiver todas as informações (cidade, data, horário, crianças, brinquedos de interesse), finalize com:
  "Vou passar agora para uma de nossas atendentes montar seu orçamento e concluir o pedido. Um instante! 😊"
- IMPORTANTE: Inclua o texto exato [TRANSFER_TO_HUMAN] no final da sua resposta quando for transferir.

REGRAS:
- NUNCA invente preços ou valores. Apenas a atendente humana pode informar preços.
- Sempre faça perguntas para avançar o atendimento
- Foco em coleta de informações para facilitar o trabalho da atendente humana
- Responda APENAS com texto puro. Sem markdown, sem asteriscos, sem bullet points.
- Se o cliente já foi transferido para humano (status em_analise ou posterior), NÃO responda mais.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  const EVOLUTION_INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!EVOLUTION_API_URL) throw new Error("EVOLUTION_API_URL is not configured");
  if (!EVOLUTION_API_KEY) throw new Error("EVOLUTION_API_KEY is not configured");
  if (!EVOLUTION_INSTANCE_NAME) throw new Error("EVOLUTION_INSTANCE_NAME is not configured");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const payload = await req.json();
    console.log("Evolution webhook payload:", JSON.stringify(payload));

    // Evolution API sends different event types
    const event = payload.event;
    
    // Only process incoming messages
    if (event !== "messages.upsert") {
      console.log("Ignoring event:", event);
      return new Response(JSON.stringify({ status: "ignored", event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = payload.data;
    if (!data) {
      return new Response(JSON.stringify({ status: "no data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip messages sent by the bot itself
    if (data.key?.fromMe) {
      console.log("Skipping own message");
      return new Response(JSON.stringify({ status: "skipped_own" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if auto attendance is enabled
    const { data: setting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "auto_attendance")
      .single();

    if (!setting || setting.value !== true) {
      console.log("Auto attendance is disabled, saving message only");
      
      // Still save the message even if auto attendance is off
      const phone = "+" + (data.key?.remoteJid || "").replace("@s.whatsapp.net", "").replace("@g.us", "");
      const messageText = data.message?.conversation || data.message?.extendedTextMessage?.text || "";
      const pushName = data.pushName || "";
      
      if (messageText) {
        let { data: lead } = await supabase.from("leads").select("*").eq("phone", phone).single();
        if (!lead) {
          const { data: newLead } = await supabase.from("leads")
            .insert({ phone, name: pushName || "", channel: "whatsapp", status: "novo", tags: [] })
            .select().single();
          lead = newLead;
        }
        if (lead) {
          await supabase.from("messages").insert({ lead_id: lead.id, sender: "client", text: messageText });
        }
      }

      return new Response(JSON.stringify({ status: "auto_attendance_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const messageText = data.message?.conversation 
      || data.message?.extendedTextMessage?.text
      || "";
    
    if (!messageText) {
      console.log("No text in message, skipping");
      return new Response(JSON.stringify({ status: "no_text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract phone number (remoteJid format: 5511999999999@s.whatsapp.net)
    const remoteJid = data.key?.remoteJid || "";
    const phone = "+" + remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
    const pushName = data.pushName || "";

    console.log(`Message from ${phone} (${pushName}): ${messageText}`);

    // Find or create lead
    let { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("phone", phone)
      .single();

    if (!lead) {
      const { data: newLead, error: insertErr } = await supabase
        .from("leads")
        .insert({ 
          phone, 
          name: pushName || "", 
          channel: "whatsapp", 
          status: "novo", 
          tags: [] 
        })
        .select()
        .single();

      if (insertErr) throw new Error(`Failed to create lead: ${insertErr.message}`);
      lead = newLead;
    } else if (pushName && !lead.name) {
      // Update name if we got it from pushName
      await supabase.from("leads").update({ name: pushName }).eq("id", lead.id);
      lead.name = pushName;
    }

    // Save incoming message
    await supabase.from("messages").insert({
      lead_id: lead.id,
      sender: "client",
      text: messageText,
    });

    // Post-transfer logic: if lead was already transferred to human, don't auto-respond
    const transferredStatuses = ["analise", "proposta", "contra_proposta", "fechado", "perdido"];
    if (transferredStatuses.includes(lead.status)) {
      console.log(`Lead ${lead.id} already transferred (status: ${lead.status}), skipping AI`);
      return new Response(JSON.stringify({ status: "already_transferred" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Detect transfer command and update status
    const isTransfer = replyText.includes("[TRANSFER_TO_HUMAN]");
    if (isTransfer) {
      replyText = replyText.replace("[TRANSFER_TO_HUMAN]", "").trim();
      await supabase.from("leads").update({ status: "analise" }).eq("id", lead.id);
      console.log(`Lead ${lead.id} transferred to human, status changed to analise`);
    }

    // Save AI response
    await supabase.from("messages").insert({
      lead_id: lead.id,
      sender: "ai",
      text: replyText,
    });

    // Send reply via Evolution API
    const evolutionUrl = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`;
    console.log("Sending to Evolution:", evolutionUrl);

    const evolutionResponse = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: remoteJid,
        textMessage: { text: replyText },
      }),
    });

    if (!evolutionResponse.ok) {
      const evoErr = await evolutionResponse.text();
      console.error("Evolution API error:", evolutionResponse.status, evoErr);
    } else {
      const evoData = await evolutionResponse.json();
      console.log("Message sent via Evolution:", JSON.stringify(evoData));
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ status: "error", message: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
