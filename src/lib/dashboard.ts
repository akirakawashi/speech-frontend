/**
 * Дашборд: состояние экрана в адресе, запрос к серверу и то, что считается на
 * месте, — подписи столбцов, шкала, цвета тем и итог словами.
 *
 * Счёты приходят с сервера готовыми (`/api/v1/dashboard`): корзины, шесть тем и
 * «Прочее», числа выбранной темы. Здесь ничего не пересчитывается — иначе у
 * экрана и у выгрузки было бы по своей арифметике.
 */

import { apiUrl, type DashboardResponse, type DashboardTheme } from '@/api/client';
import { formatCount } from '@/lib/format';
import { formatDay, type Period, percent, periodLabel } from '@/lib/quality';
import {
  dayStartInstant,
  defaultPeriod,
  EMPTY_STATE,
  nextDay,
  type SearchState,
  toSearchParams,
} from '@/lib/search-params';

export type Grain = 'day' | 'week' | 'month';

export const GRAINS: readonly Grain[] = ['day', 'week', 'month'];

export const GRAIN_LABEL: Record<Grain, string> = {
  day: 'Дни',
  week: 'Недели',
  month: 'Месяцы',
};

/** Ключ «Прочего» — тот же, что отдаёт сервер (`OTHER_THEME`). */
export const OTHER_THEME = '__other__';

/**
 * Состояние экрана, целиком живёт в адресе.
 *
 * `grain` — ручной выбор корзины. Пусто — сервер выбирает сам по длине
 * периода, и какая выбрана, говорит ответ. Смена периода ручной выбор
 * сбрасывает: «дни» для недели и для года — разные решения.
 */
export type DashboardState = {
  /** Сутки периода в виде `YYYY-MM-DD`. */
  from: string;
  to: string;
  grain: Grain | '';
  /** Ключ выбранной темы; пусто — все темы. */
  theme: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Столько сервер принимает в `theme`; длиннее — отказ `422`. */
const THEME_LIMIT = 200;

function day(value: string | null): string {
  return value && DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : '';
}

export function parseDashboardState(params: URLSearchParams, now: Date): DashboardState {
  const fallback = defaultPeriod(now);
  const grain = params.get('grain');
  const from = day(params.get('from')) || fallback.from;
  const to = day(params.get('to')) || fallback.to;
  return {
    from: from > to ? to : from,
    to,
    grain: GRAINS.includes(grain as Grain) ? (grain as Grain) : '',
    theme: (params.get('theme') ?? '').slice(0, THEME_LIMIT),
  };
}

export function toDashboardParams(state: DashboardState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.from) params.set('from', state.from);
  if (state.to) params.set('to', state.to);
  if (state.grain) params.set('grain', state.grain);
  if (state.theme) params.set('theme', state.theme);
  return params;
}

/**
 * Параметры «Диалогов», которых у дашборда нет. Корень сайта раньше был
 * «Диалогами», и ссылка вида `/?q=роуминг` должна открыть поиск, а не дашборд.
 * `from` и `to` сюда не входят: они есть у обоих экранов.
 */
const DIALOGS_ONLY = [
  'q',
  'source',
  'operator_id',
  'project_id',
  'node_id',
  'segment',
  'product',
  'page',
  'period',
] as const;

export function isDialogsLink(params: URLSearchParams): boolean {
  return DIALOGS_ONLY.some((name) => params.has(name));
}

type ApiQuery = Record<string, string | undefined>;

/**
 * Запрос дашборда. Границы — начало суток в зоне показа, верхняя — начало
 * следующих суток: так же, как у поиска и оценки, иначе один и тот же день на
 * двух экранах значил бы разные звонки.
 */
export function dashboardQuery(state: DashboardState, timeZone: string): ApiQuery {
  return {
    from: dayStartInstant(state.from, timeZone),
    to: dayStartInstant(nextDay(state.to), timeZone),
    grain: state.grain || undefined,
    theme: state.theme || undefined,
  };
}

/** Тот же период для KPI и плиток тем: их отдаёт `/api/v1/stats` по NCC. */
export function statsState(state: Pick<DashboardState, 'from' | 'to'>): SearchState {
  return { ...EMPTY_STATE, from: state.from, to: state.to };
}

/** Поиск «Диалогов» по ветке темы за тот же период. */
export function topicHref(state: Pick<DashboardState, 'from' | 'to'>, nodeId: string): string {
  return `/dialogs?${toSearchParams({ ...statsState(state), nodeId }).toString()}`;
}

/** Адрес выгрузки: период и корзина экрана. Тема в файл не идёт — в нём все темы. */
export function exportHref(state: DashboardState, timeZone: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(dashboardQuery({ ...state, theme: '' }, timeZone))) {
    if (value !== undefined) params.set(key, value);
  }
  return `${apiUrl('/api/v1/dashboard.xlsx')}?${params.toString()}`;
}

// --------------------------------------------------------------------------- //
// Показ
// --------------------------------------------------------------------------- //

/** Число с разрядами по-русски: `12 340`. */
export function count(value: number): string {
  return value.toLocaleString('ru-RU');
}

