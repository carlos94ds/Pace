import {
  GOAL_LIMITS,
  GOAL_TYPES,
  goalInputSchema,
  type Goal,
  type GoalResult,
  type GoalType,
} from '@pace/shared';
import { Check, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Dialog } from '../../components/Dialog';
import { SelectField, TextField } from '../../components/Field';
import {
  apiFieldErrors,
  fieldMessage,
  formMessage,
  validate,
  type FieldErrors,
} from '../../lib/forms';
import { sportName } from '../profile/sports';
import { useSports } from '../training/queries';
import { goalLabel, goalValue } from './goalText';
import { useDeleteGoal, useGoals, useSaveGoal } from './queries';

/** This week's progress towards each active goal. */
export function GoalsCard({ results }: { results: GoalResult[] | undefined }) {
  const { t, i18n } = useTranslation();
  const [managing, setManaging] = useState(false);

  return (
    <Card
      title={t('goals.title')}
      description={t('goals.thisWeek')}
      actions={
        <Button variant="secondary" onClick={() => setManaging(true)}>
          {results?.length ? t('goals.manage') : t('goals.add')}
        </Button>
      }
    >
      {results && results.length === 0 && (
        <div className="flex items-start gap-3 text-sm text-muted">
          <Target className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{t('goals.empty')}</p>
        </div>
      )}
      <ul className="flex flex-col gap-4">
        {results?.map((r, i) => {
          const progress = Math.min(1, r.target ? r.actual / r.target : 0);
          return (
            <li key={`${r.type}-${r.sport?.id ?? i}`}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  {r.achieved && (
                    <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                  )}
                  <span className="truncate">{goalLabel(t, r, i18n.language)}</span>
                </span>
                <span className="tabular shrink-0 text-muted">
                  <b className="font-semibold text-text">
                    {goalValue(t, r, r.actual, i18n.language)}
                  </b>{' '}
                  / {goalValue(t, r, r.target, i18n.language)}
                  <span className="sr-only">
                    {r.achieved ? t('goals.achieved') : t('goals.notYet')}
                  </span>
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                aria-label={goalLabel(t, r, i18n.language)}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${r.achieved ? 'bg-success' : 'bg-accent'}`}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <Dialog open={managing} title={t('goals.manageTitle')} onClose={() => setManaging(false)}>
        {managing && (
          <GoalManager startWithForm={results?.length === 0} onClose={() => setManaging(false)} />
        )}
      </Dialog>
    </Card>
  );
}

function GoalManager({ startWithForm, onClose }: { startWithForm: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const goals = useGoals();
  const remove = useDeleteGoal();
  // Without any goals there's nothing to manage yet: go straight to the form.
  const [editing, setEditing] = useState<Goal | 'new' | null>(startWithForm ? 'new' : null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t('goals.manageHelp')}</p>
      {goals.data && goals.data.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {goals.data.map((goal) =>
            editing !== 'new' && editing?.id === goal.id ? (
              <li key={goal.id} className="p-2">
                <GoalForm goal={goal} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={goal.id} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 text-sm">{goalLabel(t, goal, i18n.language)}</span>
                <Button
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => setEditing(goal)}
                  aria-label={`${t('goals.edit')}: ${goalLabel(t, goal, i18n.language)}`}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 px-2 hover:text-danger"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(goal.id)}
                  aria-label={`${t('goals.delete')}: ${goalLabel(t, goal, i18n.language)}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
      {remove.error && <Alert>{formMessage(t, remove.error)}</Alert>}
      {editing === 'new' ? (
        <GoalForm onDone={() => setEditing(null)} />
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden="true" />
            {t('goals.add')}
          </Button>
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      )}
    </div>
  );
}

const DEFAULT_TARGET: Record<GoalType, string> = {
  total_minutes: '10',
  training_days: '5',
  punctuality_pct: '90',
  sport_sessions: '3',
};

function GoalForm({ goal, onDone }: { goal?: Goal; onDone: () => void }) {
  const { t } = useTranslation();
  const sports = useSports();
  const save = useSaveGoal();
  const [type, setType] = useState<GoalType>(goal?.type ?? 'training_days');
  // Hour goals are entered in hours and stored in minutes.
  const [target, setTarget] = useState(
    goal
      ? String(goal.type === 'total_minutes' ? goal.target / 60 : goal.target)
      : DEFAULT_TARGET['training_days'],
  );
  const [sportId, setSportId] = useState(goal?.sport?.id ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const hours = type === 'total_minutes';
  const limits = GOAL_LIMITS[type];

  function submit() {
    const number = Number(target.replace(',', '.'));
    const { data, errors } = validate(goalInputSchema, {
      type,
      target: target === '' ? undefined : Math.round(hours ? number * 60 : number),
      sportId: type === 'sport_sessions' ? sportId || null : null,
    });
    setErrors(errors ?? {});
    if (!data) return;
    save.mutate(
      { id: goal?.id, input: data },
      { onSuccess: onDone, onError: (e) => setErrors(apiFieldErrors(e)) },
    );
  }

  const rangeHint = hours
    ? t('goals.form.rangeHours', { min: limits.min / 60, max: limits.max / 60 })
    : t('goals.form.range', { min: limits.min, max: limits.max });
  const otherError = save.error && !Object.keys(apiFieldErrors(save.error)).length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <SelectField
        label={t('goals.form.type')}
        value={type}
        disabled={Boolean(goal)}
        onChange={(e) => {
          const next = e.target.value as GoalType;
          setType(next);
          setTarget(DEFAULT_TARGET[next]);
          setErrors({});
        }}
        error={errors.type === 'taken' ? t('goals.form.taken') : undefined}
      >
        {GOAL_TYPES.map((g) => (
          <option key={g} value={g}>
            {t(`goals.types.${g}`)}
          </option>
        ))}
      </SelectField>
      {type === 'sport_sessions' && (
        <SelectField
          label={t('training.fields.sport')}
          value={sportId}
          onChange={(e) => setSportId(e.target.value)}
          error={fieldMessage(t, 'goalSport', errors.sportId)}
        >
          <option value="" disabled>
            {t('training.form.chooseSport')}
          </option>
          {(sports.data ?? [])
            .map((s) => ({ id: s.id, label: sportName(t, s) }))
            .sort((a, b) => a.label.localeCompare(b.label))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
        </SelectField>
      )}
      <TextField
        label={t(`goals.form.target.${type}`)}
        type="number"
        inputMode={hours ? 'decimal' : 'numeric'}
        step={hours ? 0.5 : 1}
        min={hours ? limits.min / 60 : limits.min}
        max={hours ? limits.max / 60 : limits.max}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        hint={rangeHint}
        error={errors.target ? rangeHint : undefined}
      />
      {otherError && <p className="text-xs text-danger">{formMessage(t, save.error)}</p>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={save.isPending}>
          {goal ? t('common.save') : t('goals.add')}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
