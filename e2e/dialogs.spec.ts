import { expect, test } from '@playwright/test';

import { markOneRecordingDeleted } from './stand';

/**
 * Экран «Диалоги» против поднятого стенда в режиме `open` (SP-504).
 *
 * Против настоящего API, а не моков: моки подтвердили бы, что компоненты
 * рисуют то, что им дали, — а вопрос в том, договариваются ли фронт и сервер о
 * форме данных, о пустом периоде и о том, что считается совпадением.
 *
 * Корпус на стенде тесты не создают и не удаляют — но и не предполагают, что
 * он свежий. Раньше предполагали: половина набора требовала звонков за
 * последние тридцать дней, и когда на стенде оказалась настоящая выгрузка за
 * январь, четыре теста покраснели, не найдя ни одного дефекта. Проверяемое
 * поведение от даты звонка не зависит, поэтому те тесты, которым нужна
 * непустая выдача, открывают экран сразу «за всё время».
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/dialogs');
  await expect(page.getByRole('heading', { name: 'Диалоги' })).toBeVisible();
});

test('KPI периода показаны числами, а не прочерками', async ({ page }) => {
  const kpis = page.getByLabel('Показатели периода');

  await expect(kpis).toContainText('Обработано звонков');
  await expect(kpis).toContainText('Расшифровано');
  // Прочерк означает «ответ ещё не пришёл»; после загрузки он недопустим.
  await expect(kpis.locator('div').first()).not.toHaveText('—', { timeout: 10_000 });
});

test('пустой запрос показывает разговоры периода, а не «ничего не найдено»', async ({ page }) => {
  await page.goto('/dialogs?period=all');
  await expect(page.locator('article')).not.toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByText('Ничего не найдено')).toHaveCount(0);
});

test('подпись режима меняется на кавычках (SRC-01)', async ({ page }) => {
  const input = page.getByLabel('Поисковый запрос');

  await input.fill('не работает интернет');
  await expect(page.getByText('слова в любом порядке')).toBeVisible();

  await input.fill('"не работает интернет"');
  await expect(page.getByText('точная фраза')).toBeVisible();
});

test('поиск находит разговоры и подсвечивает найденное', async ({ page }) => {
  await page.goto('/dialogs?period=all');
  await page.getByLabel('Поисковый запрос').fill('интернет');
  await page.getByRole('button', { name: 'Искать', exact: true }).click();

  await expect(page.getByText(/Найдено/)).toBeVisible({ timeout: 10_000 });
  const marks = page.locator('mark');
  await expect(marks.first()).toBeVisible();
  await expect(marks.first()).toContainText(/интернет/i);
});

test('карточка открывает разговор кликом в любое место, а не только по дате', async ({ page }) => {
  // Владелец сообщил ровно это: «клик по карточке не отрабатывает,
  // отрабатывает только клик по дате». Ссылкой была одна дата, и карточка
  // высотой в сто пикселей выглядела ненажимаемой.
  await page.goto('/dialogs?period=all');
  const card = page.locator('article').first();
  await expect(card).toBeVisible({ timeout: 15_000 });

  // Клик в правую нижнюю часть карточки — заведомо мимо даты и мимо цитат.
  const box = await card.boundingBox();
  if (!box) throw new Error('карточка без размеров');
  await page.mouse.click(box.x + box.width - 24, box.y + 16);

  await expect(page).toHaveURL(/\/calls\/[0-9a-f-]{36}/, { timeout: 15_000 });
});

test('клик по цитате открывает разговор на её секунде', async ({ page }) => {
  await page.goto('/dialogs?period=all&q=%D0%BE%D0%BF%D0%BB%D0%B0%D1%82%D0%B0');
  const card = page.locator('article').first();
  await expect(card).toBeVisible({ timeout: 15_000 });

  // Цитата ведёт не в начало записи: найденное место иначе пришлось бы искать
  // заново. Секунда стоит в адресе, панель её читает.
  const quote = card.locator('a[href*="t="]').first();
  await expect(quote).toBeVisible();
  await quote.click();

  await expect(page).toHaveURL(/[?&]t=\d+/, { timeout: 15_000 });
});

test('классификация стоит в карточке всегда — даже когда её ещё нет', async ({ page }) => {
  // Пустота на месте классификации читается как «не важна», а не как «анализ
  // ещё не дошёл». На стенде анализ ждёт приложения Dify, и это должно быть
  // сказано словами, а не отсутствием чипа.
  await page.goto('/dialogs?period=all');
  const card = page.locator('article').first();
  await expect(card).toBeVisible({ timeout: 15_000 });

  // Либо путь по классификатору, либо честная пометка о его отсутствии — но
  // место под него занято в обоих случаях.
  const classification = card.locator('[class*="chip"]').first();
  await expect(classification).toBeVisible();
  await expect(classification).not.toBeEmpty();
});

test('состояние живёт в адресе и переживает перезагрузку', async ({ page }) => {
  await page.getByLabel('Поисковый запрос').fill('тариф');
  await page.getByRole('button', { name: 'Искать', exact: true }).click();
  await expect(page).toHaveURL(/q=/, { timeout: 10_000 });

  const url = page.url();
  await page.reload();

  await expect(page).toHaveURL(url);
  await expect(page.getByLabel('Поисковый запрос')).toHaveValue('тариф');
});

test('бессмысленный запрос даёт «ничего не найдено» с подсказкой (SRC-06)', async ({ page }) => {
  await page.getByLabel('Поисковый запрос').fill('щщщнесуществующееслово');
  await page.getByRole('button', { name: 'Искать', exact: true }).click();

  const results = page.getByRole('region', { name: 'Результаты поиска' });
  await expect(results.getByText('Ничего не найдено')).toBeVisible({ timeout: 10_000 });
  // Подсказка обязана быть действием, а не сочувствием. Кнопка внутри самого
  // состояния, а не та же в фильтрах: человек уже смотрит сюда.
  await expect(results.getByRole('button', { name: 'Искать за всё время' })).toBeVisible();
});

test('«Искать за всё время» снимает период', async ({ page }) => {
  // Проверка идёт до выдачи, а не до адресной строки. Ровно на этом и
  // споткнулись: кнопка меняла адрес, снимала период у себя — и уходил запрос
  // без границ. Сервер обязан иметь умолчание в тридцать дней, отсутствие
  // границ им уже занято, и он подставлял те же тридцать дней. Экран не менялся,
  // а тест был зелёным.
  await page.goto('/dialogs?from=2000-01-01&to=2000-01-02');
  await expect(page.getByText('За выбранный период разговоров нет')).toBeVisible({
    timeout: 10_000,
  });

  await page
    .getByRole('region', { name: 'Фильтры' })
    .getByRole('button', { name: 'Искать за всё время' })
    .click();

  await expect(page).toHaveURL(/period=all/, { timeout: 10_000 });
  await expect(page.getByText(/Найдено/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('article').first()).toBeVisible();
  // Поля дат остаются живыми. Выключенными они отнимали единственный выход:
  // снять «всё время» полагалось правкой даты в поле, которое для этого выключено.
  await expect(page.getByLabel('Период с')).toBeEnabled();
});

test('«всё время» снимается обратно — кнопкой и правкой даты', async ({ page }) => {
  await page.goto('/dialogs?period=all');
  const filters = page.getByRole('region', { name: 'Фильтры' });

  await filters.getByRole('button', { name: 'Вернуть период' }).click();

  await expect(page).not.toHaveURL(/period=all/, { timeout: 10_000 });
  await expect(page.getByLabel('Период с')).not.toHaveValue('');

  // И второй путь наружу: прямая правка даты.
  await page.goto('/dialogs?period=all');
  await page.getByLabel('Период с').fill('2026-01-01');

  await expect(page).toHaveURL(/from=2026-01-01/, { timeout: 10_000 });
  await expect(page).not.toHaveURL(/period=all/);
});

test('мусор в адресе открывает экран, а не сообщение об ошибке', async ({ page }) => {
  await page.goto('/dialogs?q=интернет&segment=марсианский&page=abc');

  await expect(page.getByRole('heading', { name: 'Диалоги' })).toBeVisible();
  await expect(page.getByText(/Найдено|Ничего не найдено/)).toBeVisible({ timeout: 10_000 });
});

test('удалённая по сроку запись объясняется, а не выглядит поломкой', async ({ page }) => {
  // Предусловие создаёт сам тест: кнопки «удалить запись» в интерфейсе нет, а
  // фоновая уборка по сроку в тесте недождима. Снимается оно здесь же, чем бы
  // тест ни кончился.
  const deleted = markOneRecordingDeleted();
  try {
    await page.goto('/dialogs?period=all');

    // Выдача отсортирована по дате, новые сверху, а помечен самый свежий
    // звонок — значит он на первой странице.
    await expect(
      page.getByText('Запись удалена по сроку хранения — транскрипт доступен').first(),
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    deleted.restore();
  }
});