/** Изменение долей со знаком: `+12%`, `−8%`, `0%`. Минус — настоящий, не дефис. */
export function signedPercent(change: number): string {
  const rounded = Math.round(change * 100);
  if (rounded === 0) return '0%';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}%`;
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/**
 * Подпись столбца. День — `14.09`, неделя — её первый день (полный диапазон —
 * в подсказке), месяц — `сен`; год дописывается, когда период их задевает два.
 */
export function bucketLabel(bucket: Period, grain: Grain, withYear = false): string {
  if (grain === 'month') {
    const month = MONTHS[Number(bucket.from.slice(5, 7)) - 1] ?? bucket.from.slice(5, 7);
    return withYear ? `${month} ${bucket.from.slice(2, 4)}` : month;
  }
  return formatDay(bucket.from).slice(0, 5);
}

/** Диапазон корзины для подсказки и таблицы: `14.09–20.09`, один день — `14.09`. */
export function bucketSpan(bucket: Period): string {
  return periodLabel(bucket);
}

/**
 * Верх шкалы и её деления — круглые числа: 1, 2 или 5 на степень десяти. Ось с
 * делениями 0 / 37 / 74 / 111 заставляет считать вместо того, чтобы читать.
 */
export function axisTicks(max: number, lines = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / lines;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((unit) => unit * power).find((unit) => unit >= rough) ?? rough;
  const whole = Math.max(1, Math.round(step));
  const ticks: number[] = [];
  for (let tick = 0; tick < max + whole; tick += whole) ticks.push(tick);
  return ticks;
}

/**
 * Цвет темы — её место в палитре, а место — по ключу темы, не по числу
 * звонков. Иначе тема, обогнавшая соседнюю, менялась бы с ней цветом, и человек,
 * запомнивший «не работает — синее», читал бы чужой столбец.
 *
 * Порядок мест — он же порядок сегментов в столбце и строк в легенде: палитра
 * проверена на различимость именно соседних мест. «Прочее» — всегда последнее
 * и нейтральное.
 */
export function themeSlots(themes: readonly Pick<DashboardTheme, 'key'>[]): Map<string, number> {
  const named = themes
    .map((theme) => theme.key)
    .filter((key) => key !== OTHER_THEME)
    .sort((a, b) => a.localeCompare(b, 'ru'));
  const slots = new Map(named.map((key, index) => [key, index]));
  if (themes.some((theme) => theme.key === OTHER_THEME)) slots.set(OTHER_THEME, named.length);
  return slots;
}

/** Темы в порядке мест палитры — так они лежат в столбце и в легенде. */
export function inSlotOrder<T extends Pick<DashboardTheme, 'key'>>(themes: readonly T[]): T[] {
  const slots = themeSlots(themes);
  return [...themes].sort((a, b) => (slots.get(a.key) ?? 0) - (slots.get(b.key) ?? 0));
}

/** Меньше звонков — доля негатива темы случайна, и называть её «самой негативной» нельзя. */
const NEGATIVE_MIN_CALLS = 20;

/**
 * «Итог за период» словами — из тех же чисел, что на экране. В макете это
 * сгенерированная сводка; здесь шаблон (решение владельца 2026-10-08): он не
 * стоит запроса к модели и не скажет того, чего нет в числах.
 */
/** «71 обращение», «2 обращения», «1 000 обращений»: число и слово в нужной форме. */
function calls(value: number): string {
  return formatCount(value, 'обращение', 'обращения', 'обращений');
}

export function summaryText(data: DashboardResponse): string {
  const chosen = data.selection;
  if (data.calls === 0) return 'За период нет разобранных обращений с темой.';

  const parts: string[] = [];
  if (chosen.theme) {
    if (chosen.calls === 0) return `По теме «${chosen.label}» за период обращений нет.`;
    parts.push(
      `«${chosen.label}»: ${calls(chosen.calls)} за период — ` +
        `${percent(chosen.calls / data.calls)} от всех.`,
    );
    const lead = (chosen.subtopics ?? [])[0];
    if (lead && chosen.theme !== OTHER_THEME) {
      parts.push(`Чаще всего — «${lead.label}» (${percent(lead.share)}).`);
    }
  } else {
    const named = (data.themes ?? []).filter((theme) => theme.key !== OTHER_THEME);
    const [first, second] = named;
    parts.push(`За период ${calls(data.calls)} с темой.`);
    if (first) {
      parts.push(
        `Чаще всего — «${first.label}» (${percent(first.share)})` +
          (second ? `, затем «${second.label}» (${percent(second.share)}).` : '.'),
      );
    }
  }

  if (chosen.negative_share !== null && chosen.negative_share !== undefined) {
    let negative = `Доля негатива — ${percent(chosen.negative_share)}`;
    if (!chosen.theme) {
      const worst = (data.themes ?? [])
        .filter((theme) => theme.key !== OTHER_THEME && theme.calls >= NEGATIVE_MIN_CALLS)
        .filter((theme) => theme.negative_share !== null && theme.negative_share !== undefined)
        .sort((a, b) => (b.negative_share ?? 0) - (a.negative_share ?? 0))[0];
      if (worst && (worst.negative_share ?? 0) > chosen.negative_share) {
        negative += `, выше всего у темы «${worst.label}» — ${percent(worst.negative_share ?? 0)}`;
      }
    }
    parts.push(`${negative}.`);
  }

  if (chosen.change !== null && chosen.change !== undefined) {
    const rounded = Math.round(chosen.change * 100);
    parts.push(
      rounded === 0
        ? 'Во второй половине периода обращений столько же, сколько в первой.'
        : `Во второй половине периода обращений на ${Math.abs(rounded)}% ` +
            `${rounded > 0 ? 'больше' : 'меньше'}, чем в первой.`,
    );
  }
  return parts.join(' ');
}
