import { todayIn, weightInputSchema, type WeightEntry } from '@pace/shared';
import { Camera, Image as ImageIcon, Lock, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageHeader } from '../../app/PageHeader';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LineChart } from '../../components/charts/LineChart';
import { Dialog } from '../../components/Dialog';
import { TextField } from '../../components/Field';
import {
  apiFieldErrors,
  fieldMessage,
  formMessage,
  validate,
  type FieldErrors,
} from '../../lib/forms';
import { useCurrentUser } from '../auth/session';
import { formatDay } from '../training/format';
import { useAddWeight, useDeleteWeight, useWeights } from './queries';

const kg = (value: number, lang: string) =>
  `${value.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;

export function WeightPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const me = useCurrentUser();
  const weights = useWeights();
  const [adding, setAdding] = useState(false);
  const [photo, setPhoto] = useState<WeightEntry | null>(null);
  const entries = weights.data ?? [];
  const latest = entries[0];
  const first = entries.at(-1);
  const shared = me.privacy.weight === 'friends';

  return (
    <>
      <PageHeader
        title={t('weight.title')}
        subtitle={t('weight.subtitle')}
        actions={
          <>
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden="true" />
              {t('weight.add')}
            </Button>
          </>
        }
      />

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-sm">
        {shared ? (
          <Users className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        ) : (
          <Lock className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        )}
        <p className="flex-1">
          {shared ? t('weight.privacyShared') : t('weight.privacyPrivate')}{' '}
          <Link to="/settings#privacy" className="font-medium text-accent">
            {t('weight.privacyLink')}
          </Link>
        </p>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label={t('weight.current')}
          value={latest ? kg(latest.weightKg, lang) : '–'}
          detail={
            latest &&
            formatDay(latest.measuredOn, lang, { day: 'numeric', month: 'short', year: 'numeric' })
          }
        />
        <Tile
          label={t('weight.change')}
          value={
            latest && first && latest !== first
              ? `${latest.weightKg - first.weightKg > 0 ? '+' : ''}${kg(latest.weightKg - first.weightKg, lang)}`
              : '–'
          }
          detail={
            first && latest !== first
              ? t('weight.since', {
                  date: formatDay(first.measuredOn, lang, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }),
                })
              : undefined
          }
        />
        <Tile
          label={t('fields.heightCm')}
          value={me.profile.heightCm ? `${me.profile.heightCm} cm` : '–'}
          detail={me.profile.heightCm ? undefined : t('weight.setHeight')}
        />
        <Tile label={t('weight.entries')} value={String(entries.length)} />
      </dl>

      {entries.length > 1 && (
        <Card title={t('weight.history')} className="mb-6">
          <LineChart
            title={t('weight.history')}
            points={[...entries].reverse().map((w) => ({
              label: formatDay(w.measuredOn, lang, { day: 'numeric', month: 'short' }),
              fullLabel: formatDay(w.measuredOn, lang, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }),
              value: w.weightKg,
            }))}
            format={(v) => kg(v, lang)}
          />
        </Card>
      )}

      <Card title={t('weight.measurements')}>
        {weights.isSuccess && entries.length === 0 ? (
          <p className="text-sm text-muted">{t('weight.empty')}</p>
        ) : (
          <ul className="-my-3 divide-y divide-border">
            {entries.map((w, i) => (
              <EntryRow
                key={w.id}
                entry={w}
                previous={entries[i + 1]}
                onPhoto={() => setPhoto(w)}
              />
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={adding} title={t('weight.add')} onClose={() => setAdding(false)}>
        {adding && (
          <AddWeightForm today={todayIn(me.profile.timezone)} onDone={() => setAdding(false)} />
        )}
      </Dialog>
      <Dialog
        open={photo !== null}
        title={t('weight.evidence')}
        size="lg"
        onClose={() => setPhoto(null)}
      >
        {photo?.evidenceUrl && (
          <div className="flex flex-col gap-3">
            <img
              src={photo.evidenceUrl}
              alt={t('weight.evidenceAlt', { weight: kg(photo.weightKg, lang) })}
              className="max-h-[70dvh] w-full rounded-lg object-contain"
            />
            <Button variant="ghost" className="self-end" onClick={() => setPhoto(null)}>
              {t('common.close')}
            </Button>
          </div>
        )}
      </Dialog>
    </>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="tabular mt-1.5 text-2xl font-semibold tracking-tight">{value}</dd>
      {detail && <dd className="mt-1 text-xs text-muted">{detail}</dd>}
    </div>
  );
}

function EntryRow({
  entry,
  previous,
  onPhoto,
}: {
  entry: WeightEntry;
  previous?: WeightEntry;
  onPhoto: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const remove = useDeleteWeight();
  const [confirm, setConfirm] = useState(false);
  const diff = previous ? entry.weightKg - previous.weightKg : null;

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="tabular font-semibold">
          {kg(entry.weightKg, lang)}
          {diff !== null && diff !== 0 && (
            <span className="ml-2 text-xs font-normal text-muted">
              {diff > 0 ? '+' : ''}
              {kg(diff, lang)}
            </span>
          )}
        </p>
        <p className="text-xs text-muted">
          {formatDay(entry.measuredOn, lang, {
            weekday: 'short',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          {entry.note && <> · {entry.note}</>}
        </p>
      </div>
      {entry.evidenceUrl && (
        <Button variant="secondary" onClick={onPhoto}>
          <ImageIcon className="size-4" aria-hidden="true" />
          {t('weight.viewPhoto')}
        </Button>
      )}
      {confirm ? (
        <span className="flex items-center gap-2">
          <Button
            className="bg-danger text-white hover:bg-danger/90"
            disabled={remove.isPending}
            onClick={() => remove.mutate(entry.id)}
          >
            {entry.evidenceUrl ? t('weight.deleteConfirm') : t('weight.delete')}
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            {t('common.cancel')}
          </Button>
        </span>
      ) : (
        <Button
          variant="ghost"
          className="hover:text-danger"
          onClick={() => setConfirm(true)}
          aria-label={`${t('weight.delete')}: ${formatDay(entry.measuredOn, lang, { day: 'numeric', month: 'long' })}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}

