import { expect, type Page, test } from '@playwright/test';

import { aCallReadyForReprocess, aProbeClassifierNode, snapshotSetting } from './stand';

/**
 * Экраны администрирования против поднятого стенда в режиме `open` (SP-506).
 *
 * Главный сценарий — критерий готовности задачи: изменить справочник (с SP-310 —
 * выключить узел классификатора), переобработать звонок, увидеть оба действия в
 * журнале. Он проверяет не три экрана по отдельности, а то, ради чего админка
 * существует: изменение доходит до сервера и оставляет след.
 *
 * Отказ не-администратору здесь не проверяется: в режиме `open` у принципала
 * все роли. Это закрыто тестами сервиса — там, где решение и принимается.
 */

/**
 * Открывает экран администрирования и ждёт, пока раздел загрузится.
 *
 * @param page Страница браузера.
 * @param section Адрес экрана внутри раздела: `pipeline`, `jobs` и так далее.
 */
async function openAdmin(page: Page, section: string): Promise<void> {
  await page.goto(`/admin/${section}`);
  await expect(page.getByRole('heading', { name: 'Администрирование' })).toBeVisible({
    timeout: 15_000,
  });
}

test('корень раздела открывает пайплайн, а не пустую сводку', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/pipeline/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Пайплайн' })).toBeVisible();
});

test('пайплайн показывает очередь и зависимости числами, а не прочерками', async ({ page }) => {
  await openAdmin(page, 'pipeline');

  const queue = page.getByRole('region', { name: 'Пайплайн' });
  await expect(queue.getByRole('heading', { name: 'Очередь по полосам' })).toBeVisible();
  // Строка полосы обязана появиться: на стенде есть задания.
  await expect(queue.getByRole('cell', { name: 'суточная' }).first()).toBeVisible({
    timeout: 15_000,
  });

  // «Не настроена» и «не отвечает» — разное, и обе колонки на месте.
  await expect(queue.getByRole('columnheader', { name: 'Настроена' })).toBeVisible();
  await expect(queue.getByRole('columnheader', { name: 'Отвечает' })).toBeVisible();
  await expect(queue.getByRole('cell', { name: 'storage' })).toBeVisible();
});

