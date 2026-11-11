import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Info, MessageCircleQuestion, type LucideIcon } from 'lucide-react';

/** Probing questions for a measure, or an empty list. */
export function useProbes(id: string): string[] {
  const { t, i18n } = useTranslation();
  const key = `dash.m.${id}.probe`;
  if (!i18n.exists(key)) return [];
  const v = t(key, { returnObjects: true });
  return Array.isArray(v) ? (v as string[]) : [];
}

export function ProbeList({ items }: { items: string[] }) {
  const { t } = useTranslation();
  return (
    // Spans only: this also renders inside the info popover, which sits in a heading.
    <span className="block rounded-lg border border-primary/20 bg-primary-soft/60 p-3 text-left">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-primary-ink"><MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden="true" />{t('dash.probeTitle')}</span>
      {items.map((q, i) => (
        <span key={q} className="mt-1.5 flex gap-2 text-sm font-normal text-ink"><span className="num shrink-0 text-primary-ink">{i + 1}.</span><span>{q}</span></span>
      ))}
    </span>
  );
}

export const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v)}%`);

/** Definition, formula and management use of one measure, behind a small info button. */
export function InfoTip({ id }: { id: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const panel = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  const name = t(`dash.m.${id}.t`);
  const probes = useProbes(id);
  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button" aria-label={t('dash.about', { name })} aria-expanded={open} aria-controls={panel}
        className="rounded-full p-0.5 text-muted transition hover:bg-subtle hover:text-primary"
        onClick={() => setOpen(!open)}
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <span id={panel} role="dialog" aria-label={name}
          className="absolute right-0 top-7 z-40 w-80 max-w-[80vw] rounded-card border border-line bg-card p-4 text-left text-sm font-normal text-ink shadow-lift sm:left-0 sm:right-auto">
          <span className="block font-semibold">{name}</span>
          {(['def', 'formula', 'use'] as const).map((k) => (
            <span key={k} className="mt-3 block">
              <span className="eyebrow block">{t(k === 'def' ? 'dash.aboutDef' : k === 'formula' ? 'dash.aboutFormula' : 'dash.aboutUse')}</span>
              <span className={`mt-0.5 block ${k === 'formula' ? 'rounded-md bg-subtle px-2 py-1 font-medium' : 'text-muted'}`}>{t(`dash.m.${id}.${k}`)}</span>
            </span>
          ))}
          {probes.length > 0 && <span className="mt-3 block"><ProbeList items={probes} /></span>}
        </span>
      )}
    </span>
  );
}

/** A dashboard card: title, the management question it answers, the measure's definition, and the content. */
export function Panel({ id, children, aside, className = '', titleOverride }: {
  id: string; children: ReactNode; aside?: ReactNode; className?: string; titleOverride?: string;
}) {
  const { t, i18n } = useTranslation();
  const qKey = `dash.m.${id}.q`;
  const probes = useProbes(id);
  const [ask, setAsk] = useState(false);
  return (
    <section className={`card p-5 ${className}`} aria-labelledby={`p-${id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`p-${id}`} className="flex items-center gap-1.5 font-semibold">
            {titleOverride ?? t(`dash.m.${id}.t`)}<InfoTip id={id} />
          </h3>
          {i18n.exists(qKey) && <p className="mt-0.5 text-sm text-muted">{t(qKey)}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {aside}
          {probes.length > 0 && (
            <button type="button" aria-expanded={ask} onClick={() => setAsk(!ask)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${ask ? 'bg-primary text-white' : 'bg-primary-soft text-primary-ink hover:bg-primary/15'}`}>
              <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden="true" />{t('dash.probeButton')}
            </button>
          )}
        </div>
      </div>
      {ask && <div className="mt-3"><ProbeList items={probes} /></div>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export type Tone = 'primary' | 'risk' | 'warn' | 'ok' | 'neutral';
const TONE: Record<Tone, { icon: string; ring: string }> = {
  primary: { icon: 'bg-primary-soft text-primary-ink', ring: '#2A5BD7' },
  risk: { icon: 'bg-risk-bg text-risk-fg', ring: '#D03B3B' },
  warn: { icon: 'bg-warn-bg text-warn-fg', ring: '#EDA100' },
  ok: { icon: 'bg-ok-bg text-ok-fg', ring: '#0CA30C' },
  neutral: { icon: 'bg-subtle text-muted', ring: '#8A94A6' },
};

/** Headline number with what it means, its definition, an optional ring, and the plant comparison. */
export function KpiCard({ id, Icon, tone, value, sub, ring, compare, onOpen, onAnalyze }: {
  id: string; Icon: LucideIcon; tone: Tone; value: string; sub: string; ring?: number | null; compare?: string | null; onOpen?: () => void; onAnalyze?: () => void;
}) {
  const { t } = useTranslation();
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={`grid h-9 w-9 place-items-center rounded-lg ${TONE[tone].icon}`}><Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" /></span>
        {ring !== undefined && <Ring pct={ring} color={TONE[tone].ring} />}
      </div>
      <p className="mt-3 text-sm font-medium text-muted">{t(`dash.m.${id}.t`)}</p>
      <p className="mt-0.5 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 pr-6 text-xs text-muted">{sub}</p>
      {compare && <p className="mt-2 inline-flex rounded-md bg-subtle px-1.5 py-0.5 text-xs text-muted">{compare}</p>}
    </>
  );
  return (
    <div className="card relative flex flex-col p-4 transition hover:shadow-lift">
      {onOpen ? (
        <button type="button" className="flex flex-1 flex-col text-left" onClick={onOpen}>{body}<span className="sr-only">{t('dash.viewList')}</span></button>
      ) : <div className="flex flex-1 flex-col">{body}</div>}
      {onAnalyze && (
        <button type="button" onClick={onAnalyze} className="mt-3 inline-flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline">
          {t('dash.viewDetail')}<ArrowRight className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
      <span className="absolute bottom-3 right-3"><InfoTip id={id} /></span>
    </div>
  );
}

export function Ring({ pct, color, size = 44 }: { pct: number | null; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E4E8F0" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`} />
    </svg>
  );
}

/** Thin horizontal bar for a share, with the comparison value marked as a tick. */
export function Meter({ pct, color, tick }: { pct: number | null; color: string; tick?: number | null }) {
  return (
    <span className="relative block h-1.5 w-full rounded-full bg-line/70" aria-hidden="true">
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%`, background: color }} />
      {tick !== null && tick !== undefined && <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-ink/60" style={{ left: `calc(${Math.min(100, tick)}% - 1px)` }} />}
    </span>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden="true" />{i.label}</li>
      ))}
    </ul>
  );
}

export function Empty() {
  const { t } = useTranslation();
  return <p className="rounded-lg bg-subtle px-3 py-6 text-center text-sm text-muted">{t('dash.noData')}</p>;
}

export function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover hover:underline">
      {children}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

/** Large figure plus a short label, for single-number panels. */
export function BigStat({ value, label, tone = 'ink' }: { value: string; label: string; tone?: 'ink' | 'risk' | 'primary' }) {
  const color = tone === 'risk' ? 'text-risk-fg' : tone === 'primary' ? 'text-primary-ink' : 'text-ink';
  return (
    <div>
      <p className={`text-4xl font-semibold tracking-tight ${color}`}>{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}
