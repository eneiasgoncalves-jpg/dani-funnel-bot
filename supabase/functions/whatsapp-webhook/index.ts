import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TRANSFERRED_STATUSES = ["analise", "proposta", "contra_proposta", "fechado", "perdido"] as const;

const SYSTEM_PROMPT = `Você é a assistente virtual da Dani Locações, empresa de locação de brinquedos infláveis para festas e eventos.

PERSONALIDADE:
- Objetiva, eficiente, profissional, educada e direta ao ponto.
- Sem entusiasmo exagerado, sem elogios a cidades, sem exclamações desnecessárias.
- Não use saudações longas ("Bom dia", "Boa tarde") em todas as mensagens — vá direto ao ponto e mantenha o foco no fluxo da conversa.
- Responda APENAS com texto puro. Sem markdown, sem asteriscos, sem bullet points. Mensagens curtas.

CIDADES ATENDIDAS (festas particulares): Cachoeirinha, Gravataí, Canoas e Nova Santa Rita.
- Eventos corporativos: aceite qualquer cidade.
- Se a cidade não estiver na lista e o evento não for corporativo, informe: "Atendemos festas particulares exclusivamente em Cachoeirinha, Gravataí, Canoas e Nova Santa Rita. Para outras regiões, atendemos apenas eventos corporativos."

CONFIRMAÇÃO DE LOCAL:
- Se o cliente mencionar uma cidade atendida, apenas confirme de forma simples (ex.: "Sim, atendemos em Canoas.") e siga o fluxo. Não elogie a cidade.

COLETA DE DADOS (apenas o essencial para sugerir brinquedos):
1. Quantidade estimada de crianças.
2. Faixa etária (se são todas da mesma idade ou se há menores/diversas idades).
Também colete data do evento e bairro quando ainda não informados, sem alongar o atendimento.

PRIMEIRA MENSAGEM (novo lead):
- Responda EXATAMENTE: "Olá! Aqui é a Dani. Por aqui falamos do setor de eventos. Para que eu possa te ajudar, o evento é corporativo ou uma festa particular?"

RESTRIÇÃO DE VALORES:
- Você NÃO fornece preços, valores, orçamentos, condições de pagamento ou disponibilidade final.
- Nunca invente preços.

TRANSBORDO PARA HUMANO (gatilho obrigatório):
- Sempre que o cliente mencionar qualquer uma destas palavras/intenções: "valor", "valores", "preço", "preços", "quanto custa", "custa", "orçamento", "tabela", "pix", "cartão", "pagamento", "disponibilidade", "reservar", "fechar", responda EXATAMENTE:
  "Vou encaminhar seu contato agora mesmo para um de nossos atendentes, que enviará a tabela de valores e verificará a disponibilidade para você. Um momento, por favor."
- Inclua o texto exato [TRANSFER_TO_HUMAN] no final dessa resposta e use a tool update_lead para mover o status para "proposta".
- Após o transbordo (status "analise", "proposta" ou posterior), NÃO responda mais ao cliente.

EXEMPLOS DE TOM:
- Cliente: "Vocês atendem em Canoas?" → IA: "Sim, atendemos em Canoas. Para eu sugerir os brinquedos ideais, quantas crianças são esperadas e qual a faixa etária delas?"
- Cliente: "Qual o valor do castelo inflável?" → IA: "Vou encaminhar seu contato agora mesmo para um de nossos atendentes, que enviará a tabela de valores e verificará a disponibilidade para você. Um momento, por favor. [TRANSFER_TO_HUMAN]"

OBJETIVO: Qualificar o lead de forma objetiva (tipo de evento, cidade, data, quantidade e faixa etária das crianças) e transferir para a atendente humana assim que houver qualquer pedido de valores ou fechamento.`;

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
  ai_enabled?: boolean;
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
      message:
        Object.keys(asRecord(messageItem.message)).length > 0
          ? asRecord(messageItem.message)
          : asRecord(dataRecord.message),
      pushName: getString(messageItem.pushName) || getString(dataRecord.pushName) || getString(payload.pushName),
      sender: getString(messageItem.sender) || getString(dataRecord.sender) || getString(payload.sender),
    }));
  }

  return [dataRecord];
}