test('задания фильтруются по этапу и состоянию', async ({ page }) => {
  await openAdmin(page, 'jobs');
  const screen = page.getByRole('region', { name: 'Задания' });

  // Фильтр по этапу, который на стенде заведомо есть: расшифровка прошла у
  // всех звонков. Прежняя редакция фильтровала «анализ в очереди» и держалась
  // на том, что очередь ещё не разобрана, — разобралась, и тест покраснел, не
  // найдя ни одного дефекта.
  await screen.getByLabel('Этап', { exact: true }).selectOption('transcribe');
  await screen.getByLabel('Состояние', { exact: true }).selectOption('done');

  await expect(screen.getByRole('cell', { name: 'расшифровка' }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(screen.getByText(/Показано \d+ из \d+/)).toBeVisible();

  // Повтор недоступен тому, что уже сделано: «повторить» означало бы сделать ту
  // же работу дважды.
  await expect(screen.getByRole('button', { name: 'Повторить' }).first()).toBeDisabled();
});

test('несуществующий фильтр даёт пустоту с объяснением, а не сломанный экран', async ({ page }) => {
  await openAdmin(page, 'jobs');
  const screen = page.getByRole('region', { name: 'Задания' });

  await screen.getByLabel('Этап', { exact: true }).selectOption('ingest');
  await screen.getByLabel('Состояние', { exact: true }).selectOption('dead');

  await expect(screen.getByText('Заданий с такими признаками нет.')).toBeVisible({
    timeout: 15_000,
  });
});

test('настройки показывают действующие значения и границы', async ({ page }) => {
  await openAdmin(page, 'settings');
  const screen = page.getByRole('region', { name: 'Настройки' });

  const retention = screen.getByLabel(/Срок хранения записей/);
  await expect(retention).toHaveValue('180');
  // Границы — подсказка человеку до отправки. Решение принимает сервер, но
  // узнавать о нём после нажатия — лишний круг.
  await expect(retention).toHaveAttribute('max', '36500');

  // Ноль здесь — значение, а не «не задано»: канал оператора бывает левым.
  await expect(screen.getByLabel('Канал оператора в стерео')).toHaveValue('0');

  // Попытки задаются всеми этапами сразу.
  for (const stage of ['приём', 'расшифровка', 'анализ']) {
    await expect(screen.getByLabel(stage, { exact: true })).toBeVisible();
  }
});

test('проекты: синхронизация объясняет пустоту, а не молчит о ней', async ({ page }) => {
  await openAdmin(page, 'projects');
  const screen = page.getByRole('region', { name: 'Проекты' });

  await screen.getByRole('button', { name: /Синхронизировать с NCC/ }).click();

  // Настройки NCC на стенде нет, и это правильный отказ: чинить надо
  // развёртывание, а не нажимать кнопку ещё раз. Показан он должен быть
  // словами, а не кодом.
  await expect(screen.getByRole('alert')).toBeVisible({ timeout: 20_000 });
  await expect(screen.getByRole('alert')).not.toContainText('ncc_not_configured');
});

test('классификатор показан деревом пяти уровней, а не плоским списком', async ({ page }) => {
  await openAdmin(page, 'topics');
  const screen = page.getByRole('region', { name: 'Темы' });

  const rows = screen.locator('tbody tr');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  expect(await rows.count()).toBeGreaterThan(3);

  // Первая строка — узел уровня 1, раскрытый, и за ним идут его уточнения.
  // Список, в котором уточнение оторвано от родителя, читается как набор
  // несвязанных строк.
  await expect(rows.nth(0).getByRole('cell').nth(1)).toHaveText('1');
  await expect(rows.nth(0).getByRole('button', { name: /^Свернуть: / })).toBeVisible();
  await expect(rows.nth(1).getByRole('cell').nth(1)).toHaveText('2');

  await screen.getByRole('button', { name: 'Развернуть всё' }).click();
  await expect(screen.getByRole('cell', { name: '5', exact: true }).first()).toBeVisible();

  // Узлы выключаются, но не удаляются: узлом уже могут быть размечены звонки.
  await expect(screen.getByRole('button', { name: /Удалить/ })).toHaveCount(0);
});

test('настройка сохраняется и возвращается изменённой', async ({ page }) => {
  await openAdmin(page, 'settings');
  const screen = page.getByRole('region', { name: 'Настройки' });
  const field = screen.getByLabel(/Срок хранения записей/);
  const before = await field.inputValue();
  // Возврата через интерфейс мало: он оставил бы настройку закреплённой, даже
  // вернув прежнее число. Стенд обязан остаться таким, каким его взяли.
  const restore = snapshotSetting('retention_days');

  try {
    await field.fill('200');
    await screen.getByRole('button', { name: 'Сохранить' }).click();

    await expect(screen.getByText(/Изменено настроек: \d+/)).toBeVisible({ timeout: 15_000 });
    // Значение приходит с сервера, а не остаётся в поле: пометка «изменено»
    // считается сервером, и без перечитывания её бы не было.
    await expect(field).toHaveValue('200', { timeout: 15_000 });
    // Пометка приходит от сервера и означает «задано администратором», а не
    // «отличается от умолчания»: заданное значение переживёт смену умолчания.
    await expect(screen.getByText('задано').first()).toBeVisible();
  } finally {
    restore();
    await page.reload();
    await expect(screen.getByLabel(/Срок хранения записей/)).toHaveValue(before, {
      timeout: 15_000,
    });
  }
});

test('пользователи показаны с ролями последнего входа', async ({ page }) => {
  await openAdmin(page, 'users');
  const screen = page.getByRole('region', { name: 'Пользователи' });

  await expect(
    screen.getByRole('columnheader', { name: 'Роли при последнем входе' }),
  ).toBeVisible();
  await expect(screen.getByText(/speech_admin|Никто ещё не заходил/)).toBeVisible({
    timeout: 15_000,
  });
});

test('журнал открывается и фильтруется по событию', async ({ page }) => {
  await openAdmin(page, 'audit');
  const screen = page.getByRole('region', { name: 'Журнал' });

  await screen.getByLabel('Событие').selectOption('classifier.toggle');
  // Пусто это или нет — зависит от стенда; сломанным экран быть не должен ни в
  // одном случае.
  await expect(screen.getByText(/Показано \d+ из \d+|Событий с такими признаками нет/)).toBeVisible(
    { timeout: 15_000 },
  );
});

test('выключить узел классификатора → переобработать звонок → увидеть оба события в журнале', async ({
  page,
}) => {
  // Критерий готовности SP-506 на классификаторе SP-310. Узел — свой, под
  // выключенным корнем: модель эту ветку не видит, и тест убирает за собой
  // ровно то, что завёл.
  const probe = aProbeClassifierNode();
  const call = aCallReadyForReprocess();
  const callId = call.callId;

  try {
    await openAdmin(page, 'topics');
    const topics = page.getByRole('region', { name: 'Темы' });
    const row = topics.getByRole('row', { name: new RegExp(probe.label) });

    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: 'Отключить' }).click();
    // Состояние приходит с сервера, а не остаётся правкой на экране.
    await expect(row.getByRole('button', { name: 'Включить' })).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('отключён')).toBeVisible();

    await openAdmin(page, 'jobs');
    const jobs = page.getByRole('region', { name: 'Задания' });
    await jobs.getByLabel('Идентификатор звонка').fill(callId);
    await jobs.getByLabel('С этапа').selectOption('analyze');
    await jobs.getByRole('button', { name: 'Переобработать' }).click();
    await expect(jobs.getByText(/Поставлено заданий|Затронуто/)).toBeVisible({ timeout: 15_000 });

    await openAdmin(page, 'audit');
    const audit = page.getByRole('region', { name: 'Журнал' });

    await audit.getByLabel('Событие').selectOption('classifier.toggle');
    await expect(audit.getByRole('cell', { name: 'узел классификатора' }).first()).toBeVisible({
      timeout: 15_000,
    });

    await audit.getByLabel('Событие').selectOption('call.reprocess');
    await expect(audit.getByRole('cell', { name: 'звонок переобработан' }).first()).toBeVisible({
      timeout: 15_000,
    });
    // Событие указывает на тот самый звонок — иначе «след есть» ничего не
    // доказывает: он мог остаться от прошлого прогона.
    await expect(audit.getByRole('cell', { name: callId }).first()).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    probe.remove();
    call.restore();
  }
});
