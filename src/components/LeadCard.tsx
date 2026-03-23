import { Lead, TAG_CONFIG, CHANNEL_CONFIG } from '@/types/lead';
import { Phone, Calendar, MapPin, Users } from 'lucide-react';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-card rounded-lg p-3.5 shadow-sm border border-border hover:shadow-md transition-shadow cursor-pointer animate-fade-in"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-card-foreground text-sm truncate">{lead.name}</h4>
        <span className="text-xs text-muted-foreground ml-2 shrink-0">
          {CHANNEL_CONFIG[lead.channel].emoji}
        </span>
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
