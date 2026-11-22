export type DeadlineItem = {
  id: string;
  name: string;
  clientName?: string | null;
  deadline: string;
  daysRemaining: number;
  isOverdue: boolean;
};

type DeadlineListProps = {
  deadlines?: DeadlineItem[] | null;
  dueSoonDays?: number;
};

type Urgency = 'overdue' | 'soon' | 'normal';

const DEFAULT_DUE_SOON_DAYS = 2;

const TONE: Record<Urgency, { row: string; badge: string }> = {
  overdue: {
    row: 'border-destructive/50 bg-destructive/10',
    badge: 'bg-destructive/15 text-destructive',
  },
  soon: {
    row: 'border-primary/50 bg-primary/10',
    badge: 'bg-primary/15 text-primary',
  },
  normal: {
    row: 'border-border bg-card/60',
    badge: 'bg-muted text-muted-foreground',
  },
};

function getUrgency(item: DeadlineItem, dueSoonDays: number): Urgency {
  if (item.isOverdue || item.daysRemaining < 0) return 'overdue';
  if (item.daysRemaining <= dueSoonDays) return 'soon';
  return 'normal';
}

function formatDeadline(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  // Fixed UTC zone keeps server and client output identical (no hydration mismatch).
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function describeDays(item: DeadlineItem): string {
  if (item.isOverdue || item.daysRemaining < 0) {
    return `${Math.abs(item.daysRemaining)}d overdue`;
  }
  if (item.daysRemaining === 0) return 'Due today';
  if (item.daysRemaining === 1) return 'Due tomorrow';
  return `In ${item.daysRemaining} days`;
}

export default function DeadlineList({
  deadlines,
  dueSoonDays = DEFAULT_DUE_SOON_DAYS,
}: DeadlineListProps) {
  const items = Array.isArray(deadlines) ? deadlines : [];

  if (items.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-border bg-card/60 p-6 text-center shadow-sm backdrop-blur">
        <p className="text-sm font-medium text-foreground" data-nexen-id="nx-17576f61-0">No upcoming deadlines</p>
        <p className="mt-1 text-sm text-muted-foreground" data-nexen-id="nx-17576f61-1">
          Projects due in the next 7 days will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3" data-nexen-id="nx-17576f61-2">
      {items.map((item) => {
        const tone = TONE[getUrgency(item, dueSoonDays)];
        return (
          <li data-nexen-component="nx_components_DeadlineList"
            key={item.id}
            className={`flex flex-col gap-2 rounded-[calc(var(--radius)-2px)] border p-4 sm:flex-row sm:items-center sm:justify-between ${tone.row}`}
           data-nexen-id="nx-17576f61-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground" data-nexen-id="nx-17576f61-4">{item.name}</p>
              {item.clientName ? (
                <p className="truncate text-xs text-muted-foreground" data-nexen-id="nx-17576f61-5">{item.clientName}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <span className="text-xs text-muted-foreground" data-nexen-id="nx-17576f61-6">{formatDeadline(item.deadline)}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone.badge}`} data-nexen-id="nx-17576f61-7">
                {describeDays(item)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}