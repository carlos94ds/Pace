import {
  REACTION_TYPES,
  type ReactionSummary,
  type ReactionTargetType,
  type ReactionType,
} from '@pace/shared';
import { Flame, Handshake, ThumbsUp, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useReact } from './queries';

export const REACTION_ICONS: Record<ReactionType, LucideIcon> = {
  respect: Handshake,
  well_done: ThumbsUp,
  keep_going: Flame,
};

/** Toggle buttons for the three reactions. Read-only for your own items. */
export function Reactions({
  targetType,
  targetId,
  summary,
  readOnly = false,
}: {
  targetType: ReactionTargetType;
  targetId: string;
  summary: ReactionSummary;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const react = useReact();
  if (readOnly && REACTION_TYPES.every((type) => summary.counts[type] === 0)) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {REACTION_TYPES.map((type) => {
        const Icon = REACTION_ICONS[type];
        const mine = summary.mine.includes(type);
        const count = summary.counts[type];
        if (readOnly && count === 0) return null;
        const label = t(`social.reactions.${type}`);
        return readOnly ? (
          <span
            key={type}
            className="tabular inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted"
            title={label}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            <span className="sr-only">{label}:</span>
            {count}
          </span>
        ) : (
          <button
            key={type}
            type="button"
            aria-pressed={mine}
            disabled={react.isPending}
            onClick={() => react.mutate({ targetType, targetId, type, on: !mine })}
            className={`tabular inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
              mine
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border text-muted hover:text-text'
            }`}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
