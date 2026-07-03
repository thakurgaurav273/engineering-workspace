import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type Status, statusLabel } from "@/lib/mock-data";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 lg:px-8 py-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-muted-foreground max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 lg:px-8 py-6", className)}>{children}</div>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-lg border border-border bg-card", className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Avatar({ initials, color, size = "md" }: { initials: string; color: string; size?: "xs" | "sm" | "md" | "lg" | "xl" }) {
  const sizes = { xs: "h-5 w-5 text-[9px]", sm: "h-7 w-7 text-[10.5px]", md: "h-9 w-9 text-[12px]", lg: "h-12 w-12 text-[14px]", xl: "h-16 w-16 text-[18px]" };
  return (
    <div className={cn("grid place-items-center rounded-full text-white font-semibold shrink-0", color, sizes[size])}>
      {initials}
    </div>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    on_track: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    blocked: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
    completed: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  };
  const dot: Record<Status, string> = {
    on_track: "bg-emerald-500", blocked: "bg-rose-500", completed: "bg-blue-500",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", styles[status])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[status])} />
      {statusLabel(status)}
    </span>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "info" | "success" | "warning"; className?: string }) {
  const tones = {
    neutral: "border-border bg-surface text-muted-foreground",
    info: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  };
  return <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium", tones[tone], className)}>{children}</span>;
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Metric({ label, value, delta, deltaTone = "success", hint }: { label: string; value: string | number; delta?: string; deltaTone?: "success" | "warning" | "neutral"; hint?: string }) {
  const tone = deltaTone === "success" ? "text-emerald-600 dark:text-emerald-400" : deltaTone === "warning" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-[11.5px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="font-mono-num text-[26px] font-semibold text-foreground leading-none">{value}</div>
        {delta && <div className={cn("text-[11.5px] font-medium font-mono-num", tone)}>{delta}</div>}
      </div>
      {hint && <div className="mt-1.5 text-[11.5px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 px-6 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-lg bg-muted text-muted-foreground mb-4">{icon}</div>
      <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 text-[12.5px] text-muted-foreground max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Button({ children, variant = "primary", size = "md", className, ...props }: { children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "outline"; size?: "sm" | "md" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants = {
    primary: "bg-foreground text-background hover:bg-foreground/90 border-transparent",
    secondary: "bg-surface-2 text-foreground hover:bg-accent border-border",
    outline: "bg-transparent text-foreground hover:bg-accent border-border",
    ghost: "bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent border-transparent",
  };
  const sizes = { sm: "h-7 px-2.5 text-[12px]", md: "h-8 px-3 text-[12.5px]" };
  return (
    <button {...props} className={cn("inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 disabled:pointer-events-none", variants[variant], sizes[size], className)}>
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex items-center rounded border border-border bg-surface px-1.5 py-0.5 font-mono-num text-[10px] text-muted-foreground">{children}</kbd>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function SkeletonLine({ className }: { className?: string }) {
  return <Skeleton className={cn("h-3.5", className)} />;
}

export function SkeletonStat() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-2.5 w-14" />
      <Skeleton className="h-5 w-10" />
    </div>
  );
}

export function SkeletonPersonCard() {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-full shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full shrink-0" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-border">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-2.5 w-8" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
    </Card>
  );
}

export function SkeletonListItem({ lines = 2 }: { lines?: number }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
          ))}
        </div>
      </div>
    </Card>
  );
}

export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="border-b border-border last:border-0">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 px-3">
          <Skeleton className="h-3.5 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}
