import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TRANSFERRED_STATUSES = ["analise", "proposta", "contra_proposta", "fechado", "perdido"] as const;

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

type JsonRecord = Record<string, unknown>;
type LeadRow = {
  id: string;
  name: string;
  phone: string;
  event_date: string | null;
  city: string | null;
  neighborhood: string | null;
  children_age: string | null;
  children_count: number | null;
  interest: string | null;
  status: string;
  tags: string[] | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function extractMessageText(message: JsonRecord): string {
  const directText = [
    message.conversation,
    asRecord(message.extendedTextMessage).text,
    asRecord(message.imageMessage).caption,
    asRecord(message.videoMessage).caption,
    asRecord(message.documentMessage).caption,
    asRecord(message.buttonsResponseMessage).selectedDisplayText,
    asRecord(message.listResponseMessage).title,
    asRecord(message.templateButtonReplyMessage).selectedDisplayText,
  ];

  for (const candidate of directText) {
    const text = getString(candidate);
    if (text) return text;
  }

  return "";
}

function normalizeRemoteJid(rawJid: string, sender: string): string {
  if (rawJid.includes("@lid")) {
    return getString(sender);
  }

  return rawJid;
}

function extractPhoneFromJid(jid: string): string {
  const digits = jid.replace(/@.+$/, "").replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function normalizeLeadPhone(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return [];

  const withPlus = `+${digits}`;
  return Array.from(new Set([withPlus, digits]));
}

async function findOrCreateLead(supabase: any, phone: string, pushName: string) {
  const phoneVariants = normalizeLeadPhone(phone);

  const { data: existingLead, error: lookupError } = await supabase
    .from("leads")
    .select("*")
    .in("phone", phoneVariants)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Erro ao buscar lead: ${lookupError.message}`);
  }

  if (existingLead) {
    const updates: JsonRecord = {};
    if (pushName && !existingLead.name) updates.name = pushName;
    if (existingLead.phone !== phone) updates.phone = phone;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase.from("leads").update(updates).eq("id", existingLead.id);
      if (updateError) {
        throw new Error(`Erro ao atualizar lead: ${updateError.message}`);
      }
      return { ...existingLead, ...updates } as LeadRow;
    }

    return existingLead as LeadRow;
  }

  const { data: newLead, error: insertError } = await supabase
    .from("leads")
    .insert({
      phone,
      name: pushName || phone,
      channel: "whatsapp",
      status: "novo",
      tags: [],
    })
    .select("*")
    .single();

  if (insertError || !newLead) {
    throw new Error(`Erro ao criar lead: ${insertError?.message ?? "Lead não criado"}`);
  }

  return newLead as LeadRow;
}

async function saveMessage(
  supabase: any,
  leadId: string,
  sender: "client" | "ai",
  text: string,
) {
  const { error } = await supabase.from("messages").insert({
    lead_id: leadId,
    sender,
    text,
  });

  if (error) {
    throw new Error(`Erro ao salvar mensagem (${sender}): ${error.message}`);
  }
}

async function getAutoAttendanceEnabled(supabase: any) {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "auto_attendance")
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar configuração de atendimento automático: ${error.message}`);
  }

  return data?.value === true;
}

