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

type IncomingMessage = {
  messageId: string;
  remoteJid: string;
  phone: string;
  pushName: string;
  text: string;
  fromMe: boolean;
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

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEventName(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, ".");
}

function unwrapMessageContainer(message: JsonRecord): JsonRecord {
  const wrapperKeys = [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
    "documentWithCaptionMessage",
  ];

  for (const key of wrapperKeys) {
    const nested = asRecord(message[key]);
    const nestedMessage = asRecord(nested.message);
    if (Object.keys(nestedMessage).length > 0) {
      return unwrapMessageContainer(nestedMessage);
    }
  }

  return message;
}

function extractMessageText(rawMessage: JsonRecord): string {
  const message = unwrapMessageContainer(rawMessage);
  const interactiveResponse = asRecord(message.interactiveResponseMessage);
  const listResponse = asRecord(message.listResponseMessage);
  const templateMessage = asRecord(message.templateMessage);
  const hydratedTemplate = asRecord(templateMessage.hydratedTemplate);
  const buttonsResponse = asRecord(message.buttonsResponseMessage);
  const templateButtonReply = asRecord(message.templateButtonReplyMessage);

  const directText = [
    message.conversation,
    asRecord(message.extendedTextMessage).text,
    asRecord(message.imageMessage).caption,
    asRecord(message.videoMessage).caption,
    asRecord(message.documentMessage).caption,
    buttonsResponse.selectedDisplayText,
    buttonsResponse.selectedButtonId,
    listResponse.title,
    asRecord(listResponse.singleSelectReply).selectedRowId,
    templateButtonReply.selectedDisplayText,
    templateButtonReply.selectedId,
    asRecord(message.buttonsMessage).contentText,
    hydratedTemplate.hydratedContentText,
    asRecord(interactiveResponse.body).text,
  ];

  for (const candidate of directText) {
    const text = getString(candidate);
    if (text) return text;
  }

  const paramsJson = getString(asRecord(interactiveResponse.nativeFlowResponseMessage).paramsJson);
  if (paramsJson) {
    try {
      const parsed = JSON.parse(paramsJson);
      const selectedText = getString(parsed?.title) || getString(parsed?.id);
      if (selectedText) return selectedText;
    } catch {
      // ignore invalid JSON
    }
  }

  return "";
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

function buildMessageCandidates(payload: JsonRecord): JsonRecord[] {
  const data = payload.data;
  if (Array.isArray(data)) {
    return data.map(asRecord);
  }

  const dataRecord = asRecord(data);
  const nestedMessages = asArray(dataRecord.messages).map(asRecord);

  if (nestedMessages.length > 0) {
    return nestedMessages.map((messageItem) => ({
      ...dataRecord,
      ...messageItem,
      key: { ...asRecord(dataRecord.key), ...asRecord(messageItem.key) },
      message: Object.keys(asRecord(messageItem.message)).length > 0
        ? asRecord(messageItem.message)
        : asRecord(dataRecord.message),
      pushName: getString(messageItem.pushName) || getString(dataRecord.pushName) || getString(payload.pushName),
      sender: getString(messageItem.sender) || getString(dataRecord.sender) || getString(payload.sender),
    }));
  }

  return [dataRecord];
}

function extractIncomingMessages(payload: JsonRecord): IncomingMessage[] {
  const dataRecord = asRecord(payload.data);

  return buildMessageCandidates(payload)
    .map((candidate) => {
      const key = asRecord(candidate.key);
      // Real phone number for @lid contacts (Evolution v2 / Baileys)
      const senderPn =
        getString(key.senderPn) ||
        getString(candidate.senderPn) ||
        getString(dataRecord.senderPn);
      const rawRemoteJid =
        getString(key.remoteJid) ||
        getString(candidate.remoteJid);
      // If remoteJid is @lid, ONLY accept senderPn (real phone). Never use the @lid as phone.
      const isLid = rawRemoteJid.includes("@lid");
      const remoteJid = isLid
        ? (senderPn || "")
        : rawRemoteJid;
      const phone = extractPhoneFromJid(remoteJid);
      const messageText = extractMessageText(asRecord(candidate.message));
      const pushName =
        getString(candidate.pushName) ||
        getString(dataRecord.pushName) ||
        getString(payload.pushName) ||
        phone;

      return {
        messageId: getString(key.id) || crypto.randomUUID(),
        remoteJid: remoteJid || rawRemoteJid,
        phone,
        pushName,
        text: messageText,
        fromMe: key.fromMe === true || candidate.fromMe === true,
      } satisfies IncomingMessage;
    })
    .filter((message) => Boolean(message.phone) && !message.remoteJid.endsWith("@g.us") && !message.remoteJid.includes("broadcast"));
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

  const messages = (history || []).map((message: { sender: string; text: string }) => ({
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

async function sendWhatsappReply(phone: string, text: string, url: string, apiKey: string, instanceName: string) {
  // Evolution expects digits only, no '+' or '@...'
  const number = phone.replace(/\D/g, "");
  const baseUrl = url.replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify({
      number,
      textMessage: { text },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Evolution API error [${response.status}]: ${errorText}`);
  }

  return response.json();
}

async function processIncomingMessage(params: {
  supabase: any;
  incoming: IncomingMessage;
  lovableApiKey: string;
  evolutionApiUrl: string;
  evolutionApiKey: string;
  evolutionInstanceName: string;
}) {
  const { supabase, incoming, lovableApiKey, evolutionApiUrl, evolutionApiKey, evolutionInstanceName } = params;

  if (incoming.fromMe) {
    return { status: "skipped_own", messageId: incoming.messageId };
  }

  if (!incoming.phone) {
    return { status: "ignored", reason: "sender_not_found", messageId: incoming.messageId };
  }

  const lead = await findOrCreateLead(supabase, incoming.phone, incoming.pushName);

  if (!incoming.text) {
    return { status: "lead_saved_without_text", leadId: lead.id, messageId: incoming.messageId };
  }

  await saveMessage(supabase, lead.id, "client", incoming.text);

  const autoAttendanceEnabled = await getAutoAttendanceEnabled(supabase);
  if (!autoAttendanceEnabled) {
    return { status: "saved_only", leadId: lead.id, messageId: incoming.messageId };
  }

  if (TRANSFERRED_STATUSES.includes(lead.status as typeof TRANSFERRED_STATUSES[number])) {
    return { status: "already_transferred", leadId: lead.id, messageId: incoming.messageId };
  }

  const replyText = await buildAiReply(supabase, lead, incoming.phone, lovableApiKey);
  await saveMessage(supabase, lead.id, "ai", replyText);
  await sendWhatsappReply(incoming.remoteJid, replyText, evolutionApiUrl, evolutionApiKey, evolutionInstanceName);

  return { status: "ok", leadId: lead.id, reply: replyText, messageId: incoming.messageId };
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
    const payload = asRecord(await req.json());
    console.log("Evolution webhook payload:", JSON.stringify(payload));

    const event = normalizeEventName(getString(payload.event) || getString(payload.type));
    if (event !== "messages.upsert") {
      return jsonResponse({ status: "ignored", event });
    }

    const incomingMessages = extractIncomingMessages(payload);
    if (!incomingMessages.length) {
      return jsonResponse({ status: "ignored", reason: "no_supported_messages" });
    }

    const processAll = Promise.allSettled(
      incomingMessages.map(async (incoming) => {
        try {
          return await processIncomingMessage({
            supabase,
            incoming,
            lovableApiKey: LOVABLE_API_KEY,
            evolutionApiUrl: EVOLUTION_API_URL,
            evolutionApiKey: EVOLUTION_API_KEY,
            evolutionInstanceName: EVOLUTION_INSTANCE_NAME,
          });
        } catch (error) {
          console.error(`Failed to process incoming message ${incoming.messageId}:`, error);
          throw error;
        }
      }),
    );

    const edgeRuntime = (globalThis as any).EdgeRuntime;
    const waitUntil = typeof edgeRuntime?.waitUntil === "function"
      ? edgeRuntime.waitUntil.bind(edgeRuntime)
      : null;

    if (waitUntil) {
      waitUntil(processAll);
      return jsonResponse({ status: "accepted", received: incomingMessages.length });
    }

    const results = await processAll;
    const processed = results.filter((result) => result.status === "fulfilled").length;
    const failed = results
      .filter((result) => result.status === "rejected")
      .map((result) => result.status === "rejected" ? String(result.reason) : "");

    return jsonResponse(
      {
        status: failed.length > 0 ? "partial" : "ok",
        processed,
        failed,
      },
      failed.length > 0 ? 207 : 200,
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return jsonResponse({ status: "error", message: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});