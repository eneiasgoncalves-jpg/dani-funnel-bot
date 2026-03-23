interface StatsCardsProps {
  stats: {
    total: number;
    novo: number;
    analise: number;
    proposta: number;
    contra_proposta: number;
    fechado: number;
    perdido: number;
  };
}

const cards = [
  { key: 'total' as const, label: 'Total de Leads', emoji: '📊', colorClass: 'border-primary/30' },
  { key: 'novo' as const, label: 'Novos', emoji: '🆕', colorClass: 'border-stage-new/30' },
  { key: 'analise' as const, label: 'Em Análise', emoji: '🔍', colorClass: 'border-stage-analysis/30' },
  { key: 'fechado' as const, label: 'Fechados', emoji: '✅', colorClass: 'border-stage-closed/30' },
];

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(card => (
        <div key={card.key} className={`bg-card rounded-xl p-4 border-l-4 ${card.colorClass} shadow-sm`}>
          <p className="text-xs text-muted-foreground">{card.emoji} {card.label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats[card.key]}</p>
        </div>
      ))}
    </div>
  );
}
