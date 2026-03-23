import { useState, useCallback } from 'react';
import { Lead, LeadStatus, ChatMessage } from '@/types/lead';
import { sampleLeads } from '@/data/sampleLeads';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>(sampleLeads);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const selectedLead = leads.find(l => l.id === selectedLeadId) || null;

  const moveLeadToStatus = useCallback((leadId: string, newStatus: LeadStatus) => {
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, status: newStatus, updatedAt: new Date() } : l
    ));
  }, []);

  const addMessage = useCallback((leadId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMsg: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, messages: [...l.messages, newMsg], updatedAt: new Date() } : l
    ));
  }, []);

  const getLeadsByStatus = useCallback((status: LeadStatus) => {
    return leads.filter(l => l.status === status);
  }, [leads]);

  const stats = {
    total: leads.length,
    novo: leads.filter(l => l.status === 'novo').length,
    analise: leads.filter(l => l.status === 'analise').length,
    proposta: leads.filter(l => l.status === 'proposta').length,
    contra_proposta: leads.filter(l => l.status === 'contra_proposta').length,
    fechado: leads.filter(l => l.status === 'fechado').length,
    perdido: leads.filter(l => l.status === 'perdido').length,
  };

  return {
    leads,
    selectedLead,
    selectedLeadId,
    setSelectedLeadId,
    moveLeadToStatus,
    addMessage,
    getLeadsByStatus,
    stats,
  };
}
