import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface LineChartProps {
  points: { label: string; fullLabel: string; value: number }[];
  format: (value: number) => string;
  title: string;
  height?: number;
}

/** A single line over time with a hover/focus readout and a table view. */
export function LineChart({ points, format, title, height = 200 }: LineChartProps) {
  const { t } = useTranslation();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const values = points.map((p) => p.value);
  // A little room above and below, rounded to whole units, so small changes stay visible.
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);
  const padX = 8;
  const padY = 10;
  const plotH = height - 2 * padY;
  const x = (i: number) =>
    points.length === 1 ? width / 2 : padX + (i * (width - 2 * padX)) / (points.length - 1);
  const y = (v: number) => padY + ((max - v) / (max - min)) * plotH;
  const path = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ');
  const ticks = [max, (max + min) / 2, min];
  const labelEvery = Math.ceil(points.length / 8);

  const nearest = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const pos = clientX - rect.left;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(x(i) - pos) < Math.abs(x(best) - pos)) best = i;
    });
    return best;
  };

  return (
    <figure aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <figcaption id={`${id}-title`} className="sr-only">
        {title}
      </figcaption>
      <div className="flex gap-2">
        <div
          className="tabular flex w-12 shrink-0 flex-col justify-between py-1 text-right text-[11px] text-muted"
          style={{ height }}
        >
          {ticks.map((tick) => (
            <span key={tick}>{format(tick)}</span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div
            ref={ref}
            className="relative focus-visible:outline-2 focus-visible:outline-accent"
            style={{ height }}
            tabIndex={0}
            role="img"
            aria-label={title}
            onPointerMove={(e) => setActive(nearest(e.clientX))}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(points.length - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? points.length) - 1));
              if (e.key === 'ArrowRight')
                setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
            }}
          >
            <svg
              width={width}
              height={height}
              className="absolute inset-0 overflow-visible"
              aria-hidden="true"
            >
              {ticks.map((tick) => (
                <line
                  key={tick}
                  x1={0}
                  x2={width}
                  y1={y(tick)}
                  y2={y(tick)}
                  className="stroke-border"
                  strokeDasharray={tick === min ? undefined : '3 3'}
                />
              ))}
              {active !== null && (
                <line
                  x1={x(active)}
                  x2={x(active)}
                  y1={padY}
                  y2={height - padY}
                  className="stroke-muted"
                  strokeWidth={1}
                />
              )}
              <path
                d={path}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {points.map((p, i) => (
                <circle
                  key={p.fullLabel + i}
                  cx={x(i)}
                  cy={y(p.value)}
                  r={active === i ? 5 : 3.5}
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              ))}
            </svg>
            {active !== null && points[active] && (
              <div
                className="pointer-events-none absolute z-10 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg"
                style={{
                  left: Math.min(Math.max(x(active) - 60, 0), Math.max(width - 140, 0)),
                  top: Math.max(y(points[active].value) - 52, 0),
                }}
              >
                <span className="block text-muted">{points[active].fullLabel}</span>
                <b className="tabular font-semibold">{format(points[active].value)}</b>
              </div>
            )}
          </div>
          <div className="relative mt-1 h-4 text-[11px] text-muted" aria-hidden="true">
            {points.map((p, i) =>
              i % labelEvery === 0 || i === points.length - 1 ? (
                <span
                  key={p.fullLabel + i}
                  className="absolute -translate-x-1/2 whitespace-nowrap"
                  style={{ left: x(i) }}
                >
                  {p.label}
                </span>
              ) : null,
            )}
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
            <tbody className="divide-y divide-border">
              {points.map((p, i) => (
                <tr key={p.fullLabel + i}>
                  <th scope="row" className="px-3 py-1.5 font-normal">
                    {p.fullLabel}
                  </th>
                  <td className="px-3 py-1.5 text-right">{format(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
