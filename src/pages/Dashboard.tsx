import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Users, TrendingUp, DollarSign, UserX, ArrowLeft, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import logoDani from '@/assets/logo-dani.jpg';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadRow {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  channel: string;
  status: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  novo: { label: 'Novo', className: 'bg-blue-500/15 text-blue-700 border-blue-500/30' },
  analise: { label: 'Em Análise', className: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30' },
  proposta: { label: 'Proposta', className: 'bg-orange-500/15 text-orange-700 border-orange-500/30' },
  contra_proposta: { label: 'Contra-proposta', className: 'bg-purple-500/15 text-purple-700 border-purple-500/30' },
  fechado: { label: 'Fechado', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' },
  perdido: { label: 'Perdido', className: 'bg-red-500/15 text-red-700 border-red-500/30' },
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  google: 'Google',
  site: 'Site',
  indicacao: 'Indicação',
};

const PIE_COLORS = ['hsl(16, 85%, 58%)', 'hsl(45, 93%, 58%)', 'hsl(280, 60%, 55%)', 'hsl(200, 70%, 50%)', 'hsl(142, 71%, 45%)'];

const monthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    options.push({
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy', { locale: ptBR }),
    });
  }
  return options;
};

export default function Dashboard() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [allLeads, setAllLeads] = useState<LeadRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setAllLeads(data as unknown as LeadRow[]);
  };

  const fetchLeads = async () => {
    setLoading(true);
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));

    const { data } = await supabase
      .from('leads')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false });

    if (data) setLeads(data as unknown as LeadRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { fetchLeads(); }, [selectedMonth]);

  // Realtime: refresh on any change to leads_analytics
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-analytics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads_analytics' }, () => {
        fetchAll();
        fetchLeads();
      })
      .subscribe();

    // Also poll every 30s as a safety net
    const interval = setInterval(() => {
      fetchAll();
      fetchLeads();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [selectedMonth]);

  const stats = useMemo(() => {
    const total = leads.length;
    const fechados = leads.filter(l => l.status === 'fechado').length;
    const taxa = total > 0 ? ((fechados / total) * 100).toFixed(1) : '0';
    const perdidos = leads.filter(l => l.status === 'perdido').length;
    return { total, taxa, fechados, perdidos };
  }, [leads]);

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => {
      const label = CHANNEL_LABELS[l.channel] || l.channel;
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [leads]);

  const barData = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const entradas = allLeads.filter(l => {
        const de = new Date(l.created_at);
        return de >= start && de <= end;
      }).length;
      const fechamentos = allLeads.filter(l => {
        if (l.status !== 'fechado') return false;
        const du = new Date(l.updated_at);
        return du >= start && du <= end;
      }).length;
      months.push({
        month: format(d, 'MMM', { locale: ptBR }),
        Entradas: entradas,
        Fechamentos: fechamentos,
      });
    }
    return months;
  }, [allLeads]);

  const recentLeads = leads.slice(0, 20);

  const pieChartConfig = {
    'Meta Ads': { label: 'Meta Ads', color: PIE_COLORS[0] },
    'Google Ads': { label: 'Google Ads', color: PIE_COLORS[1] },
    'Orgânico': { label: 'Orgânico', color: PIE_COLORS[2] },
  };

  const barChartConfig = {
    Entradas: { label: 'Entradas', color: 'hsl(16, 85%, 58%)' },
    Fechamentos: { label: 'Fechamentos', color: 'hsl(142, 71%, 45%)' },
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center">
        <img src={logoDani} alt="" className="w-[400px] opacity-[0.25]" />
      </div>
      <header className="border-b border-border bg-card/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Dashboard de Métricas</h1>
              <p className="text-[11px] text-muted-foreground">Dani Locações • Análise de Performance</p>
            </div>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions().map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-5 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de Leads</p>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <TrendingUp className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
                  <p className="text-2xl font-bold text-foreground">{stats.taxa}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vendas Fechadas</p>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.fechados}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <UserX className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Desistências</p>
                  <p className="text-2xl font-bold text-foreground">{stats.desistencias}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Origem dos Leads</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ChartContainer config={pieChartConfig} className="h-[280px] w-full">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados para o período
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funil Mensal (6 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={barChartConfig} className="h-[280px] w-full">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="Entradas" fill="hsl(16, 85%, 58%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Fechamentos" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {loading ? 'Carregando...' : 'Nenhum lead encontrado no período'}
                    </TableCell>
                  </TableRow>
                ) : (
                  recentLeads.map(lead => {
                    const badge = STATUS_BADGE[lead.status] || STATUS_BADGE.aberto;
                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="text-sm">
                          {format(new Date(lead.data_entrada), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="text-sm font-mono">{lead.cliente_whatsapp}</TableCell>
                        <TableCell className="text-sm">{lead.cidade || '—'}</TableCell>
                        <TableCell className="text-sm">{lead.plataforma}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={badge.className}>
                            {badge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
