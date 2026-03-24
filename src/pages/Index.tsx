import { useState, useEffect } from 'react';
import { useLeads } from '@/hooks/useLeads';
import { KanbanBoard } from '@/components/KanbanBoard';
import { LeadDetailPanel } from '@/components/LeadDetailPanel';
import { StatsCards } from '@/components/StatsCards';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import logoDani from '@/assets/logo-dani.jpg';

const Index = () => {
  const navigate = useNavigate();
  const {
    selectedLead,
    setSelectedLeadId,
    moveLeadToStatus,
    addMessage,
    getLeadsByStatus,
    stats,
  } = useLeads();

  const [autoAttendance, setAutoAttendance] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSetting = async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'auto_attendance')
        .single();
      if (data) setAutoAttendance(data.value === true);
    };
    fetchSetting();
  }, []);

  const toggleAutoAttendance = async () => {
    setLoading(true);
    const newValue = !autoAttendance;
    const { error } = await supabase
      .from('settings')
      .update({ value: newValue, updated_at: new Date().toISOString() })
      .eq('key', 'auto_attendance');

    if (error) {
      toast.error('Erro ao alterar configuração');
    } else {
      setAutoAttendance(newValue);
      toast.success(newValue ? 'Atendimento automático ativado' : 'Atendimento automático desativado');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div
        className="fixed inset-0 z-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url(${logoDani})`,
          backgroundRepeat: 'repeat',
          backgroundSize: '220px',
          backgroundPosition: 'center',
        }}
      />
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎪</span>
            <div>
              <h1 className="text-lg font-bold text-foreground">Dani Locações</h1>
              <p className="text-[11px] text-muted-foreground">CRM de Vendas • Brinquedos Infláveis</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')} className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </Button>
            <div className="flex items-center gap-2">
              <Switch
                checked={autoAttendance}
                onCheckedChange={toggleAutoAttendance}
                disabled={loading}
              />
              <span className={`text-xs px-3 py-1.5 rounded-full ${
                autoAttendance
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {autoAttendance ? '🤖 IA Ativa' : '⏸️ IA Pausada'}
              </span>
            </div>
          </div>
        </div>
      </header>

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
