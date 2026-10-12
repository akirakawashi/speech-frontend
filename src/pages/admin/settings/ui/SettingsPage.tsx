'use client';

import { useEffect, useState } from 'react';
import { JOB_KIND_LABEL, JOB_KINDS } from '@/entities/job';
import { adminStyles, Banner, errorText, Field, Pill, Screen } from '@/widgets/admin-shell';
import { useAdminSettings, useSaveSettings } from '../api/settings';
import { changedValues, type SettingsValues } from '../model/settings-diff';

/**
 * Настройки описаны здесь **в тех же границах**, что и на сервере.
 *
 * Это дублирование, и оно осознанное: `min`/`max` в поле ввода — подсказка
 * человеку до отправки, а не проверка. Решение принимает сервер, и его отказ
 * показывается как есть. Расходиться они могут только в одну сторону —
 * подсказка строже проверки, — и тогда отказ придёт раньше, а не позже.
 */
const NUMBERS = [
  {
    key: 'retention_days',
    label: 'Срок хранения записей, дней',
    min: 1,
    max: 36500,
    hint: 'После этого срока запись удаляется, а расшифровка остаётся.',
  },
  {
    key: 'short_call_threshold_s',
    label: 'Короткий звонок, секунд',
    min: 0,
    max: 3600,
    hint: 'Разговоры короче не расшифровываются: там нечего искать.',
  },
  {
    key: 'transcribe_concurrency',
    label: 'Одновременных расшифровок',
    min: 1,
    max: 32,
    hint: 'Ограничение на Whisper, а не на воркеры: узел один.',
  },
  {
    key: 'backfill_window_days',
    label: 'Окно разбора истории, дней',
    min: 1,
    max: 36500,
    hint: 'Насколько вглубь идёт полоса истории.',
  },
  {
    key: 'stereo_operator_channel',
    label: 'Канал оператора в стерео',
    min: 0,
    max: 1,
    hint: 'Левый — 0, правый — 1. Ноль здесь значение, а не «не задано».',
  },
] as const;

type Values = SettingsValues;

/**
 * Экран «Настройки»: параметры хранения, приёма и попыток по этапам.
 *
 * @returns Форма настроек или её состояние загрузки и отказа.
 */
export function SettingsPage() {
  const settings = useAdminSettings();
  const save = useSaveSettings();
  const [draft, setDraft] = useState<Values | null>(null);
  const [nothingToSave, setNothingToSave] = useState(false);

  // Черновик наполняется ответом сервера один раз за загрузку. Синхронизировать
  // его на каждый ответ нельзя: фоновое обновление затирало бы то, что человек
  // печатает прямо сейчас.
  useEffect(() => {
    if (settings.data && draft === null) setDraft({ ...settings.data.values });
  }, [settings.data, draft]);

  if (settings.error) {
    return (
      <Screen title="Настройки">
        <Banner kind="error">{errorText(settings.error)}</Banner>
      </Screen>
    );
  }
  if (!draft) {
    return (
      <Screen title="Настройки">
        <p className={adminStyles.empty}>Загрузка…</p>
      </Screen>
    );
  }

  const overridden = new Set(settings.data?.overridden ?? []);
  const attempts = (draft.max_attempts ?? {}) as Record<string, number>;
  /**
   * Записывает значение настройки в черновик.
   *
   * @param key Ключ настройки.
   * @param value Новое значение.
   */
  const set = (key: string, value: unknown) => setDraft((p) => ({ ...(p ?? {}), [key]: value }));

  return (
    <Screen
      title="Настройки"
      hint="Помечено то, что задано администратором, — даже если совпало с умолчанием. Это не одно и то же: выставленное значение остаётся, когда умолчание поменяется, а незаданное поедет вслед за ним. «Вернуть как было» откатывает форму, а не запись в базе."
    >
      {save.error ? <Banner kind="error">{errorText(save.error)}</Banner> : null}
      {save.data ? <Banner kind="info">Изменено настроек: {save.data.changed ?? 0}.</Banner> : null}
      {nothingToSave ? <Banner kind="info">Менять нечего: значения те же.</Banner> : null}

      <form
        className={adminStyles.section}
        onSubmit={(event) => {
          event.preventDefault();
          const changes = changedValues(draft, settings.data?.values ?? {});
          if (Object.keys(changes).length === 0) {
            setNothingToSave(true);
            return;
          }
          setNothingToSave(false);
          save.mutate(changes, { onSuccess: () => setDraft(null) });
        }}
      >
        <div className={adminStyles.filters}>
          {NUMBERS.map((field) => (
            <Field
              key={field.key}
              id={`setting-${field.key}`}
              width={230}
              hint={field.hint}
              label={
                <>
                  {field.label}{' '}
                  {overridden.has(field.key) ? <Pill value="задано" tone="warn" /> : null}
                </>
              }
            >
              <input
                id={`setting-${field.key}`}
                type="number"
                className={adminStyles.control}
                min={field.min}
                max={field.max}
                value={String(draft[field.key] ?? '')}
                onChange={(event) => set(field.key, Number(event.target.value))}
              />
            </Field>
          ))}

          <Field
            id="setting-daily_ingest_at"
            width={230}
            hint="Время по часовому поясу отображения."
            label={
              <>
                Суточный приём в{' '}
                {overridden.has('daily_ingest_at') ? <Pill value="задано" tone="warn" /> : null}
              </>
            }
          >
            <input
              id="setting-daily_ingest_at"
              type="time"
              className={adminStyles.control}
              value={String(draft.daily_ingest_at ?? '')}
              onChange={(event) => set('daily_ingest_at', event.target.value)}
            />
          </Field>

          <Field
            id="setting-stereo_role_method"
            label="Способ определения ролей"
            width={230}
            hint="Других способов пока не написано (SP-302a): список из одного пункта честнее пустого выбора."
          >
            <select
              id="setting-stereo_role_method"
              className={adminStyles.control}
              value={String(draft.stereo_role_method ?? 'stereo_energy')}
              onChange={(event) => set('stereo_role_method', event.target.value)}
            >
              <option value="stereo_energy">по энергии каналов</option>
            </select>
          </Field>
        </div>

        <h3 className={adminStyles.sectionTitle}>
          Попытки по этапам{' '}
          {overridden.has('max_attempts') ? <Pill value="задано" tone="warn" /> : null}
        </h3>
        <p className={adminStyles.hint}>
          Исчерпав попытки, задание умирает и звонок выходит из очереди. Задать надо все этапы:
          сервер принимает набор целиком, чтобы половина настройки не осталась от прошлого раза.
        </p>
        <div className={adminStyles.filters}>
          {JOB_KINDS.map((kind) => (
            <Field key={kind} id={`attempts-${kind}`} label={JOB_KIND_LABEL[kind]} width={150}>
              <input
                id={`attempts-${kind}`}
                type="number"
                className={adminStyles.control}
                min={1}
                max={100}
                value={String(attempts[kind] ?? '')}
                onChange={(event) =>
                  set('max_attempts', { ...attempts, [kind]: Number(event.target.value) })
                }
              />
            </Field>
          ))}
        </div>

        <div className={adminStyles.rowActions}>
          <button type="submit" className={adminStyles.button} disabled={save.isPending}>
            Сохранить
          </button>
          <button
            type="button"
            className={adminStyles.ghost}
            onClick={() => {
              setDraft(null);
              setNothingToSave(false);
            }}
          >
            Вернуть как было
          </button>
        </div>
      </form>
    </Screen>
  );
}
