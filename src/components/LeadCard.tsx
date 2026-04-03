import { Lead, TAG_CONFIG, CHANNEL_CONFIG } from '@/types/lead';
import { Phone, Calendar, MapPin, Users, CheckCircle2, Clock, Trash2, Archive } from 'lucide-react';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  unreadCount?: number;
  onDelete?: (leadId: string) => void;
  onArchive?: (leadId: string) => void;
}

export function LeadCard({ lead, onClick, unreadCount = 0, onDelete, onArchive }: LeadCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-card rounded-lg p-3.5 shadow-sm border border-border hover:shadow-md transition-shadow cursor-pointer animate-fade-in relative"
    >
      {/* Unread badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5 shadow-md">
          {unreadCount}
        </span>
      )}

      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-card-foreground text-sm truncate">{lead.name}</h4>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {CHANNEL_CONFIG[lead.channel].emoji}
          </span>
          {onArchive && (
            <button
              onClick={(e) => { e.stopPropagation(); onArchive(lead.id); }}
              className="text-muted-foreground hover:text-primary p-0.5 rounded transition-colors"
              title="Arquivar"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}
              className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1 mb-2.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="w-3 h-3" />
          <span>{lead.phone}</span>
        </div>
        {lead.eventDate && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{new Date(lead.eventDate).toLocaleDateString('pt-BR')}</span>
          </div>
        )}
        {lead.city && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{lead.city}{lead.neighborhood ? ` - ${lead.neighborhood}` : ''}</span>
          </div>
        )}
        {lead.childrenCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>{lead.childrenCount} crianças ({lead.childrenAge})</span>
          </div>
        )}
      </div>

      {lead.interest && (
        <p className="text-xs text-primary font-medium mb-2">🎈 {lead.interest}</p>
      )}

      {lead.status === 'fechado' && (
        <div className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full mb-2 ${
          lead.feedbackSent
            ? 'bg-emerald-500/10 text-emerald-600'
            : 'bg-amber-500/10 text-amber-600'
        }`}>
          {lead.feedbackSent ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {lead.feedbackSent ? 'Feedback Enviado' : 'Feedback Pendente'}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {lead.tags.map(tag => {
          const config = TAG_CONFIG[tag];
          return (
            <span
              key={tag}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${config.bgClass} ${config.textClass}`}
            >
              {config.emoji} {config.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
