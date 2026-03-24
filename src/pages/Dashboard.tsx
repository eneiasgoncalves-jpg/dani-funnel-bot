import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Users, TrendingUp, DollarSign, UserX, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadAnalytics {
  id: string;
  cliente_whatsapp: string;
  cidade: string | null;
  plataforma: string;
  status: string;
  data_entrada: string;
  data_fechamento: string | null;
  valor_contrato: number | null;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  fechado: { label: 'Fechado', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' },
  em_analise: { label: 'Em Análise', className: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30' },
  aberto: { label: 'Aberto', className: 'bg-blue-500/15 text-blue-700 border-blue-500/30' },
  desistente: { label: 'Desistente', className: 'bg-red-500/15 text-red-700 border-red-500/30' },
};

const PIE_COLORS = ['hsl(16, 85%, 58%)', 'hsl(45, 93%, 58%)', 'hsl(280, 60%, 55%)'];

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
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadAnalytics[]>([]);
  const [allLeads, setAllLeads] = useState<LeadAnalytics[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const { data } = await supabase
        .from('leads_analytics')
        .select('*')
        .order('data_entrada', { ascending: false });
      if (data) setAllLeads(data as unknown as LeadAnalytics[]);
    };
    fetchAll();
  }, []);

  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      const [year, month] = selectedMonth.split('-').map(Number);
      const start = startOfMonth(new Date(year, month - 1));
      const end = endOfMonth(new Date(year, month - 1));

      const { data } = await supabase
        .from('leads_analytics')
        .select('*')
        .gte('data_entrada', start.toISOString())
        .lte('data_entrada', end.toISOString())
        .order('data_entrada', { ascending: false });

      if (data) setLeads(data as unknown as LeadAnalytics[]);
      setLoading(false);
    };
    fetchLeads();
  }, [selectedMonth]);

  const stats = useMemo(() => {
    const total = leads.length;
    const fechados = leads.filter(l => l.status === 'fechado');
    const taxa = total > 0 ? ((fechados.length / total) * 100).toFixed(1) : '0';
    const vendas = fechados.reduce((sum, l) => sum + (l.valor_contrato || 0), 0);
    const desistencias = leads.filter(l => l.status === 'desistente').length;
    return { total, taxa, vendas, desistencias };
  }, [leads]);

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => {
      map[l.plataforma] = (map[l.plataforma] || 0) + 1;
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
        const de = new Date(l.data_entrada);
        return de >= start && de <= end;
      }).length;
      const fechamentos = allLeads.filter(l => {
        if (!l.data_fechamento) return false;
        const df = new Date(l.data_fechamento);
        return df >= start && df <= end;
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
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
                    R$ {stats.vendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