// CORREÇÃO 1: busca por remoteJid em vez de id (compatível com Evolution API v2.3.1+)
async function resolveLidToRealPhone(
  lidDigits: string,
  evolutionApiUrl: string,
  evolutionApiKey: string,
  evolutionInstanceName: string,
): Promise<string> {
  try {
    const baseUrl = evolutionApiUrl.replace(/\/+$/, "");
    const lidJid = `${lidDigits}@lid`;

    // Tenta primeiro por remoteJid (v2.3.1+)
    const res = await fetch(`${baseUrl}/chat/findContacts/${evolutionInstanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
      body: JSON.stringify({ where: { remoteJid: lidJid } }),
    });

    if (!res.ok) {
      console.warn("findContacts (remoteJid) non-OK:", res.status, await res.text());
      return "";
    }

    const data = await res.json();
    let arr = Array.isArray(data) ? data : [];

    // Fallback: tenta por id caso remoteJid não retorne resultado
    if (arr.length === 0) {
      const res2 = await fetch(`${baseUrl}/chat/findContacts/${evolutionInstanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
        body: JSON.stringify({ where: { id: lidJid } }),
      });
      if (res2.ok) {
        const data2 = await res2.json();
        arr = Array.isArray(data2) ? data2 : [];
      }
    }

    for (const c of arr) {
      const candidates = [c?.remoteJid, c?.jid, c?.id, c?.senderPn];
      for (const cand of candidates) {
        if (typeof cand === "string" && cand.includes("@s.whatsapp.net")) {
          const realDigits = cand.replace(/@.+$/, "").replace(/\D/g, "");
          if (realDigits) return realDigits;
        }
      }
      // Tenta campo phoneNumber direto
      if (typeof c?.phoneNumber === "string" && c.phoneNumber) {
        const realDigits = c.phoneNumber.replace(/\D/g, "");
        if (realDigits) return realDigits;
      }
    }

    return "";
  } catch (e) {
    console.warn("resolveLidToRealPhone error:", e);
    return "";
  }
}

type ExtractedMessage = IncomingMessage & {
  isLid: boolean;
  lidDigits: string;
  previousRemoteJid: string;
  rawRemoteJid: string;
};