function AddWeightForm({ today, onDone }: { today: string; onDone: () => void }) {
  const { t } = useTranslation();
  const add = useAddWeight();
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  function choose(next: File | null) {
    setFile(next);
    setPreview(null);
    setErrors(({ evidence: _, ...rest }) => rest);
    if (!next) return;
    // A data URL keeps the preview inside the page's content security policy.
    const reader = new FileReader();
    reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const values = { weightKg: weight.replace(',', '.'), measuredOn: date, note };
    const { errors } = validate(weightInputSchema, values);
    const all: FieldErrors = { ...errors };
    if (date > today) all.measuredOn = 'in_future';
    setErrors(all);
    if (Object.keys(all).length) return;
    const form = new FormData();
    form.append('weightKg', values.weightKg);
    form.append('measuredOn', date);
    if (note.trim()) form.append('note', note.trim());
    if (file) form.append('evidence', file);
    add.mutate(form, { onSuccess: onDone, onError: (err) => setErrors(apiFieldErrors(err)) });
  }

  const generalError = add.error && !Object.keys(apiFieldErrors(add.error)).length;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('weight.weightKg')}
          type="number"
          inputMode="decimal"
          step="0.1"
          min={20}
          max={400}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          error={fieldMessage(t, 'weightKg', errors.weightKg)}
        />
        <TextField
          label={t('training.fields.date')}
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          error={fieldMessage(t, 'measuredOn', errors.measuredOn)}
        />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">{t('weight.evidenceOptional')}</legend>
        <p className="mb-2 text-xs text-muted">{t('weight.evidenceHelp')}</p>
        <label
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-sm transition-colors duration-150 hover:bg-surface-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
            errors.evidence ? 'border-danger' : 'border-border'
          }`}
        >
          {preview ? (
            <img
              src={preview}
              alt={t('weight.previewAlt')}
              className="max-h-48 rounded-lg object-contain"
            />
          ) : (
            <Camera className="size-6 text-muted" aria-hidden="true" />
          )}
          <span className="font-medium text-accent">
            {file ? t('weight.changePhoto') : t('weight.choosePhoto')}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-invalid={Boolean(errors.evidence)}
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
          />
        </label>
        {errors.evidence && (
          <p className="mt-1.5 text-xs text-danger">
            {fieldMessage(t, 'evidence', errors.evidence)}
          </p>
        )}
      </fieldset>
      <TextField
        label={t('weight.note')}
        value={note}
        maxLength={280}
        onChange={(e) => setNote(e.target.value)}
        hint={t('weight.noteHint')}
      />
      {generalError && <Alert>{formMessage(t, add.error)}</Alert>}
      <div className="flex gap-2 border-t border-border pt-4">
        <Button type="submit" disabled={add.isPending}>
          {t('weight.save')}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
