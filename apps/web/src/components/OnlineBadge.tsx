import type { PresenceStatus } from '../lib/types';

export function formatLastSeen(lastSeenAt?: string | null): string {
  if (!lastSeenAt) return 'Hors ligne';
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  if (Number.isNaN(diffMs) || diffMs < 60_000) return 'Vu à l’instant';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `Vu il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Vu il y a ${hours} h`;
  return `Vu le ${new Date(lastSeenAt).toLocaleDateString('fr-FR')}`;
}

export function OnlineBadge({
  isOnline,
  lastSeenAt,
  fallback,
  compact = false,
  dark = false,
}: {
  isOnline?: boolean;
  lastSeenAt?: string | null;
  fallback?: PresenceStatus;
  compact?: boolean;
  dark?: boolean;
}) {
  const online = isOnline ?? fallback?.isOnline ?? false;
  const seen = lastSeenAt ?? fallback?.lastSeenAt ?? null;

  if (online) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-sans font-semibold ${
          compact ? 'text-[10px]' : 'text-[11px]'
        } ${dark ? 'text-emerald-300' : 'text-seve'}`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-seve opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-seve" />
        </span>
        <span>En ligne</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-sans ${
        compact ? 'text-[10px]' : 'text-[11px]'
      } ${dark ? 'text-brume/55' : 'text-encre/55'}`}
      title={seen ? formatLastSeen(seen) : 'Actuellement déconnecté'}
    >
      <span className={`h-2 w-2 rounded-full shrink-0 ${dark ? 'bg-brume/30' : 'bg-encre/25'}`} />
      <span>{seen ? formatLastSeen(seen) : 'Hors ligne'}</span>
    </span>
  );
}
