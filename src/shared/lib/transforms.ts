const COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
  "bg-fuchsia-500", "bg-orange-500", "bg-lime-500", "bg-sky-500",
];

export function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

export function userInitials(firstName: string, lastName: string): string {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}

export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

export function relativeTime(d: string | Date): string {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24);
  if (dy === 1) return 'yesterday';
  return `${dy}d ago`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fmtDateFull(d: string | Date | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function weekLabel(weekStart: string | Date): string {
  return new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
