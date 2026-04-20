import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Lead } from '@/types/lead';

interface Props {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function EditLeadDialog({ lead, open, onOpenChange }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', channel: 'whatsapp', city: '', neighborhood: '',
    event_date: '', children_age: '', children_count: '', interest: '',
  });

  useEffect(() => {
    if (lead) {
      setForm({
        name: lead.name || '',
        phone: lead.phone || '',
        channel: lead.channel || 'whatsapp',
        city: lead.city || '',
        neighborhood: lead.neighborhood || '',
        event_date: lead.eventDate || '',
        children_age: lead.childrenAge || '',
        children_count: String(lead.childrenCount || ''),
        interest: lead.interest || '',
      });
    }
  }, [lead]);

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!lead) return;
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('leads').update({
      name: form.name.trim(),
      phone: form.phone.trim(),
      channel: form.channel as any,
      city: form.city.trim() || null,
      neighborhood: form.neighborhood.trim() || null,
      event_date: form.event_date || null,
      children_age: form.children_age.trim() || null,
      children_count: form.children_count ? Number(form.children_count) : null,
      interest: form.interest.trim() || null,
    }).eq('id', lead.id);
    setSaving(false);
    if (error) {
      toast.error('Erro ao atualizar');
      console.error(error);
    } else {
      toast.success('Lead atualizado!');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => update('name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <Input value={form.phone} onChange={e => update('phone', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={form.channel} onValueChange={v => update('channel', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="site">Site</SelectItem>
                  <SelectItem value="indicacao">Indicação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data do Evento</Label>
              <Input type="date" value={form.event_date} onChange={e => update('event_date', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={e => update('city', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Idade das Crianças</Label>
              <Input value={form.children_age} onChange={e => update('children_age', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Qtd. Crianças</Label>
              <Input type="number" value={form.children_count} onChange={e => update('children_count', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Interesse / Observações</Label>
            <Textarea value={form.interest} onChange={e => update('interest', e.target.value)} rows={3} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
