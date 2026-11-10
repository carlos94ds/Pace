import {
  INJURY_NOTE_MAX,
  MAX_SESSION_MINUTES,
  REFLECTION_MAX,
  SCORES,
  SPORT_COLORS,
  TRAINING_NAME_MAX,
  TRAINING_NAME_MIN,
  sessionInputSchema,
  todayIn,
  type Gym,
  type Punctuality,
  type Sport,
  type TrainingSession,
} from '@pace/shared';
import { ArrowLeft, Check, Pencil, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { TextArea, TextField } from '../../components/Field';
import { Toggle } from '../../components/Toggle';
import { apiFieldErrors, fieldMessage, formMessage, validate } from '../../lib/forms';
import { useCurrentUser } from '../auth/session';
import { GymPicker } from '../profile/GymPicker';
import { sportName } from '../profile/sports';
import { formatDuration } from './format';
import { useDeleteSession, useSaveSession, useSaveSport, useSports } from './queries';

/** The questions in the order the user is guided through them. */
const STEPS = ['rating', 'punctuality', 'training', 'energy', 'duration', 'injury'] as const;
type Step = (typeof STEPS)[number] | 'summary';

/** Quick choices for the duration, in minutes. */
const DURATION_PRESETS = [30, 45, 60, 90, 120];

interface SessionDialogProps {
  open: boolean;
  /** The session to edit; without it a new session is created. */
  session?: TrainingSession;
  /** Pre-filled date for a new session. */
  date?: string;
  onClose: () => void;
}

export function SessionDialog({ open, session, date, onClose }: SessionDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      size="lg"
      title={session ? t('training.form.editTitle') : t('training.form.newTitle')}
      onClose={onClose}
    >
      {/* Remounted per session, so the form always starts from fresh values. */}
      {open && <CheckIn key={session?.id ?? date} session={session} date={date} onDone={onClose} />}
    </Dialog>
  );
}

interface Values {
  date: string;
  rating: number | null;
  punctuality: Punctuality | null;
  /** What the user typed; matched to one of their sports when saving. */
  training: string;
  energy: number | null;
  hours: string;
  minutes: string;
  injured: boolean | null;
  injuryNote: string;
  gym: Gym | null;
  reflection: string;
  shareDetails: boolean;
}

const normalise = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/**
 * Logging a training as a short check-in: one question per screen, in a fixed order, so the
 * user never has to look for a field. A summary at the end shows every answer before saving.
 */
