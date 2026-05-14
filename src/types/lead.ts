export type LeadStatus = 'novo' | 'analise' | 'proposta' | 'contra_proposta' | 'fechado' | 'perdido';

export type LeadTag = 'quente' | 'duvida' | 'sensivel_preco' | 'frio';

export type SalesChannel = 'whatsapp' | 'instagram' | 'google' | 'site' | 'indicacao';

export interface ChatMessage {
  id: string;
  sender: 'client' | 'ai';
  text: string;
  timestamp: Date;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | 'audio' | 'document' | null;
  mediaMime?: string | null;
  fileName?: string | null;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string | null;
  eventDate: string;
  city: string;
  neighborhood: string;
  childrenAge: string;
  childrenCount: number;
  interest: string;
  status: LeadStatus;
  channel: SalesChannel;
  tags: LeadTag[];
  feedbackSent: boolean;
  messages: ChatMessage[];
  aiEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  readUntil: Date | null;
}

export const STATUS_CONFIG: Record<LeadStatus, { label: string; colorClass: string }> = {
  novo: { label: 'Novo Lead', colorClass: 'bg-stage-new' },
  analise: { label: 'Em Análise', colorClass: 'bg-stage-analysis' },
  proposta: { label: 'Proposta', colorClass: 'bg-stage-proposal' },
  contra_proposta: { label: 'Contra Proposta', colorClass: 'bg-warning' },
  fechado: { label: 'Contrato Fechado', colorClass: 'bg-stage-closed' },
  perdido: { label: 'Perdido', colorClass: 'bg-stage-lost' },
};

export const TAG_CONFIG: Record<LeadTag, { label: string; emoji: string; bgClass: string; textClass: string }> = {
  quente: { label: 'Quente', emoji: '🔥', bgClass: 'bg-tag-hot-bg', textClass: 'text-tag-hot' },
  duvida: { label: 'Dúvida', emoji: '🤔', bgClass: 'bg-tag-doubt-bg', textClass: 'text-tag-doubt' },
  sensivel_preco: { label: 'Sensível a Preço', emoji: '💰', bgClass: 'bg-tag-price-bg', textClass: 'text-tag-price' },
  frio: { label: 'Frio', emoji: '❄️', bgClass: 'bg-tag-cold-bg', textClass: 'text-tag-cold' },
};

export const CHANNEL_CONFIG: Record<SalesChannel, { label: string; emoji: string }> = {
  whatsapp: { label: 'WhatsApp', emoji: '💬' },
  instagram: { label: 'Instagram', emoji: '📸' },
  google: { label: 'Google', emoji: '🔍' },
  site: { label: 'Site', emoji: '🌐' },
  indicacao: { label: 'Indicação', emoji: '🤝' },
};

export const STAGES: LeadStatus[] = ['novo', 'analise', 'proposta', 'contra_proposta', 'fechado', 'perdido'];
