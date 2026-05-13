import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Send, Search } from 'lucide-react';
import { toast } from 'sonner';

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  category: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSend: (item: CatalogItem) => Promise<void> | void;
}

export function CatalogDialog({ open, onOpenChange, onSend }: Props) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('catalog_items')
      .select('id,name,description,price,image_url,category')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setItems((data || []) as CatalogItem[]);
        setLoading(false);
      });
  }, [open]);

  const filtered = items.filter(i => {
    const t = q.toLowerCase().trim();
    if (!t) return true;
    return (
      i.name.toLowerCase().includes(t) ||
      (i.description || '').toLowerCase().includes(t) ||
      (i.category || '').toLowerCase().includes(t)
    );
  });

  const handleSend = async (item: CatalogItem) => {
    setSendingId(item.id);
    try {
      await onSend(item);
      onOpenChange(false);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Catálogo de produtos</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, categoria..."
            className="pl-8"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <ScrollArea className="h-[60vh] pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              Nenhum item no catálogo. Cadastre em <code>/catalogo</code>.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map(item => (
                <div key={item.id} className="border border-border rounded-lg p-3 flex gap-3 bg-card">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-20 h-20 rounded-md object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-md bg-muted shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{item.name}</p>
                    {item.category && (
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {item.category}
                      </p>
                    )}
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-bold text-primary">
                        {item.price
                          ? `R$ ${Number(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : '—'}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleSend(item)}
                        disabled={sendingId === item.id}
                      >
                        {sendingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Enviar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}