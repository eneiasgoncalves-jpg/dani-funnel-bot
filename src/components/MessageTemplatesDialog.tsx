import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus } from 'lucide-react';
import {
  MessageTemplate,
  getTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
} from '@/lib/messageTemplates';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}

export function MessageTemplatesDialog({ open, onOpenChange, onChanged }: Props) {
  const [list, setList] = useState<MessageTemplate[]>([]);
  const [shortcut, setShortcut] = useState('');
  const [text, setText] = useState('');

  const reload = () => setList(getTemplates());

  useEffect(() => {
    if (open) reload();
  }, [open]);

  const handleAdd = () => {
    if (!shortcut.trim() || !text.trim()) {
      toast.error('Preencha atalho e texto');
      return;
    }
    addTemplate({ shortcut: shortcut.trim().toLowerCase().replace(/\s+/g, '-'), text: text.trim() });
    setShortcut('');
    setText('');
    reload();
    onChanged?.();
    toast.success('Mensagem adicionada');
  };

  const handleDelete = (id: string) => {
    deleteTemplate(id);
    reload();
    onChanged?.();
  };

  const handleUpdate = (id: string, patch: Partial<MessageTemplate>) => {
    updateTemplate(id, patch);
    reload();
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mensagens pré-definidas</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Digite <code className="px-1 py-0.5 rounded bg-muted">\</code> no chat para abrir este menu rapidamente.
        </p>

        <div className="space-y-2 mt-3">
          {list.map(t => (
            <div key={t.id} className="border border-border rounded-md p-2 space-y-1">
              <div className="flex items-center gap-2">
                <Input
                  value={t.shortcut}
                  onChange={e => handleUpdate(t.id, { shortcut: e.target.value })}
                  className="text-xs h-8 max-w-[180px] font-mono"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 ml-auto text-destructive"
                  onClick={() => handleDelete(t.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <Textarea
                value={t.text}
                onChange={e => handleUpdate(t.id, { text: e.target.value })}
                rows={2}
                className="text-sm"
              />
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-3 mt-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Nova mensagem</p>
          <Input
            value={shortcut}
            onChange={e => setShortcut(e.target.value)}
            placeholder="Atalho (ex: saudacao)"
            className="text-xs h-8 font-mono"
          />
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Texto da mensagem..."
            rows={3}
            className="text-sm"
          />
          <Button onClick={handleAdd} size="sm" className="gap-1">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}