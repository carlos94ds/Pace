import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface BarSeries {
  id: string;
  name: string;
  /** A CSS colour, normally a token such as var(--accent). */
  color: string;
  values: number[];
}

interface BarChartProps {
  /** Short axis label and full tooltip label per category. */
  categories: { label: string; fullLabel: string }[];
  series: BarSeries[];
  format: (value: number) => string;
  /** Accessible name of the chart, also the table caption. */
  title: string;
  height?: number;
}

/** 0, ½ and the top: a rounded maximum so the grid lines fall on readable values. */
function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= value)!;
  return step * magnitude;
}

/**
 * Vertical bars, one or two series side by side. Every category is focusable and shows
 * its values in a tooltip; the same numbers are available as a table.
 */
export function BarChart({ categories, series, format, title, height = 200 }: BarChartProps) {
  const { t } = useTranslation();
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  // Thin out axis labels so they never collide.
  const labelEvery = Math.ceil(categories.length / 12);
  const ticks = [max, max / 2, 0];

  return (
    <figure aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <figcaption id={`${id}-title`} className="sr-only">
        {title}
      </figcaption>
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-4 text-xs text-muted" aria-hidden="true">
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2" style={{ height }}>
        {/* Y axis */}
        <div className="tabular flex w-10 shrink-0 flex-col justify-between pb-5 text-right text-[11px] text-muted">
          {ticks.map((tick) => (
            <span key={tick} className="-translate-y-1/2 first:translate-y-0 last:translate-y-1/2">
              {format(tick)}
            </span>
          ))}
        </div>
        <div className="relative flex min-w-0 flex-1 flex-col">
          {/* Recessive grid */}
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between">
            {ticks.map((tick) => (
              <div
                key={tick}
                className={`border-t ${tick === 0 ? 'border-border' : 'border-border/50 border-dashed'}`}
              />
            ))}
          </div>
          <div className="relative flex flex-1 items-stretch">
            {categories.map((category, i) => (
              <button
                key={category.fullLabel}
                type="button"
                className="group relative flex min-w-0 flex-1 flex-col focus-visible:outline-none"
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((a) => (a === i ? null : a))}
                aria-label={`${category.fullLabel}: ${series.map((s) => `${series.length > 1 ? `${s.name} ` : ''}${format(s.values[i] ?? 0)}`).join(', ')}`}
              >
                <span
                  className={`flex flex-1 items-end justify-center gap-0.5 rounded-md px-[12%] transition-colors duration-150 ${
                    active === i ? 'bg-surface-2' : ''
                  } group-focus-visible:outline-2 group-focus-visible:outline-accent`}
                >
                  {series.map((s) => {
                    const value = s.values[i] ?? 0;
                    return (
                      <span
                        key={s.id}
                        className="w-full max-w-6 rounded-t-[4px] transition-[height] duration-300"
                        style={{
                          height: `${(value / max) * 100}%`,
                          minHeight: value > 0 ? 2 : 0,
                          backgroundColor: s.color,
                        }}
                      />
                    );
                  })}
                </span>
                <span className="h-5 truncate pt-1 text-center text-[11px] text-muted">
                  {i % labelEvery === 0 ? category.label : ''}
                </span>
                {active === i && (
                  <span
                    role="presentation"
                    className={`pointer-events-none absolute bottom-full z-10 mb-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-left text-xs whitespace-nowrap shadow-lg ${
                      i < categories.length / 2 ? 'left-0' : 'right-0'
                    }`}
                  >
                    <span className="block text-muted">{category.fullLabel}</span>
                    {series.map((s) => (
                      <span key={s.id} className="flex items-center gap-1.5">
                        {series.length > 1 && (
                          <span
                            className="h-0.5 w-3 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                        )}
                        <b className="tabular font-semibold text-text">
                          {format(s.values[i] ?? 0)}
                        </b>
                        {series.length > 1 && <span className="text-muted">{s.name}</span>}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted hover:text-text">
          {t('charts.showTable')}
        </summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-border">
          <table className="tabular w-full text-left text-xs">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  {t('charts.period')}
                </th>
                {series.map((s) => (
                  <th key={s.id} scope="col" className="px-3 py-1.5 text-right font-medium">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((c, i) => (
                <tr key={c.fullLabel}>
                  <th scope="row" className="px-3 py-1.5 font-normal">
                    {c.fullLabel}
                  </th>
                  {series.map((s) => (
                    <td key={s.id} className="px-3 py-1.5 text-right">
                      {format(s.values[i] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
