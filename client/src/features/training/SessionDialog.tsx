import {
  MAX_SESSION_MINUTES,
  REFLECTION_MAX,
  sessionInputSchema,
  todayIn,
  type Gym,
  type Punctuality,
  type TrainingSession,
} from '@pace/shared';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { SelectField, TextArea, TextField } from '../../components/Field';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Toggle } from '../../components/Toggle';
import {
  apiFieldErrors,
  fieldMessage,
  formMessage,
  validate,
  type FieldErrors,
} from '../../lib/forms';
import { useCurrentUser } from '../auth/session';
import { GymPicker } from '../profile/GymPicker';
import { sportName } from '../profile/sports';
import { formatDuration } from './format';
import { useDeleteSession, useSaveSession, useSports } from './queries';
import { ScoreField } from './ScoreField';
import { SportForm } from './SportForm';

const NEW_SPORT = '__new__';

/** Form fields whose API field has a different name. */
const ERROR_KEYS: Partial<Record<keyof FormValues, string>> = {
  hours: 'durationMinutes',
  minutes: 'durationMinutes',
  gym: 'gymId',
};

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
      {open && (
        <SessionForm key={session?.id ?? date} session={session} date={date} onDone={onClose} />
      )}
    </Dialog>
  );
}

interface FormValues {
  date: string;
  sportId: string;
  gym: Gym | null;
  hours: string;
  minutes: string;
  punctuality: Punctuality;
  motivation: number | null;
  rating: number | null;
  intensity: number | null;
  reflection: string;
  shareDetails: boolean;
}

function SessionForm({
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
  const save = useSaveSession();
  const remove = useDeleteSession();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingSport, setAddingSport] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [values, setValues] = useState<FormValues>(() => ({
    date: session?.date ?? (date && date <= today ? date : today),
    sportId: session?.sport.id ?? me.profile.sports[0]?.id ?? '',
    gym: session ? session.gym : me.profile.gym,
    hours: session ? String(Math.floor(session.durationMinutes / 60)) : '',
    minutes: session ? String(session.durationMinutes % 60) : '',
    punctuality: session?.punctuality ?? 'on_time',
    motivation: session?.motivation ?? null,
    rating: session?.rating ?? null,
    intensity: session?.intensity ?? null,
    reflection: session?.reflection ?? '',
    shareDetails: session?.shareDetails ?? false,
  }));
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    // A field's error disappears as soon as the user changes that field.
    const errorKey = ERROR_KEYS[key] ?? key;
    setErrors(({ [errorKey]: _, ...rest }) => rest);
  };

  const sportOptions = (sports.data ?? [])
    .map((s) => ({ id: s.id, label: sportName(t, s), own: !s.slug }))
    .sort((a, b) => a.label.localeCompare(b.label));
  // Hours and minutes are entered separately and stored as minutes.
  const noDuration = values.hours === '' && values.minutes === '';
  const totalMinutes = Number(values.hours || 0) * 60 + Number(values.minutes || 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const { data, errors } = validate(sessionInputSchema, {
      date: values.date,
      sportId: values.sportId,
      gymId: values.gym?.id ?? null,
      durationMinutes: noDuration ? undefined : totalMinutes,
      punctuality: values.punctuality,
      motivation: values.motivation ?? undefined,
      rating: values.rating ?? undefined,
      intensity: values.intensity ?? undefined,
      reflection: values.reflection,
      shareDetails: values.shareDetails,
    });
    const clientErrors = { ...errors };
    if (values.date > today) clientErrors.date = 'in_future';
    setErrors(clientErrors);
    if (!data || Object.keys(clientErrors).length) return;
    save.mutate(
      { id: session?.id, input: data },
      { onSuccess: onDone, onError: (err) => setErrors(apiFieldErrors(err)) },
    );
  }

  const msg = (field: string) => fieldMessage(t, field, errors[field]);
  const generalError =
    (save.error && !Object.keys(apiFieldErrors(save.error)).length && save.error) || remove.error;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          type="date"
          label={t('training.fields.date')}
          value={values.date}
          max={today}
          min="2000-01-01"
          onChange={(e) => set('date', e.target.value)}
          error={msg('date')}
        />
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{t('training.fields.duration')}</legend>
          <div className="grid grid-cols-2 gap-2">
            <TextField
              type="number"
              inputMode="numeric"
              label={t('training.form.hours')}
              value={values.hours}
              min={0}
              max={24}
              onChange={(e) => set('hours', e.target.value)}
              aria-invalid={Boolean(errors.durationMinutes)}
            />
            <TextField
              type="number"
              inputMode="numeric"
              label={t('training.form.minutes')}
              value={values.minutes}
              min={0}
              max={59}
              step={5}
              onChange={(e) => set('minutes', e.target.value)}
              aria-invalid={Boolean(errors.durationMinutes)}
            />
          </div>
          <p className={`mt-1.5 text-xs ${errors.durationMinutes ? 'text-danger' : 'text-muted'}`}>
            {errors.durationMinutes
              ? fieldMessage(t, 'durationMinutes', errors.durationMinutes)
              : !noDuration && totalMinutes > 0 && totalMinutes <= MAX_SESSION_MINUTES
                ? formatDuration(totalMinutes)
                : t('training.form.durationHint')}
          </p>
        </fieldset>
      </div>

      {addingSport ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">{t('training.sports.newTitle')}</p>
          <SportForm
            onSaved={(sport) => {
              set('sportId', sport.id);
              setAddingSport(false);
            }}
            onCancel={() => setAddingSport(false)}
          />
        </div>
      ) : (
        <SelectField
          label={t('training.fields.sport')}
          value={values.sportId}
          onChange={(e) =>
            e.target.value === NEW_SPORT ? setAddingSport(true) : set('sportId', e.target.value)
          }
          error={fieldMessage(t, 'sportId', errors.sportId)}
        >
          <option value="" disabled>
            {t('training.form.chooseSport')}
          </option>
          {sportOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
          <option value={NEW_SPORT}>{t('training.sports.addOption')}</option>
        </SelectField>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">{t('training.fields.gym')}</p>
        <GymPicker value={values.gym} onChange={(gym) => set('gym', gym)} />
        {errors.gymId && <p className="text-xs text-danger">{msg('gymId')}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">{t('training.fields.punctuality')}</p>
        <SegmentedControl
          label={t('training.fields.punctuality')}
          value={values.punctuality}
          options={[
            { value: 'on_time', label: t('training.punctuality.on_time') },
            { value: 'late', label: t('training.punctuality.late') },
          ]}
          onChange={(v) => set('punctuality', v)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(['motivation', 'rating', 'intensity'] as const).map((name) => (
          <ScoreField
            key={name}
            name={name}
            value={values[name]}
            onChange={(v) => set(name, v)}
            error={errors[name] && t('training.form.chooseScore')}
          />
        ))}
      </div>

      <TextArea
        label={t('training.fields.reflection')}
        value={values.reflection}
        maxLength={REFLECTION_MAX}
        rows={4}
        placeholder={t('training.form.reflectionPlaceholder')}
        onChange={(e) => set('reflection', e.target.value)}
        error={msg('reflection')}
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

      {generalError && <Alert>{formMessage(t, generalError)}</Alert>}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button type="submit" disabled={save.isPending || addingSport}>
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
    </form>
  );
}
