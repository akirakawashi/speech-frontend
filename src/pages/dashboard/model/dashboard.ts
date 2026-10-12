import { parseDay } from '@/shared/lib/date';
/**
 * Дашборд: состояние экрана в адресе, запрос к серверу и то, что считается на
 * месте, — подписи столбцов, шкала, цвета тем и итог словами.
 *
 * Счёты приходят с сервера готовыми (`/api/v1/dashboard`): корзины, шесть тем и
 * «Прочее», числа выбранной темы. Здесь ничего не пересчитывается — иначе у
 * экрана и у выгрузки было бы по своей арифметике.
 */

import { EMPTY_STATE, type SearchState, toSearchParams } from '@/features/call-search';
import { apiUrl } from '@/shared/api';
import {
  dayStartInstant,
  defaultPeriod,
  formatDay,
  nextDay,
  type Period,
  periodLabel,
} from '@/shared/lib/date';
import { formatCount, percent } from '@/shared/lib/format';
import type { DashboardResponse, DashboardTheme } from '../api/types';

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

/** Столько сервер принимает в `theme`; длиннее — отказ `422`. */
const THEME_LIMIT = 200;

/**
 * Разбирает состояние дашборда из адресной строки.
 *
 * @param params Параметры адреса.
 * @param now Текущий момент: от него отсчитывается период по умолчанию.
 * @returns Состояние экрана; чужие значения заменены умолчаниями, перевёрнутый период выправлен.
 */
export function parseDashboardState(params: URLSearchParams, now: Date): DashboardState {
  const fallback = defaultPeriod(now);
  const grain = params.get('grain');
  const from = parseDay(params.get('from')) || fallback.from;
  const to = parseDay(params.get('to')) || fallback.to;
  return {
    from: from > to ? to : from,
    to,
    grain: GRAINS.includes(grain as Grain) ? (grain as Grain) : '',
    theme: (params.get('theme') ?? '').slice(0, THEME_LIMIT),
  };
}

/**
 * Записывает состояние дашборда в параметры адреса.
 *
 * @param state Состояние экрана.
 * @returns Параметры адреса без пустых значений.
 */
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

/**
 * Проверяет, что адрес — старая ссылка на «Диалоги».
 *
 * @param params Параметры адреса.
 * @returns `true`, если в адресе есть параметр, которого у дашборда нет.
 */
export function isDialogsLink(params: URLSearchParams): boolean {
  return DIALOGS_ONLY.some((name) => params.has(name));
}

type ApiQuery = Record<string, string | undefined>;

/**
 * Собирает параметры запроса дашборда.
 *
 * Границы — начало суток в зоне показа, верхняя — начало следующих суток: так же, как у поиска и
 * оценки, иначе один и тот же день на двух экранах значил бы разные звонки.
 *
 * @param state Состояние экрана.
 * @param timeZone Часовой пояс показа: в нём считаются границы суток.
 * @returns Параметры запроса; незаданные корзина и тема — `undefined`.
 */
export function dashboardQuery(state: DashboardState, timeZone: string): ApiQuery {
  return {
    from: dayStartInstant(state.from, timeZone),
    to: dayStartInstant(nextDay(state.to), timeZone),
    grain: state.grain || undefined,
    theme: state.theme || undefined,
  };
}

/**
 * Строит состояние поиска с тем же периодом — для KPI и плиток тем: их отдаёт `/api/v1/stats` по
 * NCC.
 *
 * @param state Состояние экрана: из него берётся период.
 * @returns Состояние поиска без запроса и фильтров.
 */
export function statsState(state: Pick<DashboardState, 'from' | 'to'>): SearchState {
  return { ...EMPTY_STATE, from: state.from, to: state.to };
}

/**
 * Строит ссылку на поиск «Диалогов» по ветке темы за тот же период.
 *
 * @param state Состояние экрана: из него берётся период.
 * @param nodeId Идентификатор узла темы.
 * @returns Адрес `/dialogs` с периодом и узлом в параметрах.
 */
export function topicHref(state: Pick<DashboardState, 'from' | 'to'>, nodeId: string): string {
  return `/dialogs?${toSearchParams({ ...statsState(state), nodeId }).toString()}`;
}

