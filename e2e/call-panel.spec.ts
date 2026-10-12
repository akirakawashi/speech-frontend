import { expect, type Page, test } from '@playwright/test';

import { aCallWithMasking, ensureLongRecording, markOneRecordingMissing } from './stand';

/**
 * Панель разговора против поднятого стенда в режиме `open` (SP-505).
 *
 * Данные сеются `scratchpad/seed_demo.py` и `scratchpad/seed_audio.py`; второй
 * кладёт в хранилище настоящую запись на 35 минут — перемотку на выдуманном
 * файле проверить нельзя, браузер не станет перематывать то, у чего нет ни
 * длительности, ни индекса кадров.
 *
 * Отказ `reader`'у здесь не проверяется: в режиме `open` у принципала все роли.
 * Это закрыто тестами сервиса (`test_a_reader_cannot_download`,
 * `test_a_reader_cannot_reveal_and_leaves_no_trace`) — там, где решение и
 * принимается.
 */

/**
 * Открывает панель первого найденного разговора и ждёт его транскрипт.
 *
 * @param page Страница браузера.
 * @param query Поисковый запрос, по которому ищется разговор.
 */
async function openFirstCall(page: Page, query = 'интернет'): Promise<void> {
  // `period=all`: проверяемое поведение панели от даты звонка не зависит, а
  // умолчание в тридцать дней отсекло бы любой корпус старше месяца.
  await page.goto(`/dialogs?period=all&q=${encodeURIComponent(query)}`);
  await page.locator('article').first().waitFor({ timeout: 15_000 });
  await page.locator('article a').first().click();
  const panel = page.getByRole('complementary', { name: 'Разговор' });
  await expect(panel).toBeVisible({ timeout: 15_000 });
  // Панель видна раньше, чем приходит транскрипт, и тест, начавший искать
  // реплику сразу, ищет её в пустом списке. Ожидание здесь, а не в каждом
  // тесте: гонка одна на всех.
  await expect(panel.locator('button[class*="reply"]').first()).toBeVisible({ timeout: 15_000 });
}

test('карточка открывает панель, и адрес меняется на звонок (PLY-01)', async ({ page }) => {
  await openFirstCall(page);

  await expect(page).toHaveURL(/\/calls\/[0-9a-f-]{36}/);
  // Плеер на странице один — второй не открывается.
  await expect(page.locator('audio')).toHaveCount(1);
});

test('транскрипт показывает роли, таймкоды и подсвечивает найденное (PLY-04)', async ({ page }) => {
  await openFirstCall(page);
  const panel = page.getByRole('complementary', { name: 'Разговор' });

  await expect(panel.getByText('клиент').first()).toBeVisible();
  await expect(panel.getByText('оператор').first()).toBeVisible();
  await expect(panel.locator('mark').first()).toContainText(/интернет/i);
});

test('клик по реплике перематывает запись (PLY-04)', async ({ page }) => {
  await openFirstCall(page);
  const panel = page.getByRole('complementary', { name: 'Разговор' });

  const before = await page.locator('audio').evaluate((el: HTMLAudioElement) => el.currentTime);
  // Нужна реплика, начинающаяся не в нуле, — иначе перемотка неотличима от её
  // отсутствия. Раньше здесь стоял таймкод `0:10` из сидового набора: на другом
  // корпусе такой реплики просто нет, и тест краснел, ничего не найдя.
  const target = panel.locator('button[class*="reply"]').filter({ hasNotText: '0:00' }).first();
  await expect(target).toBeVisible({ timeout: 15_000 });
  await target.click();
  const after = await page.locator('audio').evaluate((el: HTMLAudioElement) => el.currentTime);

  expect(after).toBeGreaterThan(before);
});

