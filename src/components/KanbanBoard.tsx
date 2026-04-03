import { Lead, LeadStatus, STATUS_CONFIG, STAGES } from '@/types/lead';
import { LeadCard } from './LeadCard';

interface KanbanBoardProps {
  getLeadsByStatus: (status: LeadStatus) => Lead[];
  onLeadClick: (leadId: string) => void;
  getUnreadCount?: (leadId: string) => number;
  onDeleteLead?: (leadId: string) => void;
  onArchiveLead?: (leadId: string) => void;
}

export function KanbanBoard({ getLeadsByStatus, onLeadClick, getUnreadCount, onDeleteLead, onArchiveLead }: KanbanBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 px-1">
      {STAGES.map(status => {
        const config = STATUS_CONFIG[status];
        const leads = getLeadsByStatus(status);
        return (
          <div key={status} className="min-w-[280px] max-w-[300px] flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2.5 h-2.5 rounded-full ${config.colorClass}`} />
              <h3 className="font-semibold text-sm text-foreground">{config.label}</h3>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {leads.length}
              </span>
            </div>
            <div className="space-y-2.5 min-h-[200px] bg-muted/50 rounded-xl p-2.5">
              {leads.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum lead</p>
              ) : (
                leads.map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onClick={() => onLeadClick(lead.id)}
                    unreadCount={getUnreadCount?.(lead.id) ?? 0}
                    onDelete={onDeleteLead}
                    onArchive={onArchiveLead}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
