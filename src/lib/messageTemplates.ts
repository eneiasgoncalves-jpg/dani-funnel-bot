export interface MessageTemplate {
  id: string;
  shortcut: string; // short name shown in list, e.g. "saudacao"
  text: string;
}

const STORAGE_KEY = 'message_templates_v1';

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tpl-saudacao',
    shortcut: 'saudacao',
    text: 'Olá! Tudo bem? 😊 Sou da Dani Locações, como posso ajudar?',
  },
  {
    id: 'tpl-agradecer',
    shortcut: 'agradecer',
    text: 'Muito obrigada pelo contato! 💜',
  },
  {
    id: 'tpl-aguardar',
    shortcut: 'aguardar',
    text: 'Só um instante, já te respondo! 🙏',
  },
  {
    id: 'tpl-endereco',
    shortcut: 'endereco',
    text: 'Para confirmar o orçamento, poderia me passar o endereço completo do evento (rua, número, bairro e cidade)?',
  },
  {
    id: 'tpl-data',
    shortcut: 'data',
    text: 'Qual a data do evento e o horário previsto de início e término?',
  },
  {
    id: 'tpl-confirmacao',
    shortcut: 'confirmacao',
    text: 'Reserva confirmada! ✅ Em breve enviarei o contrato e os detalhes da entrega.',
  },
  {
    id: 'tpl-pagamento',
    shortcut: 'pagamento',
    text: 'O pagamento pode ser feito via PIX ou na entrega. Qual prefere?',
  },
];

export function getTemplates(): MessageTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TEMPLATES;
    const parsed = JSON.parse(raw) as MessageTemplate[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

export function saveTemplates(templates: MessageTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function addTemplate(t: Omit<MessageTemplate, 'id'>): MessageTemplate {
  const next: MessageTemplate = { ...t, id: `tpl-${Date.now()}` };
  const all = [...getTemplates(), next];
  saveTemplates(all);
  return next;
}

export function updateTemplate(id: string, patch: Partial<MessageTemplate>) {
  const all = getTemplates().map(t => (t.id === id ? { ...t, ...patch } : t));
  saveTemplates(all);
}

export function deleteTemplate(id: string) {
  saveTemplates(getTemplates().filter(t => t.id !== id));
}