/**
 * Строит адрес выгрузки: период и корзина экрана.
 *
 * Тема в файл не идёт — в нём все темы.
 *
 * @param state Состояние экрана.
 * @param timeZone Часовой пояс показа.
 * @returns Адрес файла Excel на API.
 */
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

/**
 * Записывает число с разрядами по-русски: `12 340`.
 *
 * @param value Число.
 * @returns Строка с пробелами между разрядами.
 */
export function count(value: number): string {
  return value.toLocaleString('ru-RU');
}

/**
 * Записывает изменение доли процентами со знаком: `+12%`, `−8%`, `0%`.
 *
 * Минус — настоящий, не дефис.
 *
 * @param change Изменение долей: `0.12` — рост на 12%.
 * @returns Строка с процентами.
 */
export function signedPercent(change: number): string {
  const rounded = Math.round(change * 100);
  if (rounded === 0) return '0%';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}%`;
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/**
 * Подписывает столбец корзины.
 *
 * День — `14.09`, неделя — её первый день (полный диапазон — в подсказке), месяц — `сен`; год
 * дописывается, когда период их задевает два.
 *
 * @param bucket Границы корзины.
 * @param grain Размер корзины: день, неделя или месяц.
 * @param withYear Дописывать ли год к месяцу.
 * @returns Короткая подпись под столбцом.
 */
export function bucketLabel(bucket: Period, grain: Grain, withYear = false): string {
  if (grain === 'month') {
    const month = MONTHS[Number(bucket.from.slice(5, 7)) - 1] ?? bucket.from.slice(5, 7);
    return withYear ? `${month} ${bucket.from.slice(2, 4)}` : month;
  }
  return formatDay(bucket.from).slice(0, 5);
}

/**
 * Подписывает диапазон корзины для подсказки и таблицы: `14.09–20.09`, один день — `14.09`.
 *
 * @param bucket Границы корзины.
 * @returns Диапазон без года.
 */
export function bucketSpan(bucket: Period): string {
  return periodLabel(bucket);
}

/**
 * Подбирает деления шкалы графика.
 *
 * Верх шкалы и её деления — круглые числа: 1, 2 или 5 на степень десяти. Ось с
 * делениями 0 / 37 / 74 / 111 заставляет считать вместо того, чтобы читать.
 *
 * @param max Наибольшее значение на графике.
 * @param lines Сколько делений нужно примерно.
 * @returns Деления от нуля; последнее — верх шкалы.
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
 * Раздаёт темам места в палитре.
 *
 * Цвет темы — её место в палитре, а место — по ключу темы, не по числу
 * звонков. Иначе тема, обогнавшая соседнюю, менялась бы с ней цветом, и человек,
 * запомнивший «не работает — синее», читал бы чужой столбец.
 *
 * Порядок мест — он же порядок сегментов в столбце и строк в легенде: палитра
 * проверена на различимость именно соседних мест. «Прочее» — всегда последнее
 * и нейтральное.
 *
 * @param themes Темы дашборда.
 * @returns Место каждой темы: ключ темы → номер места.
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

/**
 * Расставляет темы в порядке мест палитры — так они лежат в столбце и в легенде.
 *
 * @param themes Темы дашборда.
 * @returns Новый список тем в порядке мест.
 */
export function inSlotOrder<T extends Pick<DashboardTheme, 'key'>>(themes: readonly T[]): T[] {
  const slots = themeSlots(themes);
  return [...themes].sort((a, b) => (slots.get(a.key) ?? 0) - (slots.get(b.key) ?? 0));
}

/** Меньше звонков — доля негатива темы случайна, и называть её «самой негативной» нельзя. */
const NEGATIVE_MIN_CALLS = 20;

/**
 * Записывает число обращений со словом в нужной форме: «71 обращение», «2 обращения», «1 000
 * обращений».
 *
 * @param value Число обращений.
 * @returns Число и слово.
 */
function calls(value: number): string {
  return formatCount(value, 'обращение', 'обращения', 'обращений');
}

/**
 * Собирает «Итог за период» словами — из тех же чисел, что на экране.
 *
 * В макете это сгенерированная сводка; здесь шаблон (решение владельца
 * 2026-10-08): он не стоит запроса к модели и не скажет того, чего нет в числах.
 *
 * @param data Ответ дашборда.
 * @returns Несколько предложений: сколько обращений, какие темы чаще, доля негатива и изменение за
 *   период.
 */
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
