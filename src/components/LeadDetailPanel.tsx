import { useState } from 'react';
import { Lead, STATUS_CONFIG, TAG_CONFIG, CHANNEL_CONFIG, LeadStatus, STAGES } from '@/types/lead';
import { X, Send, Phone, Calendar, MapPin, Users, MessageCircle, Pencil, UserPlus, Bot, BotOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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

  const handleSend = () => {
    if (!newMessage.trim()) return;
    onSendMessage(lead.id, { sender: 'ai', text: newMessage });
    setNewMessage('');
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
          <div key={msg.id} className={`flex ${msg.sender === 'ai' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
              msg.sender === 'ai'
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-muted text-foreground rounded-bl-md'
            }`}>
              {msg.text}
              <p className={`text-[10px] mt-1 ${msg.sender === 'ai' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Digitar mensagem..."
            className="text-sm"
          />
          <Button onClick={handleSend} size="icon" className="shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