test('открытая панель не обнуляет выдачу рядом с собой', async ({ page }) => {
  // Страница разговора разбирает адрес заново и строит по нему ту же выдачу
  // слева. Ссылка карточки несла только `q`, теряя период, — и рядом с
  // открытой панелью оказывалось «ничего не найдено», хотя разговоры только
  // что нашли. С «за всё время» это стало видно сразу: корпус за январь
  // исчезал целиком.
  await page.goto('/dialogs?period=all');
  await page.locator('article').first().waitFor({ timeout: 15_000 });
  await page.locator('article a').first().click();

  await expect(page.getByRole('complementary', { name: 'Разговор' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page).toHaveURL(/period=all/);
  await expect(page.locator('article').first()).toBeVisible();
  await expect(page.getByText('Ничего не найдено')).toHaveCount(0);
});

test('прямая ссылка на разговор показывает его даже при пустой выдаче', async ({ page }) => {
  // Ссылку присылают коллеге, и открывается она без параметров поиска. Период
  // тогда умалчивается в тридцать дней, январский разговор в них не попадает,
  // выдача пуста — а разговор, ради которого ссылку открыли, показать
  // обязаны. Сетка со списком и панелью стояла внутри ветки «найденное
  // показано», и панель исчезала вместе со списком.
  const call = aCallWithMasking();
  await page.goto(`/calls/${call}`);

  const panel = page.getByRole('complementary', { name: 'Разговор' });
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(panel.locator('button[class*="reply"]').first()).toBeVisible({ timeout: 15_000 });
});

test('карточка открытого разговора помечена в выдаче', async ({ page }) => {
  // Иначе панель висит рядом с пятнадцатью одинаковыми карточками, и какой из
  // них она принадлежит, видно только по дате в её шапке.
  await page.goto('/dialogs?period=all');
  await page.locator('article').first().waitFor({ timeout: 15_000 });
  await page.locator('article a').first().click();
  await expect(page.getByRole('complementary', { name: 'Разговор' })).toBeVisible({
    timeout: 15_000,
  });

  await expect(page.locator('article[class*="selected"]')).toHaveCount(1, { timeout: 15_000 });
});

test('навигация по совпадениям идёт по кругу (PLY-03)', async ({ page }) => {
  await openFirstCall(page);
  const panel = page.getByRole('complementary', { name: 'Разговор' });

  const counter = panel.getByText(/совпадение \d+ из \d+/);
  await expect(counter).toBeVisible();
  const total = Number((await counter.textContent())?.match(/из (\d+)/)?.[1] ?? '0');
  expect(total).toBeGreaterThan(0);

  // «пред.» на первом совпадении обязан вернуть последнее, а не упереться:
  // кнопка, которая перестаёт работать, выглядит сломанной.
  await panel.getByRole('button', { name: '← пред.' }).click();
  await expect(counter).toHaveText(`совпадение ${total} из ${total}`);
});

test('маска показана штриховкой, раскрытие показывает исходный текст (PLY-05)', async ({
  page,
}) => {
  // Звонок выбирается по факту маскировки, а не поиском по слову: проверяется
  // поведение интерфейса, а не то, чей номер назвали в разговоре. Раньше тест
  // ждал заранее известный телефон из сидового набора и на настоящей выгрузке
  // не находил ни его, ни слова, которым открывал звонок.
  await page.goto(`/calls/${aCallWithMasking()}`);
  const panel = page.getByRole('complementary', { name: 'Разговор' });
  await expect(panel).toBeVisible({ timeout: 15_000 });

  const hidden = panel.getByText('•••').first();
  await expect(hidden).toBeVisible({ timeout: 15_000 });

  await panel.getByRole('button', { name: 'Показать скрытое' }).click();

  await expect(panel.getByText('исходный текст показан')).toBeVisible({ timeout: 10_000 });
  // Штриховки на месте раскрытого больше нет — иначе «показать» ничего не
  // показало бы.
  await expect(panel.locator('[class*="revealed"]').first()).toBeVisible();

  // Помечены ровно те реплики, где маска и была. Пометив все, интерфейс
  // потерял бы единственное, ради чего кнопку нажимали: где именно скрывали.
  const revealed = panel.locator('[class*="revealed"]');
  const replies = panel.locator('button[class*="reply"]');
  expect(await revealed.count()).toBeGreaterThan(0);
  expect(await revealed.count()).toBeLessThan(await replies.count());
});

test('перемотка работает на записи длиннее получаса (PLY-02)', async ({ page }) => {
  // Тот самый критерий готовности SP-505, названный в минутах. Запись длиннее
  // получаса тест заводит сам: в настоящей выгрузке самый длинный разговор —
  // четырнадцать минут, и на нём этот критерий не проверяется.
  const long = ensureLongRecording(35);
  try {
    await page.goto(`/calls/${long.callId}`);
    const panel = page.getByRole('complementary', { name: 'Разговор' });
    await expect(panel.getByText('0:00 / 35:00')).toBeVisible({ timeout: 20_000 });

    // Перемотка в середину: браузер обязан взять диапазон, а не скачать файл.
    await page.locator('audio').evaluate((el: HTMLAudioElement) => {
      el.currentTime = 1200;
    });

    await expect(panel.getByText(/20:0\d \/ 35:00/)).toBeVisible({ timeout: 20_000 });
  } finally {
    long.restore();
  }
});

test('скорость воспроизведения переключается (PLY-02)', async ({ page }) => {
  await openFirstCall(page);
  const panel = page.getByRole('complementary', { name: 'Разговор' });

  await panel.getByRole('button', { name: '1.5×' }).click();

  const rate = await page.locator('audio').evaluate((el: HTMLAudioElement) => el.playbackRate);
  expect(rate).toBe(1.5);
});

test('«Ссылка» несёт запрос и позицию (PLY-06)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openFirstCall(page);
  const panel = page.getByRole('complementary', { name: 'Разговор' });

  await page.locator('audio').evaluate((el: HTMLAudioElement) => {
    el.currentTime = 42;
  });
  await panel.getByRole('button', { name: 'Ссылка' }).click();

  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/calls\/[0-9a-f-]{36}\?/);
  expect(link).toContain('q=');
  expect(link).toContain('t=42');
});

test('звонок без записи объясняет причину, транскрипт работает (PLY-07)', async ({ page }) => {
  // Предусловие создаёт сам тест и сам снимает: «записи не было у источника» —
  // состояние сбора, кнопки для него в интерфейсе нет.
  const missing = markOneRecordingMissing();
  try {
    await page.goto(`/calls/${missing.callId}`);

    const panel = page.getByRole('complementary', { name: 'Разговор' });
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText('Записи не было у источника — транскрипт доступен')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('audio')).toHaveCount(0);
    // Транскрипт при этом на месте — иначе «нет аудио» читалось бы как
    // «нет разговора».
    await expect(panel.getByText('клиент').first()).toBeVisible();
  } finally {
    missing.restore();
  }
});

test('закрытие панели возвращает к выдаче с тем же запросом', async ({ page }) => {
  await openFirstCall(page);

  await page.getByRole('button', { name: 'Закрыть' }).click();

  await expect(page).toHaveURL(/\/dialogs\?q=/);
  await expect(page.getByRole('heading', { name: 'Диалоги' })).toBeVisible();
});