function extractIncomingMessages(payload: JsonRecord): ExtractedMessage[] {
  const dataRecord = asRecord(payload.data);

  return buildMessageCandidates(payload)
    .map((candidate) => {
      const key = asRecord(candidate.key);
      const senderPn = getString(key.senderPn) || getString(candidate.senderPn) || getString(dataRecord.senderPn);
      const rawRemoteJid = getString(key.remoteJid) || getString(candidate.remoteJid);
      const previousRemoteJid = getString(key.previousRemoteJid) || getString(candidate.previousRemoteJid);
      const isLid = rawRemoteJid.includes("@lid");
      const lidDigits = isLid ? rawRemoteJid.replace(/@.+$/, "").replace(/\D/g, "") : "";

      let phone = "";
      let replyTarget = rawRemoteJid.replace(/@.+$/, "").replace(/\D/g, "");

      if (isLid) {
        if (senderPn) {
          const digits = senderPn.replace(/@.+$/, "").replace(/\D/g, "");
          phone = `+${digits}`;
          replyTarget = digits;
        }
      } else {
        const digits = rawRemoteJid.replace(/@.+$/, "").replace(/\D/g, "");
        phone = digits ? `+${digits}` : "";
      }

      const stillUnresolved = isLid && !phone;

      const messageText = extractMessageText(asRecord(candidate.message));
      const pushName =
        getString(candidate.pushName) || getString(dataRecord.pushName) || getString(payload.pushName) || phone;

      return {
        messageId: getString(key.id) || crypto.randomUUID(),
        remoteJid: replyTarget,
        phone,
        pushName,
        text: messageText,
        fromMe: key.fromMe === true || candidate.fromMe === true,
        isLid: stillUnresolved,
        lidDigits: stillUnresolved ? lidDigits : "",
        previousRemoteJid,
        rawRemoteJid,
      };
    })
    .filter(
      (message) =>
        Boolean(message.phone) &&
        !message.remoteJid.endsWith("@g.us") &&
        !message.remoteJid.includes("broadcast") &&
        !message.isLid,
    );
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

async function saveMessage(supabase: any, leadId: string, sender: "client" | "ai", text: string) {
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
  const { data, error } = await supabase.from("settings").select("value").eq("key", "auto_attendance").maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar configuração de atendimento automático: ${error.message}`);
  }

  return data?.value === true;
}

function buildLeadContext(lead: LeadRow, phone: string) {
  return `Contexto do lead: Nome: ${lead.name || "não informado"}, Telefone: ${phone}, Data do evento: ${lead.event_date || "não informada"}, Cidade: ${lead.city || "não informada"}, Bairro: ${lead.neighborhood || "não informado"}, Idade das crianças: ${lead.children_age || "não informada"}, Qtd crianças: ${lead.children_count || "não informada"}, Interesse: ${lead.interest || "não informado"}, Status: ${lead.status}`;
}

async function requestAiCompletion(params: {
  promptMessages: Array<{ role: string; content: string }>;
  lovableApiKey: string;
  withTools: boolean;
}) {
  const { promptMessages, lovableApiKey, withTools } = params;

  const aiResponse = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: promptMessages,
      ...(withTools
        ? {
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
                      new_status: {
                        type: "string",
                        enum: ["novo", "analise", "proposta", "contra_proposta", "fechado", "perdido"],
                      },
                      tags: {
                        type: "array",
                        items: { type: "string", enum: ["quente", "duvida", "sensivel_preco", "frio"] },
                      },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    }),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    throw new Error(`AI gateway error [${aiResponse.status}]: ${errorText}`);
  }

  const aiData = await aiResponse.json();
  const choice = aiData?.choices?.[0];
  const content = getString(choice?.message?.content);
  const toolCalls = Array.isArray(choice?.message?.tool_calls) ? choice.message.tool_calls : [];
  const finishReason = getString(choice?.finish_reason);
  const totalTokens = Number(aiData?.usage?.total_tokens || 0);

  console.log(
    `[AI_GATEWAY] with_tools=${withTools} finish_reason=${finishReason || "unknown"} ` +
      `has_content=${content ? "yes" : "no"} tool_calls=${toolCalls.length} total_tokens=${totalTokens}`,
  );

  return { choice, content, toolCalls };
}

async function buildAiReply(supabase: any, lead: LeadRow, phone: string, lovableApiKey: string) {
  const { data: history, error: historyError } = await supabase
    .from("messages")
    .select("sender, text")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: true })
    .limit(100);

  if (historyError) {
    throw new Error(`Erro ao buscar histórico: ${historyError.message}`);
  }

  const messages = (history || []).map((message: { sender: string; text: string }) => ({
    role: message.sender === "client" ? "user" : "assistant",
    content: message.text,
  }));

  let currentLead = { ...lead };
  const systemContent = `${SYSTEM_PROMPT}\n\n${buildLeadContext(currentLead, phone)}`;
  const promptMessages = [{ role: "system", content: systemContent }, ...messages];
  const totalChars = promptMessages.reduce((sum: number, m: { content: string }) => sum + (m.content?.length || 0), 0);
  const clientMsgs = messages.filter((m: { role: string }) => m.role === "user").length;
  const assistantMsgs = messages.filter((m: { role: string }) => m.role === "assistant").length;
  console.log(
    `[AI_CONTEXT] lead_id=${lead.id} phone=${phone} name="${lead.name || ""}" status=${lead.status} ` +
    `history_count=${messages.length} (client=${clientMsgs}, assistant=${assistantMsgs}) ` +
    `system_chars=${systemContent.length} total_prompt_chars=${totalChars} ` +
    `approx_tokens=${Math.ceil(totalChars / 4)} messages_in_payload=${promptMessages.length}`,
  );

  const initialCompletion = await requestAiCompletion({
    promptMessages,
    lovableApiKey,
    withTools: true,
  });

  let replyText = initialCompletion.content;

  if (initialCompletion.toolCalls.length > 0) {
    for (const toolCall of initialCompletion.toolCalls) {
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
          currentLead = { ...currentLead, ...(leadUpdate as Partial<LeadRow>) };
        }
      } catch (error) {
        console.error("Failed to parse/update lead from tool call:", error);
      }
    }
  }

  if (!replyText) {
    console.warn(`[AI_GATEWAY] Empty content for lead ${lead.id}; retrying without tools`);

    const retrySystemContent = `${SYSTEM_PROMPT}\n\n${buildLeadContext(currentLead, phone)}\n\nVocê já processou internamente qualquer atualização do lead. Agora responda ao cliente com uma única mensagem curta, em texto puro, sem mencionar ferramentas nem erros internos.`;
    const retryMessages = [{ role: "system", content: retrySystemContent }, ...messages];
    const retryCompletion = await requestAiCompletion({
      promptMessages: retryMessages,
      lovableApiKey,
      withTools: false,
    });

    replyText = retryCompletion.content;
  }

  if (!replyText) {
    console.warn(`[AI_GATEWAY] Still empty content for lead ${lead.id}; using safe fallback`);
    replyText = "Olá! Pode me confirmar mais um detalhe para eu seguir com seu atendimento? 😊";
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
  const digits = phone.replace(/\D/g, "");
  const number = digits.length > 13 ? `${digits}@lid` : digits;
  const baseUrl = url.replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify({
      number,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Evolution API error [${response.status}]: ${errorText}`);
  }

  return response.json();
}

