import { useLeads } from '@/hooks/useLeads';
import { KanbanBoard } from '@/components/KanbanBoard';
import { LeadDetailPanel } from '@/components/LeadDetailPanel';
import { StatsCards } from '@/components/StatsCards';

const Index = () => {
  const {
    selectedLead,
    setSelectedLeadId,
    moveLeadToStatus,
    addMessage,
    getLeadsByStatus,
    stats,
  } = useLeads();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎪</span>
            <div>
              <h1 className="text-lg font-bold text-foreground">Dani Locações</h1>
              <p className="text-[11px] text-muted-foreground">CRM de Vendas • Brinquedos Infláveis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
              💬 Atendimento Automático Ativo
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1600px] mx-auto px-4 py-5 space-y-5">
        <StatsCards stats={stats} />
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Funil de Vendas</h2>
          <KanbanBoard
            getLeadsByStatus={getLeadsByStatus}
            onLeadClick={setSelectedLeadId}
          />
        </div>
      </main>

      {/* Detail Panel */}
      {selectedLead && (
        <>
          <div
            className="fixed inset-0 bg-foreground/20 z-40"
            onClick={() => setSelectedLeadId(null)}
          />
          <LeadDetailPanel
            lead={selectedLead}
            onClose={() => setSelectedLeadId(null)}
            onMoveStatus={moveLeadToStatus}
            onSendMessage={addMessage}
          />
        </>
      )}
    </div>
  );
};

export default Index;
