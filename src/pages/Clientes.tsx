import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Search, Pencil, Trash2, Plus, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ClienteDialog } from '@/components/ClienteDialog';
import { useTheme } from '@/hooks/useTheme';
import logoDani from '@/assets/logo-dani.jpg';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  cpf: string | null;
  email: string | null;
  cidade: string | null;
  bairro: string | null;
  data_evento: string | null;
  valor_contrato: number | null;
  lead_id: string | null;
}

export default function Clientes() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchClientes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false });
    setClientes((data as Cliente[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchClientes();
    const channel = supabase
      .channel('clientes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, fetchClientes)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este cliente?')) return;
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir');
    else toast.success('Cliente excluído');
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setDialogOpen(true);
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? clientes.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        c.telefone.toLowerCase().includes(q) ||
        (c.cpf || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.cidade || '').toLowerCase().includes(q) ||
        (c.bairro || '').toLowerCase().includes(q)
      )
    : clientes;

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center">
        <img src={logoDani} alt="" className="w-[400px] opacity-[0.25]" />
      </div>
      <header className="border-b border-border bg-card/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Cadastro de Clientes</h1>
              <p className="text-[11px] text-muted-foreground">{clientes.length} cliente(s) cadastrado(s)</p>
            </div>
          </div>
          <Button size="sm" onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Cliente
          </Button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-5 space-y-4 relative z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, CPF, email, cidade ou bairro..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {q ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
          </p>
        ) : (
          <div className="grid gap-3">
            {filtered.map(c => (
              <Card key={c.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground truncate">{c.nome}</h3>
                      {c.valor_contrato ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          R$ {Number(c.valor_contrato).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground space-x-3">
                      <span>📱 {c.telefone}</span>
                      {c.cpf && <span>CPF: {c.cpf}</span>}
                      {c.email && <span>✉️ {c.email}</span>}
                      {(c.cidade || c.bairro) && <span>📍 {[c.bairro, c.cidade].filter(Boolean).join(', ')}</span>}
                      {c.data_evento && <span>🎉 {new Date(c.data_evento).toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c.id)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} title="Excluir" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <ClienteDialog
        clienteId={editingId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={fetchClientes}
      />
    </div>
  );
}
