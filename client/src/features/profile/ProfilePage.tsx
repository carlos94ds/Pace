import {
  TRAINING_LEVELS,
  updateProfileSchema,
  type Gym,
  type Me,
  type TrainingLevel,
} from '@pace/shared';
import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Scale } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '../../app/PageHeader';
import { MyAchievementsCard } from '../social/Achievements';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { SelectField, TextArea, TextField } from '../../components/Field';
import { api } from '../../lib/api';
import {
  apiFieldErrors,
  fieldMessage,
  formMessage,
  validate,
  type FieldErrors,
} from '../../lib/forms';
import { useCurrentUser, useMeMutation } from '../auth/session';
import { AvatarEditor } from './AvatarEditor';
import { GymPicker } from './GymPicker';
import { SportPicker } from './SportPicker';

function initialValues(me: Me) {
  const p = me.profile;
  return {
    firstName: p.firstName,
    username: p.username,
    bio: p.bio ?? '',
    heightCm: p.heightCm?.toString() ?? '',
    trainingLevel: p.trainingLevel,
    personalGoals: p.personalGoals ?? '',
    timezone: p.timezone,
    gym: p.gym,
    sportIds: p.sports.map((s) => s.id),
  };
}

export function ProfilePage() {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const [values, setValues] = useState(() => initialValues(me));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<{ ok: boolean; message: string }>();
  const timezones = useMemo(() => Intl.supportedValuesOf('timeZone'), []);

  const save = useMeMutation((body: Record<string, unknown>) =>
    api<Me>('/me/profile', { method: 'PATCH', body }),
  );

  const set = <K extends keyof typeof values>(field: K, value: (typeof values)[K]) => {
    setValues((v) => ({ ...v, [field]: value }));
    setResult(undefined);
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    const { gym, heightCm, ...rest } = values;
    const { data, errors } = validate(updateProfileSchema, {
      ...rest,
      gymId: gym?.id ?? null,
      heightCm: heightCm.trim() === '' ? null : Number(heightCm),
    });
    setErrors(errors ?? {});
    if (!data) return;
    save.mutate(data, {
      onSuccess: () => setResult({ ok: true, message: t('common.saved') }),
      onError: (err) => {
        setErrors(apiFieldErrors(err));
        setResult({ ok: false, message: formMessage(t, err) });
      },
    });
  }

  return (
    <>
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />
      <form onSubmit={submit} noValidate className="grid max-w-3xl gap-6">
        <Card title={t('profile.photo')}>
          <AvatarEditor />
        </Card>

        <Card title={t('profile.about')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('fields.firstName')}
              value={values.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              error={fieldMessage(t, 'firstName', errors.firstName)}
            />
            <TextField
              label={t('fields.username')}
              autoCapitalize="none"
              value={values.username}
              onChange={(e) => set('username', e.target.value)}
              hint={t('fields.usernameHint')}
              error={fieldMessage(t, 'username', errors.username)}
            />
            <div className="sm:col-span-2">
              <TextArea
                label={t('fields.bio')}
                maxLength={280}
                value={values.bio}
                onChange={(e) => set('bio', e.target.value)}
                hint={t('fields.charactersLeft', { count: 280 - values.bio.length })}
                error={fieldMessage(t, 'bio', errors.bio)}
              />
            </div>
          </div>
        </Card>

        <Card title={t('profile.training')}>
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label={t('fields.trainingLevel')}
                value={values.trainingLevel}
                onChange={(e) => set('trainingLevel', e.target.value as TrainingLevel)}
              >
                {TRAINING_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {t(`trainingLevels.${level}`)}
                  </option>
                ))}
              </SelectField>
              <TextField
                label={t('fields.heightCm')}
                type="number"
                inputMode="numeric"
                min={80}
                max={260}
                value={values.heightCm}
                onChange={(e) => set('heightCm', e.target.value)}
                hint={t('profile.heightPrivate')}
                error={fieldMessage(t, 'heightCm', errors.heightCm)}
              />
            </div>
            <SportPicker value={values.sportIds} onChange={(ids) => set('sportIds', ids)} />
            <div>
              <p className="mb-1.5 text-sm font-medium">{t('profile.gym.label')}</p>
              <GymPicker value={values.gym} onChange={(gym: Gym | null) => set('gym', gym)} />
            </div>
            <TextArea
              label={t('fields.personalGoals')}
              rows={4}
              maxLength={2000}
              value={values.personalGoals}
              onChange={(e) => set('personalGoals', e.target.value)}
              hint={t('profile.goalsHint')}
              error={fieldMessage(t, 'personalGoals', errors.personalGoals)}
            />
            <SelectField
              label={t('fields.timezone')}
              value={values.timezone}
              onChange={(e) => set('timezone', e.target.value)}
              hint={t('profile.timezoneHint')}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replaceAll('_', ' ')}
                </option>
              ))}
            </SelectField>
          </div>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" disabled={save.isPending} className="h-10 sm:w-auto">
            {t('common.save')}
          </Button>
          {result && <Alert tone={result.ok ? 'success' : 'danger'}>{result.message}</Alert>}
        </div>
      </form>

      <Link
        to="/weight"
        className="mt-10 flex max-w-3xl items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors duration-150 hover:bg-surface-2"
      >
        <Scale className="size-5 text-accent" aria-hidden="true" />
        <span className="flex-1">
          <span className="block text-sm font-medium">{t('weight.title')}</span>
          <span className="block text-xs text-muted">{t('weight.profileLink')}</span>
        </span>
        <ChevronRight className="size-4 text-muted" aria-hidden="true" />
      </Link>

      <div id="achievements" className="mt-6 max-w-3xl scroll-mt-20">
        <MyAchievementsCard />
      </div>
    </>
  );
}