// CORREÇÃO 2: busca por variantes do número para evitar miss no merge
async function mergeLidLeadIntoReal(supabase: any, lidPhone: string, realPhone: string) {
  if (lidPhone === realPhone) return;

  const lidVariants = normalizeLeadPhone(lidPhone);
  const realVariants = normalizeLeadPhone(realPhone);

  const { data: lidLead } = await supabase.from("leads").select("id, name").in("phone", lidVariants).maybeSingle();

  if (!lidLead) return;

  const { data: realLead } = await supabase.from("leads").select("id, name").in("phone", realVariants).maybeSingle();

  if (realLead) {
    console.log(`Merging lid lead ${lidLead.id} into real lead ${realLead.id}`);
    await supabase.from("messages").update({ lead_id: realLead.id }).eq("lead_id", lidLead.id);
    await supabase.from("leads").delete().eq("id", lidLead.id);
  } else {
    console.log(`Updating lid lead ${lidLead.id} phone from ${lidPhone} to ${realPhone}`);
    await supabase.from("leads").update({ phone: realPhone }).eq("id", lidLead.id);
  }
}

async function processIncomingMessage(params: {
  supabase: any;
  incoming: ExtractedMessage;
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

  // Deduplicação por messageId — Evolution API v2.3.1 entrega a mesma mensagem
  // duas vezes (uma com @lid, outra com número real). Evita processar duplicata.
  if (incoming.messageId) {
    const { data: alreadyProcessed } = await supabase
      .from("processed_messages")
      .select("id")
      .eq("message_id", incoming.messageId)
      .maybeSingle();

    if (alreadyProcessed) {
      return { status: "skipped_duplicate", messageId: incoming.messageId };
    }

    const { error: insertProcessedError } = await supabase
      .from("processed_messages")
      .insert({ message_id: incoming.messageId, phone: incoming.phone });

    if (insertProcessedError && !String(insertProcessedError.message || "").includes("duplicate")) {
      console.warn(`[DEDUP] Failed to mark message ${incoming.messageId} processed:`, insertProcessedError.message);
    } else if (insertProcessedError) {
      // Race: outro worker já inseriu. Tratar como duplicata.
      return { status: "skipped_duplicate", messageId: incoming.messageId };
    }
  }

  let phone = incoming.phone;
  let replyTarget = incoming.remoteJid;

  // Tipo A: temos previousRemoteJid (@lid) + remoteJid (@s.whatsapp.net)
  // Persistimos o mapeamento LID -> número real para resolver Tipo B futuro
  if (
    incoming.previousRemoteJid &&
    incoming.previousRemoteJid.includes("@lid") &&
    incoming.rawRemoteJid.includes("@s.whatsapp.net")
  ) {
    const realDigits = incoming.rawRemoteJid.replace(/@.+$/, "").replace(/\D/g, "");
    if (realDigits) {
      const { error: upsertError } = await supabase
        .from("lid_mappings")
        .upsert({ lid: incoming.previousRemoteJid, phone: `+${realDigits}` }, { onConflict: "lid" });
      if (upsertError) {
        console.warn(`[LID] Failed to upsert mapping ${incoming.previousRemoteJid}:`, upsertError.message);
      } else {
        console.log(`[LID] Saved mapping ${incoming.previousRemoteJid} -> +${realDigits}`);
      }
    }
  }

  // Se é @lid sem senderPn, tenta resolver para número real
  if (incoming.isLid && incoming.lidDigits) {
    // 1) Buscar primeiro na tabela de mapeamentos
    const lidKey = `${incoming.lidDigits}@lid`;
    const { data: lidMap } = await supabase
      .from("lid_mappings")
      .select("phone")
      .eq("lid", lidKey)
      .maybeSingle();

    let realDigits = "";
    if (lidMap?.phone) {
      realDigits = String(lidMap.phone).replace(/\D/g, "");
      console.log(`[LID] Resolved ${lidKey} via lid_mappings -> +${realDigits}`);
    } else {
      // 2) Fallback: tentar resolver via API da Evolution
      realDigits = await resolveLidToRealPhone(
        incoming.lidDigits,
        evolutionApiUrl,
        evolutionApiKey,
        evolutionInstanceName,
      );
      if (realDigits) {
        // Salva o mapeamento descoberto pela API para próximas vezes
        await supabase
          .from("lid_mappings")
          .upsert({ lid: lidKey, phone: `+${realDigits}` }, { onConflict: "lid" });
      }
    }

    if (realDigits) {
      const realPhone = `+${realDigits}`;
      console.log(`Resolved @lid ${incoming.lidDigits} to real phone ${realPhone}`);
      await mergeLidLeadIntoReal(supabase, phone, realPhone);
      phone = realPhone;
      replyTarget = realDigits;
    } else {
      // CORREÇÃO 3: bloqueia criação de lead duplicado quando LID não resolve
      console.warn(`Could not resolve @lid ${incoming.lidDigits} — skipping to avoid duplicate lead`);
      return { status: "skipped_unresolved_lid", messageId: incoming.messageId };
    }
  }

  const lead = await findOrCreateLead(supabase, phone, incoming.pushName);

  if (!incoming.text) {
    return { status: "lead_saved_without_text", leadId: lead.id, messageId: incoming.messageId };
  }

  await saveMessage(supabase, lead.id, "client", incoming.text);

  const autoAttendanceEnabled = await getAutoAttendanceEnabled(supabase);
  if (!autoAttendanceEnabled) {
    return { status: "saved_only", leadId: lead.id, messageId: incoming.messageId };
  }

  // Per-lead AI toggle
  if (lead.ai_enabled === false) {
    return { status: "ai_disabled_for_lead", leadId: lead.id, messageId: incoming.messageId };
  }

  if (TRANSFERRED_STATUSES.includes(lead.status as (typeof TRANSFERRED_STATUSES)[number])) {
    const waitMessage = "Por favor, aguarde um instante que já daremos continuidade ao seu orçamento.";
    await saveMessage(supabase, lead.id, "ai", waitMessage);
    await sendWhatsappReply(replyTarget, waitMessage, evolutionApiUrl, evolutionApiKey, evolutionInstanceName);
    return { status: "already_transferred", leadId: lead.id, messageId: incoming.messageId, reply: waitMessage };
  }

  const replyText = await buildAiReply(supabase, lead, phone, lovableApiKey);
  await saveMessage(supabase, lead.id, "ai", replyText);
  await sendWhatsappReply(replyTarget, replyText, evolutionApiUrl, evolutionApiKey, evolutionInstanceName);

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
  const EVOLUTION_INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME")?.trim();

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !LOVABLE_API_KEY ||
    !EVOLUTION_API_URL ||
    !EVOLUTION_API_KEY ||
    !EVOLUTION_INSTANCE_NAME
  ) {
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
    const waitUntil = typeof edgeRuntime?.waitUntil === "function" ? edgeRuntime.waitUntil.bind(edgeRuntime) : null;

    if (waitUntil) {
      waitUntil(processAll);
      return jsonResponse({ status: "accepted", received: incomingMessages.length });
    }

    const results = await processAll;
    const processed = results.filter((result) => result.status === "fulfilled").length;
    const failed = results
      .filter((result) => result.status === "rejected")
      .map((result) => (result.status === "rejected" ? String(result.reason) : ""));

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
