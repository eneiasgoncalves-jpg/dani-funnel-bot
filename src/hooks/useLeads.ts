import { useState, useCallback, useEffect } from 'react';
import { Lead, LeadStatus, ChatMessage } from '@/types/lead';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type DbLead = Database['public']['Tables']['leads']['Row'];
type DbMessage = Database['public']['Tables']['messages']['Row'];

function mapDbLeadToLead(dbLead: DbLead, messages: ChatMessage[]): Lead {
  return {
    id: dbLead.id,
    name: dbLead.name,
    phone: dbLead.phone,
    eventDate: dbLead.event_date || '',
    city: dbLead.city || '',
    neighborhood: dbLead.neighborhood || '',
    childrenAge: dbLead.children_age || '',
    childrenCount: dbLead.children_count || 0,
    interest: dbLead.interest || '',
    status: dbLead.status as LeadStatus,
    channel: dbLead.channel as Lead['channel'],
    tags: (dbLead.tags || []) as Lead['tags'],
    feedbackSent: (dbLead as any).feedback_sent ?? false,
    messages,
    createdAt: new Date(dbLead.created_at),
    updatedAt: new Date(dbLead.updated_at),
    readUntil: (dbLead as any).read_until ? new Date((dbLead as any).read_until) : null,
  };
}

function mapDbMessage(m: DbMessage): ChatMessage {
  return {
    id: m.id,
    sender: m.sender as 'client' | 'ai',
    text: m.text,
    timestamp: new Date(m.created_at),
  };
}

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    const query = supabase
      .from('leads')
      .select('*') as any;
    const { data: dbLeads } = await query
      .eq('archived', false)
      .order('updated_at', { ascending: false });

    if (!dbLeads) return;

    const { data: dbMessages } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    const messagesByLead: Record<string, ChatMessage[]> = {};
    (dbMessages || []).forEach((m) => {
      if (!messagesByLead[m.lead_id]) messagesByLead[m.lead_id] = [];
      messagesByLead[m.lead_id].push(mapDbMessage(m));
    });

    setLeads(dbLeads.map((l) => mapDbLeadToLead(l, messagesByLead[l.id] || [])));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeads();

    const leadsChannel = supabase
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads();
      })
      .subscribe();

    const messagesChannel = supabase
      .channel('messages-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchLeads();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [fetchLeads]);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) || null;

  const moveLeadToStatus = useCallback(async (leadId: string, newStatus: LeadStatus) => {
    await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
  }, []);

  const addMessage = useCallback(async (leadId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    await supabase.from('messages').insert({
      lead_id: leadId,
      sender: message.sender,
      text: message.text,
    });
  }, []);

  const deleteLead = useCallback(async (leadId: string) => {
    await supabase.from('messages').delete().eq('lead_id', leadId);
    await supabase.from('leads').delete().eq('id', leadId);
  }, []);

  const archiveLead = useCallback(async (leadId: string) => {
    await supabase.from('leads').update({ archived: true } as any).eq('id', leadId);
  }, []);

  const markAsRead = useCallback(async (leadId: string) => {
    await supabase.from('leads').update({ read_until: new Date().toISOString() } as any).eq('id', leadId);
  }, []);

  const getUnreadCount = useCallback((leadId: string): number => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return 0;
    const clientMessages = lead.messages.filter(m => m.sender === 'client');
    if (!lead.readUntil) return clientMessages.length;
    return clientMessages.filter(m => m.timestamp > lead.readUntil!).length;
  }, [leads]);

  const getLeadsByStatus = useCallback(
    (status: LeadStatus) => leads.filter((l) => l.status === status),
    [leads]
  );

  const stats = {
    total: leads.length,
    novo: leads.filter((l) => l.status === 'novo').length,
    analise: leads.filter((l) => l.status === 'analise').length,
    proposta: leads.filter((l) => l.status === 'proposta').length,
    contra_proposta: leads.filter((l) => l.status === 'contra_proposta').length,
    fechado: leads.filter((l) => l.status === 'fechado').length,
    perdido: leads.filter((l) => l.status === 'perdido').length,
  };

  return {
    leads,
    selectedLead,
    selectedLeadId,
    setSelectedLeadId,
    moveLeadToStatus,
    addMessage,
    deleteLead,
    archiveLead,
    markAsRead,
    getUnreadCount,
    getLeadsByStatus,
    stats,
    loading,
  };
}
