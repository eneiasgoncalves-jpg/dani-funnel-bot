import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Lead } from '@/types/lead';

interface Props {
  lead?: Lead | null;
  clienteId?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

const empty = {
  nome: '', telefone: '', cpf: '', email: '',
  cidade: '', bairro: '', endereco_completo: '', cep: '',
  data_nascimento: '', data_evento: '',
  valor_contrato: '', observacoes: '',
};

export function ClienteDialog({ lead, clienteId, open, onOpenChange, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      // If editing existing cliente by id
      if (clienteId) {
        const { data } = await supabase.from('clientes').select('*').eq('id', clienteId).maybeSingle();
        if (data) {
          setExistingId(data.id);
          setForm({
            nome: data.nome || '', telefone: data.telefone || '',
            cpf: data.cpf || '', email: data.email || '',
            cidade: data.cidade || '', bairro: data.bairro || '',
            endereco_completo: data.endereco_completo || '', cep: data.cep || '',
            data_nascimento: data.data_nascimento || '',
            data_evento: data.data_evento || '',
            valor_contrato: data.valor_contrato ? String(data.valor_contrato) : '',
            observacoes: data.observacoes || '',
          });
        }
        return;
      }
      // From lead: check if cliente already exists for this lead
      if (lead) {
        const { data } = await supabase.from('clientes').select('*').eq('lead_id', lead.id).maybeSingle();
        if (data) {
          setExistingId(data.id);
          setForm({
            nome: data.nome || lead.name, telefone: data.telefone || lead.phone,
            cpf: data.cpf || '', email: data.email || '',
            cidade: data.cidade || lead.city, bairro: data.bairro || lead.neighborhood,
            endereco_completo: data.endereco_completo || '', cep: data.cep || '',
            data_nascimento: data.data_nascimento || '',
            data_evento: data.data_evento || lead.eventDate || '',
            valor_contrato: data.valor_contrato ? String(data.valor_contrato) : '',
            observacoes: data.observacoes || '',
          });
        } else {
          setExistingId(null);
          setForm({
            ...empty,
            nome: lead.name, telefone: lead.phone,
            cidade: lead.city, bairro: lead.neighborhood,
            data_evento: lead.eventDate || '',
          });
        }
      }
    };
    load();
  }, [open, lead, clienteId]);

  const update = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    if (!form.nome.trim() || !form.telefone.trim()) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }
    setSaving(true);
    const payload = {
      lead_id: lead?.id || null,
      nome: form.nome.trim(),
      telefone: form.telefone.trim(),
      cpf: form.cpf.trim() || null,
      email: form.email.trim() || null,
      cidade: form.cidade.trim() || null,
      bairro: form.bairro.trim() || null,
      endereco_completo: form.endereco_completo.trim() || null,
      cep: form.cep.trim() || null,
      data_nascimento: form.data_nascimento || null,
      data_evento: form.data_evento || null,
      valor_contrato: form.valor_contrato ? Number(form.valor_contrato) : 0,
      observacoes: form.observacoes.trim() || null,
    };
    const { error } = existingId
      ? await supabase.from('clientes').update(payload).eq('id', existingId)
      : await supabase.from('clientes').insert(payload);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar cliente');
      console.error(error);
    } else {
      toast.success(existingId ? 'Cliente atualizado!' : 'Cliente salvo!');
      onSaved?.();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingId ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Nome *</Label><Input value={form.nome} onChange={e => update('nome', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Telefone *</Label><Input value={form.telefone} onChange={e => update('telefone', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>CPF</Label><Input value={form.cpf} onChange={e => update('cpf', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={e => update('email', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Cidade</Label><Input value={form.cidade} onChange={e => update('cidade', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Bairro</Label><Input value={form.bairro} onChange={e => update('bairro', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5"><Label>Endereço completo</Label><Input value={form.endereco_completo} onChange={e => update('endereco_completo', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>CEP</Label><Input value={form.cep} onChange={e => update('cep', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Nascimento</Label><Input type="date" value={form.data_nascimento} onChange={e => update('data_nascimento', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Data Evento</Label><Input type="date" value={form.data_evento} onChange={e => update('data_evento', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor_contrato} onChange={e => update('valor_contrato', e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={3} value={form.observacoes} onChange={e => update('observacoes', e.target.value)} /></div>
          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? 'Salvando...' : (existingId ? 'Atualizar Cliente' : 'Salvar Cliente')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