function CheckIn({
  session,
  date,
  onDone,
}: {
  session?: TrainingSession;
  date?: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const today = todayIn(me.profile.timezone);
  const sports = useSports();
  const saveSport = useSaveSport();
  const save = useSaveSession();
  const remove = useDeleteSession();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Editing starts at the summary; a new training starts with the first question.
  const [step, setStep] = useState<Step>(session ? 'summary' : STEPS[0]);
  // Set when a single answer is changed from the summary: go straight back afterwards.
  const [fromSummary, setFromSummary] = useState(Boolean(session));
  const [values, setValues] = useState<Values>(() => ({
    date: session?.date ?? (date && date <= today ? date : today),
    rating: session?.rating ?? null,
    punctuality: session?.punctuality ?? null,
    training: session ? sportName(t, session.sport) : '',
    energy: session?.energy ?? null,
    hours: session ? String(Math.floor(session.durationMinutes / 60)) : '',
    minutes: session ? String(session.durationMinutes % 60) : '',
    injured: session ? session.injured : null,
    injuryNote: session?.injuryNote ?? '',
    gym: session ? session.gym : (me.profile.gyms[0] ?? null),
    reflection: session?.reflection ?? '',
    shareDetails: session?.shareDetails ?? false,
  }));
  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setError(null);
  };

  const allSports = sports.data ?? [];
  const totalMinutes = Number(values.hours || 0) * 60 + Number(values.minutes || 0);

  function next(answered: Step = step) {
    if (fromSummary || answered === 'injury') {
      setStep('summary');
      return;
    }
    setStep(STEPS[STEPS.indexOf(answered as (typeof STEPS)[number]) + 1] ?? 'summary');
  }

  function back() {
    setError(null);
    const index = STEPS.indexOf(step as (typeof STEPS)[number]);
    if (fromSummary) setStep('summary');
    else if (index > 0) setStep(STEPS[index - 1]!);
  }

  /** The first question without an answer, if any. */
  function firstUnanswered(): Step | null {
    if (values.rating === null) return 'rating';
    if (values.punctuality === null) return 'punctuality';
    if (values.training.trim().length < TRAINING_NAME_MIN) return 'training';
    if (values.energy === null) return 'energy';
    if (totalMinutes < 1 || totalMinutes > MAX_SESSION_MINUTES) return 'duration';
    if (values.injured === null) return 'injury';
    return null;
  }

  function edit(target: Step) {
    setFromSummary(true);
    setError(null);
    setStep(target);
  }

  /** The user's sport with this name, or a new sport of their own. */
  async function resolveSport(): Promise<Sport> {
    const wanted = normalise(values.training);
    const existing = allSports.find(
      (s) => normalise(sportName(t, s)) === wanted || normalise(s.name) === wanted,
    );
    if (existing) return existing;
    const used = new Set(allSports.filter((s) => !s.slug).map((s) => s.color));
    const color = SPORT_COLORS.find((c) => !used.has(c)) ?? SPORT_COLORS[used.size % 10]!;
    return saveSport.mutateAsync({
      input: { name: values.training.trim().replace(/\s+/g, ' '), color },
    });
  }

  async function submit() {
    const missing = firstUnanswered();
    if (missing) {
      edit(missing);
      return;
    }
    if (values.date > today) {
      setError(fieldMessage(t, 'date', 'in_future')!);
      return;
    }
    let sport: Sport;
    try {
      sport = await resolveSport();
    } catch (err) {
      setError(formMessage(t, err));
      return;
    }
    const { data, errors } = validate(sessionInputSchema, {
      date: values.date,
      sportId: sport.id,
      gymId: values.gym?.id ?? null,
      durationMinutes: totalMinutes,
      punctuality: values.punctuality,
      rating: values.rating,
      energy: values.energy,
      // Older sessions keep the scores that are no longer asked.
      motivation: session?.motivation ?? null,
      intensity: session?.intensity ?? null,
      injured: values.injured ?? false,
      injuryNote: values.injured ? values.injuryNote : null,
      reflection: values.reflection,
      shareDetails: values.shareDetails,
    });
    if (!data) {
      const [field, code] = Object.entries(errors)[0]!;
      setError(fieldMessage(t, field, code)!);
      return;
    }
    save.mutate(
      { id: session?.id, input: data },
      {
        onSuccess: onDone,
        onError: (err) => {
          const fields = Object.entries(apiFieldErrors(err));
          setError(
            fields.length ? fieldMessage(t, fields[0]![0], fields[0]![1])! : formMessage(t, err),
          );
        },
      },
    );
  }

  const questionNumber = STEPS.indexOf(step as (typeof STEPS)[number]) + 1;
  const busy = save.isPending || saveSport.isPending;

  return (
    <div className="flex flex-col gap-5">
      {step !== 'summary' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              {t('training.checkin.progress', { current: questionNumber, total: STEPS.length })}
            </span>
            {(questionNumber > 1 || fromSummary) && (
              <button
                type="button"
                onClick={back}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                {t('training.checkin.back')}
              </button>
            )}
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={STEPS.length}
            aria-valuenow={questionNumber}
            aria-label={t('training.checkin.progressLabel')}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${(questionNumber / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {step === 'rating' && (
        <Question
          title={t('training.checkin.rating.question')}
          hint={t('training.checkin.tapHint')}
        >
          <ScoreChoice
            name="rating"
            value={values.rating}
            onChange={(v) => {
              set('rating', v);
              next('rating');
            }}
          />
        </Question>
      )}

      {step === 'punctuality' && (
        <Question
          title={t('training.checkin.punctuality.question')}
          hint={t('training.checkin.tapHint')}
        >
          <Choices
            columns={2}
            value={values.punctuality}
            options={(['on_time', 'late'] as const).map((p) => ({
              value: p,
              label: t(`training.punctuality.${p}`),
            }))}
            onChange={(v) => {
              set('punctuality', v);
              next('punctuality');
            }}
          />
        </Question>
      )}

      {step === 'training' && (
        <TrainingStep
          value={values.training}
          sports={allSports}
          ownSportIds={me.profile.sports.map((s) => s.id)}
          onChange={(v) => set('training', v)}
          onNext={() => next('training')}
        />
      )}

      {step === 'energy' && (
        <Question
          title={t('training.checkin.energy.question')}
          hint={t('training.checkin.tapHint')}
        >
          <ScoreChoice
            name="energy"
            value={values.energy}
            onChange={(v) => {
              set('energy', v);
              next('energy');
            }}
          />
        </Question>
      )}

      {step === 'duration' && (
        <DurationStep
          hours={values.hours}
          minutes={values.minutes}
          onChange={(hours, minutes) => {
            setValues((v) => ({ ...v, hours, minutes }));
            setError(null);
          }}
          onNext={() => next('duration')}
        />
      )}

      {step === 'injury' && (
        <InjuryStep
          injured={values.injured}
          note={values.injuryNote}
          onAnswer={(injured) => {
            set('injured', injured);
            if (!injured) next('injury');
          }}
          onNote={(note) => set('injuryNote', note)}
          onNext={() => next('injury')}
        />
      )}

      {step === 'summary' && (
        <>
          <div>
            <h3 className="text-base font-semibold">{t('training.checkin.summary.title')}</h3>
            <p className="mt-1 text-sm text-muted">{t('training.checkin.summary.hint')}</p>
          </div>
          <dl className="divide-y divide-border rounded-xl border border-border">
            <SummaryRow
              label={t('training.checkin.rating.short')}
              value={values.rating ? t(`training.checkin.rating.labels.${values.rating}`) : null}
              onEdit={() => edit('rating')}
            />
            <SummaryRow
              label={t('training.checkin.punctuality.short')}
              value={values.punctuality && t(`training.punctuality.${values.punctuality}`)}
              onEdit={() => edit('punctuality')}
            />
            <SummaryRow
              label={t('training.checkin.training.short')}
              value={values.training.trim()}
              onEdit={() => edit('training')}
            />
            <SummaryRow
              label={t('training.checkin.energy.short')}
              value={values.energy ? t(`training.checkin.energy.labels.${values.energy}`) : null}
              onEdit={() => edit('energy')}
            />
            <SummaryRow
              label={t('training.checkin.duration.short')}
              value={totalMinutes > 0 ? formatDuration(totalMinutes) : null}
              onEdit={() => edit('duration')}
            />
            <SummaryRow
              label={t('training.checkin.injury.short')}
              value={
                values.injured === null
                  ? null
                  : values.injured
                    ? values.injuryNote.trim() || t('training.checkin.injury.yes')
                    : t('training.checkin.injury.no')
              }
              onEdit={() => edit('injury')}
            />
          </dl>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              type="date"
              label={t('training.fields.date')}
              value={values.date}
              max={today}
              min="2000-01-01"
              onChange={(e) => set('date', e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">{t('training.fields.gym')}</p>
              <GymPicker
                value={values.gym}
                onChange={(gym) => set('gym', gym)}
                suggestions={me.profile.gyms}
              />
            </div>
          </div>

          <TextArea
            label={t('training.checkin.summary.reflection')}
            value={values.reflection}
            maxLength={REFLECTION_MAX}
            rows={3}
            placeholder={t('training.form.reflectionPlaceholder')}
            onChange={(e) => set('reflection', e.target.value)}
            hint={t('training.form.reflectionHint')}
          />

          <div className="-my-3">
            <Toggle
              label={t('training.fields.shareDetails')}
              description={t('training.form.shareDetailsHelp')}
              checked={values.shareDetails}
              onChange={(v) => set('shareDetails', v)}
            />
          </div>
        </>
      )}

      {(error || remove.error) && <Alert>{error ?? formMessage(t, remove.error)}</Alert>}

      {step === 'summary' && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button onClick={submit} disabled={busy}>
            {session ? t('common.save') : t('training.form.create')}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            {t('common.cancel')}
          </Button>
          {session &&
            (confirmDelete ? (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-sm text-muted">{t('training.form.deleteConfirm')}</span>
                <Button
                  className="bg-danger text-white hover:bg-danger/90"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(session.id, { onSuccess: onDone })}
                >
                  {t('training.form.delete')}
                </Button>
              </span>
            ) : (
              <Button
                variant="ghost"
                className="ml-auto text-danger hover:text-danger"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {t('training.form.delete')}
              </Button>
            ))}
        </div>
      )}
    </div>
  );
}

function Question({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-4 flex flex-col gap-1">
        <span className="text-xl font-semibold tracking-tight">{title}</span>
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

/** Big buttons; picking one answers the question. */
function Choices<T extends string | number | boolean>({
  value,
  options,
  columns,
  onChange,
}: {
  value: T | null;
  options: { value: T; label: string; detail?: string }[];
  columns: 2 | 5;
  onChange: (value: T) => void;
}) {
  return (
    <div className={`grid gap-2 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-5'}`}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
            className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent sm:flex-col sm:justify-center sm:gap-1 sm:text-center ${
              selected
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border bg-surface hover:bg-surface-2'
            }`}
          >
            {o.detail && <span className="tabular text-lg font-semibold">{o.detail}</span>}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ScoreChoice({
  name,
  value,
  onChange,
}: {
  name: 'rating' | 'energy';
  value: number | null;
  onChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <Choices
      columns={5}
      value={value}
      options={SCORES.map((score) => ({
        value: score,
        detail: String(score),
        label: t(`training.checkin.${name}.labels.${score}`),
      }))}
      onChange={onChange}
    />
  );
}

function TrainingStep({
  value,
  sports,
  ownSportIds,
  onChange,
  onNext,
}: {
  value: string;
  sports: Sport[];
  ownSportIds: string[];
  onChange: (value: string) => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  // The user's profile sports and own sports first: those are what they usually do.
  const suggestions = [
    ...sports.filter((s) => ownSportIds.includes(s.id)),
    ...sports.filter((s) => !s.slug && !ownSportIds.includes(s.id)),
  ].slice(0, 8);

  function submit() {
    const length = value.trim().length;
    if (length < TRAINING_NAME_MIN) {
      setError(t('training.checkin.training.tooShort'));
      return;
    }
    onNext();
  }

  return (
    <Question
      title={t('training.checkin.training.question')}
      hint={t('training.checkin.training.hint')}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextField
          label={t('training.checkin.training.label')}
          value={value}
          maxLength={TRAINING_NAME_MAX}
          autoFocus
          list="pace-training-names"
          placeholder={t('training.checkin.training.placeholder')}
          onChange={(e) => {
            onChange(e.target.value);
            setError(null);
          }}
          error={error ?? undefined}
        />
        <datalist id="pace-training-names">
          {sports.map((s) => (
            <option key={s.id} value={sportName(t, s)} />
          ))}
        </datalist>
        {suggestions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted">{t('training.checkin.training.recent')}</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onChange(sportName(t, s));
                    setError(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                    aria-hidden="true"
                  />
                  {sportName(t, s)}
                </button>
              ))}
            </div>
          </div>
        )}
        <NextButton />
      </form>
    </Question>
  );
}

function DurationStep({
  hours,
  minutes,
  onChange,
  onNext,
}: {
  hours: string;
  minutes: string;
  onChange: (hours: string, minutes: string) => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const total = Number(hours || 0) * 60 + Number(minutes || 0);

  function submit() {
    if (!Number.isFinite(total) || total < 1) {
      setError(t('training.checkin.duration.required'));
      return;
    }
    if (total > MAX_SESSION_MINUTES) {
      setError(t('training.checkin.duration.tooLong'));
      return;
    }
    onNext();
  }

  return (
    <Question
      title={t('training.checkin.duration.question')}
      hint={t('training.checkin.duration.hint')}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {DURATION_PRESETS.map((preset) => {
            const selected = total === preset;
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onChange(String(Math.floor(preset / 60)), String(preset % 60));
                  setError(null);
                }}
                className={`tabular min-h-12 rounded-xl border px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
                  selected
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border bg-surface hover:bg-surface-2'
                }`}
              >
                {formatDuration(preset)}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted">{t('training.checkin.duration.custom')}</p>
        <div className="grid grid-cols-2 gap-2">
          <TextField
            type="number"
            inputMode="numeric"
            label={t('training.form.hours')}
            value={hours}
            min={0}
            max={24}
            onChange={(e) => {
              onChange(e.target.value, minutes);
              setError(null);
            }}
          />
          <TextField
            type="number"
            inputMode="numeric"
            label={t('training.form.minutes')}
            value={minutes}
            min={0}
            max={59}
            step={5}
            onChange={(e) => {
              onChange(hours, e.target.value);
              setError(null);
            }}
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <NextButton />
      </form>
    </Question>
  );
}

function InjuryStep({
  injured,
  note,
  onAnswer,
  onNote,
  onNext,
}: {
  injured: boolean | null;
  note: string;
  onAnswer: (injured: boolean) => void;
  onNote: (note: string) => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Question title={t('training.checkin.injury.question')} hint={t('training.checkin.tapHint')}>
      <Choices
        columns={2}
        value={injured}
        options={[
          { value: false, label: t('training.checkin.injury.no') },
          { value: true, label: t('training.checkin.injury.yes') },
        ]}
        onChange={onAnswer}
      />
      {injured && (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onNext();
          }}
        >
          <TextArea
            label={t('training.checkin.injury.noteLabel')}
            value={note}
            maxLength={INJURY_NOTE_MAX}
            rows={3}
            autoFocus
            placeholder={t('training.checkin.injury.notePlaceholder')}
            onChange={(e) => onNote(e.target.value)}
            hint={t('training.checkin.injury.noteHint')}
          />
          <NextButton />
        </form>
      )}
    </Question>
  );
}

function NextButton() {
  const { t } = useTranslation();
  return (
    <Button type="submit" className="h-11 self-stretch sm:self-start sm:px-6">
      {t('training.checkin.next')}
    </Button>
  );
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string | null | false;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <dt className="w-32 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
        {value ? (
          <>
            <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
            <span className="truncate">{value}</span>
          </>
        ) : (
          <span className="text-muted">{t('training.checkin.summary.missing')}</span>
        )}
      </dd>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
        aria-label={`${t('training.checkin.summary.edit')}: ${label}`}
      >
        <Pencil className="size-3.5" aria-hidden="true" />
        {t('training.checkin.summary.edit')}
      </button>
    </div>
  );
}
