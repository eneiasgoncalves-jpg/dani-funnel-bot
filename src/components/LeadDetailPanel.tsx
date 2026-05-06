import { useRef, useState } from 'react';
import { Lead, STATUS_CONFIG, TAG_CONFIG, CHANNEL_CONFIG, LeadStatus, STAGES } from '@/types/lead';
import { X, Send, Phone, Calendar, MapPin, Users, MessageCircle, Pencil, UserPlus, Bot, BotOff, MoreVertical, Trash2, Paperclip, FileText, Loader2 } from 'lucide-react';
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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    onSendMessage(lead.id, { sender: 'ai', text: newMessage });
    setNewMessage('');
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
                {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
      <div className="p-3 border-t border-border">
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
          <Textarea
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => {
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
