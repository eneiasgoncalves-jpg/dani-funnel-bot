import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ArchiveRestore, Trash2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface ArchivedLead {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  channel: string;
  status: string;
  updated_at: string;
}

export default function Arquivados() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<ArchivedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const fetchArchived = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, phone, city, channel, status, updated_at')
      .eq('archived', true)
      .order('updated_at', { ascending: false });
    if (error) toast.error('Erro ao carregar arquivados');
    setLeads((data as ArchivedLead[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchArchived(); }, []);

  const handleUnarchive = async (id: string) => {
    const { error } = await supabase.from('leads').update({ archived: false }).eq('id', id);
    if (error) return toast.error('Erro ao desarquivar');
    toast.success('Lead desarquivado');
    fetchArchived();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este lead permanentemente?')) return;
    await supabase.from('messages').delete().eq('lead_id', id);
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) return toast.error('Erro ao excluir');
    toast.success('Lead excluído');
    fetchArchived();
  };

  const filtered = leads.filter(l =>
    !q || l.name.toLowerCase().includes(q.toLowerCase()) || l.phone.includes(q)
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Conversas Arquivadas</h1>
              <p className="text-[11px] text-muted-foreground">{leads.length} {leads.length === 1 ? 'lead arquivado' : 'leads arquivados'}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 py-5 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-12">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            {q ? 'Nenhum lead encontrado' : 'Nenhuma conversa arquivada'}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map(lead => (
              <div key={lead.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-foreground truncate">{lead.name}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{lead.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {lead.phone} {lead.city && `• ${lead.city}`} • {lead.channel}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Arquivado em {new Date(lead.updated_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => handleUnarchive(lead.id)} className="gap-1.5">
                    <ArchiveRestore className="h-3.5 w-3.5" />
                    Desarquivar
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(lead.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