async function buildAiReply(
  supabase: any,
  lead: LeadRow,
  phone: string,
  lovableApiKey: string,
) {
  const { data: history, error: historyError } = await supabase
    .from("messages")
    .select("sender, text")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: true })
    .limit(20);

  if (historyError) {
    throw new Error(`Erro ao buscar histórico: ${historyError.message}`);
  }

  const messages = (history || []).map((message) => ({
    role: message.sender === "client" ? "user" : "assistant",
    content: message.text,
  }));

  const context = `Contexto do lead: Nome: ${lead.name || "não informado"}, Telefone: ${phone}, Data do evento: ${lead.event_date || "não informada"}, Cidade: ${lead.city || "não informada"}, Bairro: ${lead.neighborhood || "não informado"}, Idade das crianças: ${lead.children_age || "não informada"}, Qtd crianças: ${lead.children_count || "não informada"}, Interesse: ${lead.interest || "não informado"}, Status: ${lead.status}`;

  const aiResponse = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n${context}` },
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
    const errorText = await aiResponse.text();
    throw new Error(`AI gateway error [${aiResponse.status}]: ${errorText}`);
  }

  const aiData = await aiResponse.json();
  const choice = aiData.choices?.[0];
  let replyText = getString(choice?.message?.content) || "Desculpe, tive um problema. Pode repetir? 😊";

  if (choice?.message?.tool_calls) {
    for (const toolCall of choice.message.tool_calls) {
      if (toolCall.function?.name !== "update_lead") continue;

      try {
        const updates = JSON.parse(toolCall.function.arguments);
        const leadUpdate: JsonRecord = {};
        if (getString(updates.name)) leadUpdate.name = getString(updates.name);
        if (getString(updates.event_date)) leadUpdate.event_date = getString(updates.event_date);
        if (getString(updates.city)) leadUpdate.city = getString(updates.city);
        if (getString(updates.neighborhood)) leadUpdate.neighborhood = getString(updates.neighborhood);
        if (getString(updates.children_age)) leadUpdate.children_age = getString(updates.children_age);
        if (typeof updates.children_count === "number") leadUpdate.children_count = updates.children_count;
        if (getString(updates.interest)) leadUpdate.interest = getString(updates.interest);
        if (getString(updates.new_status)) leadUpdate.status = getString(updates.new_status);
        if (Array.isArray(updates.tags)) leadUpdate.tags = updates.tags;

        if (Object.keys(leadUpdate).length > 0) {
          const { error: updateError } = await supabase.from("leads").update(leadUpdate).eq("id", lead.id);
          if (updateError) {
            throw new Error(updateError.message);
          }
        }
      } catch (error) {
        console.error("Failed to parse/update lead from tool call:", error);
      }
    }
  }

  const transferToHuman = replyText.includes("[TRANSFER_TO_HUMAN]");
  if (transferToHuman) {
    replyText = replyText.replace("[TRANSFER_TO_HUMAN]", "").trim();
    const { error: updateError } = await supabase.from("leads").update({ status: "analise" }).eq("id", lead.id);
    if (updateError) {
      throw new Error(`Erro ao transferir lead para humano: ${updateError.message}`);
    }
  }

  return replyText;
}

async function sendWhatsappReply(remoteJid: string, text: string, url: string, apiKey: string, instanceName: string) {
  const response = await fetch(`${url}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify({
      number: remoteJid,
      textMessage: { text },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Evolution API error [${response.status}]: ${errorText}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  const EVOLUTION_INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !LOVABLE_API_KEY || !EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
    return jsonResponse({ error: "Missing required environment variables" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const payload = await req.json();
    console.log("Evolution webhook payload:", JSON.stringify(payload));

    const event = getString(payload?.event);
    if (event !== "messages.upsert") {
      return jsonResponse({ status: "ignored", event });
    }

    const data = asRecord(payload?.data);
    const message = asRecord(data.message);
    const key = asRecord(data.key);
    const senderFromPayload = getString(payload?.sender);
    const rawRemoteJid = getString(key.remoteJid);
    const remoteJid = normalizeRemoteJid(rawRemoteJid, senderFromPayload);
    const phone = extractPhoneFromJid(remoteJid);
    const pushName = getString(data.pushName);
    const messageText = extractMessageText(message);

    if (key.fromMe === true) {
      return jsonResponse({ status: "skipped_own" });
    }

    if (!phone) {
      return jsonResponse({ status: "ignored", reason: "sender_not_found" }, 400);
    }

    if (!messageText) {
      const leadWithoutMessage = await findOrCreateLead(supabase, phone, pushName);
      return jsonResponse({ status: "lead_saved_without_text", leadId: leadWithoutMessage.id });
    }

    const lead = await findOrCreateLead(supabase, phone, pushName);
    await saveMessage(supabase, lead.id, "client", messageText);

    const autoAttendanceEnabled = await getAutoAttendanceEnabled(supabase);
    if (!autoAttendanceEnabled) {
      return jsonResponse({ status: "saved_only", leadId: lead.id });
    }

    if (TRANSFERRED_STATUSES.includes(lead.status as typeof TRANSFERRED_STATUSES[number])) {
      return jsonResponse({ status: "already_transferred", leadId: lead.id });
    }

    const replyText = await buildAiReply(supabase, lead, phone, LOVABLE_API_KEY);
    await saveMessage(supabase, lead.id, "ai", replyText);
    await sendWhatsappReply(remoteJid, replyText, EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME);

    return jsonResponse({ status: "ok", leadId: lead.id, reply: replyText });
  } catch (error) {
    console.error("Webhook error:", error);
    return jsonResponse({ status: "error", message: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
