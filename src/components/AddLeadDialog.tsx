import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function AddLeadDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    channel: 'whatsapp' as string,
    city: '',
    neighborhood: '',
    event_date: '',
    children_age: '',
    children_count: '',
    interest: '',
  });

  const resetForm = () => setForm({
    name: '', phone: '', channel: 'whatsapp', city: '', neighborhood: '',
    event_date: '', children_age: '', children_count: '', interest: '',
  });

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('leads').insert({
      name: form.name.trim(),
      phone: form.phone.trim(),
      channel: form.channel as any,
      city: form.city.trim() || null,
      neighborhood: form.neighborhood.trim() || null,
      event_date: form.event_date || null,
      children_age: form.children_age.trim() || null,
      children_count: form.children_count ? Number(form.children_count) : null,
      interest: form.interest.trim() || null,
      status: 'novo',
      tags: [],
    });

    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar lead');
      console.error(error);
    } else {
      toast.success('Lead adicionado com sucesso!');
      resetForm();
      setOpen(false);
    }
  };

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" placeholder="Nome do cliente" value={form.name} onChange={e => update('name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone *</Label>
              <Input id="phone" placeholder="+5551..." value={form.phone} onChange={e => update('phone', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="channel">Canal</Label>
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
              <Label htmlFor="event_date">Data do Evento</Label>
              <Input id="event_date" type="date" value={form.event_date} onChange={e => update('event_date', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" placeholder="Cidade" value={form.city} onChange={e => update('city', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input id="neighborhood" placeholder="Bairro" value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="children_age">Idade das Crianças</Label>
              <Input id="children_age" placeholder="Ex: 5-10 anos" value={form.children_age} onChange={e => update('children_age', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="children_count">Qtd. Crianças</Label>
              <Input id="children_count" type="number" placeholder="0" value={form.children_count} onChange={e => update('children_count', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="interest">Interesse / Observações</Label>
            <Textarea id="interest" placeholder="Brinquedos de interesse, observações..." value={form.interest} onChange={e => update('interest', e.target.value)} rows={3} />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Salvando...' : 'Salvar Lead'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}