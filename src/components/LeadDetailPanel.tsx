import { useRef, useState, useMemo, useEffect } from 'react';
import { Lead, STATUS_CONFIG, TAG_CONFIG, CHANNEL_CONFIG, LeadStatus, STAGES } from '@/types/lead';
import { X, Send, Phone, Calendar, MapPin, Users, MessageCircle, Pencil, UserPlus, Bot, BotOff, MoreVertical, Trash2, Paperclip, FileText, Loader2, BookOpen, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EditLeadDialog } from './EditLeadDialog';
import { ClienteDialog } from './ClienteDialog';
import { CatalogDialog, CatalogItem } from './CatalogDialog';
import { MessageTemplatesDialog } from './MessageTemplatesDialog';
import { getTemplates, MessageTemplate } from '@/lib/messageTemplates';

interface LeadDetailPanelProps {
  lead: Lead;
  onClose: () => void;
  onMoveStatus: (leadId: string, status: LeadStatus) => void;
  onSendMessage: (leadId: string, message: { sender: 'ai'; text: string }) => void;
  onToggleAi?: (leadId: string) => void;
}

export function LeadDetailPanel({ lead, onClose, onMoveStatus, onSendMessage, onToggleAi }: LeadDetailPanelProps) {
  const [newMessage, setNewMessage] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [clienteOpen, setClienteOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplate[]>(() => getTemplates());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStart, setPickerStart] = useState<number>(-1);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerIndex, setPickerIndex] = useState(0);

  const reloadTemplates = () => setTemplates(getTemplates());

  const filteredTemplates = useMemo(() => {
    const q = pickerQuery.toLowerCase();
    if (!q) return templates;
    return templates.filter(
      t => t.shortcut.toLowerCase().includes(q) || t.text.toLowerCase().includes(q),
    );
  }, [templates, pickerQuery]);

  useEffect(() => {
    setPickerIndex(0);
  }, [pickerQuery, pickerOpen]);

  const detectBackslashTrigger = (value: string, caret: number) => {
    // Look for the most recent "\" before the caret with no whitespace/newline between
    let i = caret - 1;
    while (i >= 0) {
      const c = value[i];
      if (c === '\\') {
        setPickerStart(i);
        setPickerQuery(value.slice(i + 1, caret));
        setPickerOpen(true);
        return;
      }
      if (c === ' ' || c === '\n' || c === '\t') break;
      i--;
    }
    setPickerOpen(false);
    setPickerStart(-1);
    setPickerQuery('');
  };

  const applyTemplate = (tpl: MessageTemplate) => {
    if (pickerStart < 0) return;
    const ta = textareaRef.current;
    const caret = ta?.selectionStart ?? newMessage.length;
    const before = newMessage.slice(0, pickerStart);
    const after = newMessage.slice(caret);
    const next = before + tpl.text + after;
    setNewMessage(next);
    setPickerOpen(false);
    setPickerStart(-1);
    setPickerQuery('');
    requestAnimationFrame(() => {
      const pos = before.length + tpl.text.length;
      ta?.focus();
      ta?.setSelectionRange(pos, pos);
    });
  };

  const handleSend = () => {
    if (!newMessage.trim()) return;
    onSendMessage(lead.id, { sender: 'ai', text: newMessage });
    setNewMessage('');
    setPickerOpen(false);
  };

  const detectMediaType = (mime: string): 'image' | 'video' | 'audio' | 'document' => {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx 20MB)');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${lead.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('chat-attachments')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      const mediaType = detectMediaType(file.type);
      await (onSendMessage as any)(lead.id, {
        sender: 'ai',
        text: newMessage,
        mediaUrl: pub.publicUrl,
        mediaType,
        mediaMime: file.type,
        fileName: file.name,
      });
      setNewMessage('');
      toast.success('Arquivo enviado');
    } catch (err: any) {
      toast.error(err?.message || 'Falha no envio');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string, scope: 'me' | 'everyone') => {
    try {
      if (scope === 'everyone' && lead.channel === 'whatsapp') {
        const { error } = await supabase.functions.invoke('delete-whatsapp-message', {
          body: { messageId, scope },
        });
        if (error) throw error;
        toast.success('Mensagem apagada para todos');
      } else {
        await supabase.from('messages').delete().eq('id', messageId);
        toast.success('Mensagem removida');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir mensagem');
    }
  };

  const handleSendCatalogItem = async (item: CatalogItem) => {
    const priceTxt = item.price
      ? `R$ ${Number(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : '';
    const lines = [
      `*${item.name}*`,
      item.description || '',
      priceTxt ? `💰 ${priceTxt}` : '',
    ].filter(Boolean);
    const caption = lines.join('\n\n');
    try {
      if (item.image_url) {
        await (onSendMessage as any)(lead.id, {
          sender: 'ai',
          text: caption,
          mediaUrl: item.image_url,
          mediaType: 'image',
          mediaMime: 'image/jpeg',
          fileName: `${item.name}.jpg`,
        });
      } else {
        onSendMessage(lead.id, { sender: 'ai', text: caption });
      }
      toast.success('Item enviado');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao enviar item');
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="font-bold text-foreground">{lead.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full text-primary-foreground ${STATUS_CONFIG[lead.status].colorClass}`}>
              {STATUS_CONFIG[lead.status].label}
            </span>
            <span className="text-xs text-muted-foreground">
              {CHANNEL_CONFIG[lead.channel].emoji} {CHANNEL_CONFIG[lead.channel].label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)} title="Editar lead" className="h-8 w-8">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setClienteOpen(true)} title="Cadastro de cliente" className="h-8 w-8">
            <UserPlus className="w-4 h-4" />
          </Button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <EditLeadDialog lead={lead} open={editOpen} onOpenChange={setEditOpen} />
      <ClienteDialog lead={lead} open={clienteOpen} onOpenChange={setClienteOpen} />
      <CatalogDialog open={catalogOpen} onOpenChange={setCatalogOpen} onSend={handleSendCatalogItem} />
      <MessageTemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} onChanged={reloadTemplates} />

      {/* Info */}
      <div className="p-4 border-b border-border space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Phone className="w-3 h-3" /> {lead.phone}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="w-3 h-3" /> {lead.eventDate ? new Date(lead.eventDate).toLocaleDateString('pt-BR') : '—'}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="w-3 h-3" /> {lead.city || '—'}{lead.neighborhood ? ` - ${lead.neighborhood}` : ''}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="w-3 h-3" /> {lead.childrenCount} crianças ({lead.childrenAge})
          </div>
        </div>
        {lead.interest && <p className="text-xs text-primary font-medium">🎈 {lead.interest}</p>}
        {/* AI toggle per lead */}
        <div className="flex items-center gap-2 pt-1">
          {lead.aiEnabled ? <Bot className="w-3.5 h-3.5 text-emerald-500" /> : <BotOff className="w-3.5 h-3.5 text-muted-foreground" />}
          <Switch
            checked={lead.aiEnabled}
            onCheckedChange={() => onToggleAi?.(lead.id)}
            className="scale-75 origin-left"
          />
          <span className={`text-[10px] font-medium ${lead.aiEnabled ? 'text-emerald-500' : 'text-muted-foreground'}`}>
            {lead.aiEnabled ? 'IA Ativa' : 'IA Desativada'}
          </span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {lead.tags.map(tag => (
            <span key={tag} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TAG_CONFIG[tag].bgClass} ${TAG_CONFIG[tag].textClass}`}>
              {TAG_CONFIG[tag].emoji} {TAG_CONFIG[tag].label}
            </span>
          ))}
        </div>
      </div>

      {/* Stage buttons */}
      <div className="p-3 border-b border-border">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Mover para</p>
        <div className="flex flex-wrap gap-1.5">
          {STAGES.filter(s => s !== lead.status).map(s => (
            <button
              key={s}
              onClick={() => onMoveStatus(lead.id, s)}
              className={`text-[10px] font-medium px-2 py-1 rounded-md text-primary-foreground ${STATUS_CONFIG[s].colorClass} hover:opacity-80 transition-opacity`}
            >
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center gap-1.5 mb-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Conversa</span>
        </div>
        {lead.messages.map(msg => (
          <div key={msg.id} className={`group flex items-start gap-1 ${msg.sender === 'ai' ? 'justify-end' : 'justify-start'}`}>
            {msg.sender === 'ai' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  <DropdownMenuItem onClick={() => handleDeleteMessage(msg.id, 'me')}>
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir para mim
                  </DropdownMenuItem>
                  {lead.channel === 'whatsapp' && (
                    <DropdownMenuItem onClick={() => handleDeleteMessage(msg.id, 'everyone')}>
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir para todos
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
              msg.sender === 'ai'
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-muted text-foreground rounded-bl-md'
            }`}>
              {msg.mediaUrl && msg.mediaType === 'image' && (
                <a href={msg.mediaUrl} target="_blank" rel="noreferrer">
                  <img src={msg.mediaUrl} alt={msg.fileName || 'imagem'} className="rounded-lg mb-1 max-h-60 object-cover" />
                </a>
              )}
              {msg.mediaUrl && msg.mediaType === 'video' && (
                <video src={msg.mediaUrl} controls className="rounded-lg mb-1 max-h-60" />
              )}
              {msg.mediaUrl && msg.mediaType === 'audio' && (
                <audio src={msg.mediaUrl} controls className="mb-1 w-full" />
              )}
              {msg.mediaUrl && (msg.mediaType === 'document' || !msg.mediaType) && (
                <a
                  href={msg.mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 underline mb-1"
                >
                  <FileText className="w-4 h-4" /> {msg.fileName || 'arquivo'}
                </a>
              )}
              {msg.text}
              <p className={`text-[10px] mt-1 ${msg.sender === 'ai' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                {msg.timestamp.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })} {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {msg.sender === 'client' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="text-xs">
                  <DropdownMenuItem onClick={() => handleDeleteMessage(msg.id, 'me')}>
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir para mim
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border relative">
        {pickerOpen && filteredTemplates.length > 0 && (
          <div className="absolute left-3 right-3 bottom-full mb-1 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto z-50">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border flex items-center justify-between">
              <span>Mensagens pré-definidas</span>
              <button
                className="text-primary hover:underline"
                onMouseDown={e => {
                  e.preventDefault();
                  setPickerOpen(false);
                  setTemplatesOpen(true);
                }}
              >
                Gerenciar
              </button>
            </div>
            {filteredTemplates.map((t, idx) => (
              <button
                key={t.id}
                onMouseDown={e => {
                  e.preventDefault();
                  applyTemplate(t);
                }}
                className={`w-full text-left px-2 py-1.5 text-xs hover:bg-accent ${
                  idx === pickerIndex ? 'bg-accent' : ''
                }`}
              >
                <div className="font-mono text-[10px] text-primary">\{t.shortcut}</div>
                <div className="text-foreground line-clamp-2">{t.text}</div>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFilePick}
          />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            title="Anexar arquivo"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setCatalogOpen(true)}
            title="Abrir catálogo"
          >
            <BookOpen className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setTemplatesOpen(true)}
            title="Mensagens pré-definidas (digite \ no chat)"
          >
            <MessageSquareText className="w-4 h-4" />
          </Button>
          <Textarea
            ref={textareaRef}
            value={newMessage}
            onChange={e => {
              const v = e.target.value;
              setNewMessage(v);
              const caret = e.target.selectionStart ?? v.length;
              detectBackslashTrigger(v, caret);
            }}
            onKeyUp={e => {
              const ta = e.currentTarget;
              if (pickerOpen) detectBackslashTrigger(ta.value, ta.selectionStart ?? 0);
            }}
            onClick={e => {
              const ta = e.currentTarget;
              detectBackslashTrigger(ta.value, ta.selectionStart ?? 0);
            }}
            onKeyDown={e => {
              if (pickerOpen && filteredTemplates.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setPickerIndex(i => Math.min(i + 1, filteredTemplates.length - 1));
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setPickerIndex(i => Math.max(i - 1, 0));
                  return;
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  applyTemplate(filteredTemplates[pickerIndex]);
                  return;
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setPickerOpen(false);
                  return;
                }
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Digitar mensagem... (Shift+Enter quebra linha)"
            rows={3}
            className="text-sm min-h-[60px] resize-none"
          />
          <Button onClick={handleSend} size="icon" className="shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
