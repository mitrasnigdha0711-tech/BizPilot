type ForecastLike = {
  horizonDays?: number;
  projectedInflow: number | string;
  projectedOutflow: number | string;
  netCashflow: number | string;
  shortfallAmount: number | string;
  projectedBalance?: number | string | null;
};

type ForecastSummaryCardsProps = {
  forecast?: ForecastLike | null;
  currency?: string;
};

type SummaryCard = {
  key: string;
  label: string;
  value: number;
  hint: string;
  tone: 'default' | 'danger';
};

function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default function ForecastSummaryCards(props: ForecastSummaryCardsProps) {
  const { forecast = null, currency = 'USD' } = props;

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });

  const horizonLabel = forecast?.horizonDays ? `next ${forecast.horizonDays} days` : 'selected horizon';

  const inflow = toNumber(forecast?.projectedInflow);
  const outflow = toNumber(forecast?.projectedOutflow);
  const net = toNumber(forecast?.netCashflow);
  const shortfall = toNumber(forecast?.shortfallAmount);
  const balance = forecast?.projectedBalance != null ? toNumber(forecast.projectedBalance) : null;

  const cards: SummaryCard[] = [
    {
      key: 'inflow',
      label: 'Projected inflow',
      value: inflow,
      hint: `Invoices and expected payments due in the ${horizonLabel}`,
      tone: 'default',
    },
    {
      key: 'outflow',
      label: 'Projected outflow',
      value: outflow,
      hint: `Recurring bills due in the ${horizonLabel}`,
      tone: 'default',
    },
    {
      key: 'net',
      label: 'Net cashflow',
      value: net,
      hint: 'Inflow minus outflow',
      tone: net < 0 ? 'danger' : 'default',
    },
    {
      key: 'shortfall',
      label: 'Shortfall',
      value: shortfall,
      hint:
        balance === null
          ? 'Amount below zero at the lowest point'
          : `Projected balance ${formatter.format(balance)}`,
      tone: shortfall > 0 ? 'danger' : 'default',
    },
  ];

  return (
    <section data-nexen-component="nx_components_ForecastSummaryCards"
      aria-label="Cashflow summary"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
     data-nexen-id="nx-826e0a2e-0">
      {cards.map((card) => (
        <article
          key={card.key}
          className="min-w-0 rounded-[var(--radius)] border bg-card p-4 text-card-foreground shadow-sm backdrop-blur"
         data-nexen-id="nx-826e0a2e-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-826e0a2e-2">
            {card.label}
          </p>
          <p
            className={
              card.tone === 'danger'
                ? 'mt-2 truncate text-2xl font-bold text-destructive'
                : 'mt-2 truncate text-2xl font-bold text-foreground'
            }
           data-nexen-id="nx-826e0a2e-3">
            {forecast ? formatter.format(card.value) : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground" data-nexen-id="nx-826e0a2e-4">{card.hint}</p>
        </article>
      ))}
    </section>
  );
}