import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Pencil, Trash2, Upload } from 'lucide-react';

interface Item {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  category: string | null;
  active: boolean;
  sort_order: number;
}

const empty: Partial<Item> = {
  name: '',
  description: '',
  price: 0,
  image_url: '',
  category: '',
  active: true,
  sort_order: 0,
};

export default function Catalogo() {
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');

  const load = async () => {
    const { data, error } = await supabase
      .from('catalog_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) toast.error(error.message);
    else setItems((data || []) as Item[]);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!editing?.name?.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    const payload = {
      name: editing.name,
      description: editing.description || '',
      price: Number(editing.price) || 0,
      image_url: editing.image_url || null,
      category: editing.category || '',
      active: editing.active ?? true,
      sort_order: Number(editing.sort_order) || 0,
    };
    const { error } = editing.id
      ? await supabase.from('catalog_items').update(payload).eq('id', editing.id)
      : await supabase.from('catalog_items').insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Salvo');
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este item?')) return;
    const { error } = await supabase.from('catalog_items').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Removido');
      load();
    }
  };

  const importJson = async () => {
    try {
      const arr = JSON.parse(importText);
      if (!Array.isArray(arr)) throw new Error('JSON precisa ser um array');
      const rows = arr.map((it: any, idx: number) => ({
        name: String(it.name || it.nome || '').trim(),
        description: String(it.description || it.descricao || ''),
        price: Number(it.price ?? it.preco ?? 0),
        image_url: it.image_url || it.imageUrl || it.imagem || null,
        category: String(it.category || it.categoria || ''),
        active: it.active !== false,
        sort_order: Number(it.sort_order ?? it.ordem ?? idx),
      })).filter(r => r.name);
      if (!rows.length) throw new Error('Nenhum item válido');
      const { error } = await supabase.from('catalog_items').insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} itens importados`);
      setImportOpen(false);
      setImportText('');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'JSON inválido');
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold">Catálogo</h1>
            <span className="text-sm text-muted-foreground">({items.length})</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4" /> Importar JSON
            </Button>
            <Button onClick={() => setEditing(empty)}>
              <Plus className="w-4 h-4" /> Novo item
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <div
              key={item.id}
              className="border border-border rounded-lg overflow-hidden bg-card cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
              onClick={() => setEditing(item)}
            >
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-muted" />
              )}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{item.name}</p>
                    {item.category && (
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {item.category}
                      </p>
                    )}
                  </div>
                  {!item.active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      Inativo
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-sm font-bold text-primary">
                    {item.price
                      ? `R$ ${Number(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditing(item); }} className="h-8 w-8">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); remove(item.id); }} className="h-8 w-8">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={v => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Editar item' : 'Novo item'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Input
                placeholder="Nome *"
                value={editing.name || ''}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
              />
              <Input
                placeholder="Categoria (ex: Infláveis, Mesas)"
                value={editing.category || ''}
                onChange={e => setEditing({ ...editing, category: e.target.value })}
              />
              <Textarea
                placeholder="Descrição"
                value={editing.description || ''}
                onChange={e => setEditing({ ...editing, description: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Preço"
                  value={editing.price ?? 0}
                  onChange={e => setEditing({ ...editing, price: Number(e.target.value) })}
                />
                <Input
                  type="number"
                  placeholder="Ordem"
                  value={editing.sort_order ?? 0}
                  onChange={e => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                />
              </div>
              <Input
                placeholder="URL da imagem (https://...)"
                value={editing.image_url || ''}
                onChange={e => setEditing({ ...editing, image_url: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.active ?? true}
                  onCheckedChange={v => setEditing({ ...editing, active: v })}
                />
                <span className="text-sm">Ativo</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar catálogo (JSON)</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Cole um array JSON. Campos aceitos: <code>name</code>, <code>description</code>,{' '}
            <code>price</code>, <code>image_url</code>, <code>category</code>, <code>active</code>,{' '}
            <code>sort_order</code>. Aliases em PT também funcionam (nome, descricao, preco, imagem,
            categoria, ordem).
          </p>
          <Textarea
            rows={12}
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder='[{"name":"Pula-pula 3x3","description":"...","price":250,"image_url":"https://...","category":"Infláveis"}]'
            className="font-mono text-xs"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={importJson}>Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}