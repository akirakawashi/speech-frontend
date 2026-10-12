/**
 * Состояния стенда, которых нельзя добиться через интерфейс.
 *
 * Почти всё в наборе проверяется тем, что видит пользователь, и это правильно.
 * Но одно состояние иначе не получить: запись, удалённую по сроку хранения.
 * Кнопки «удалить запись» в интерфейсе нет и не будет — удаление делает
 * фоновая уборка по расписанию, и ждать её в тесте нельзя.
 *
 * Раньше это состояние жило в сидовом наборе из `scratchpad`. Так тест зависел
 * от того, что кто-то заранее засеял базу нужным образом, — и в день, когда на
 * стенде оказалась настоящая выгрузка, тест покраснел, не найдя ни одного
 * дефекта. Теперь предусловие создаёт сам тест и сам же его снимает.
 *
 * Запросы идут через `docker exec`, потому что порт Postgres на стенде наружу
 * не опубликован — и публиковать его ради тестов не нужно.
 */

import { execFileSync } from 'node:child_process';

const CONTAINER = process.env.SPEECH_E2E_PG_CONTAINER ?? 'local-db_postgres-1';
const WORKER = process.env.SPEECH_E2E_WORKER_CONTAINER ?? 'speech-worker-run1';
const MINIO = process.env.SPEECH_E2E_MINIO_CONTAINER ?? 'speech-minio-dev';
const MINIO_BUCKET = process.env.SPEECH_E2E_MINIO_BUCKET ?? 'speech-recordings';
const MINIO_KEY = process.env.SPEECH_E2E_MINIO_KEY ?? 'speechroot';
const MINIO_SECRET = process.env.SPEECH_E2E_MINIO_SECRET ?? 'speechroot-localtest';
const DATABASE = process.env.SPEECH_E2E_PG_DATABASE ?? 'speech';
const USER = process.env.SPEECH_E2E_PG_USER ?? 'postgres';

/**
 * Выполняет запрос в базе стенда через `docker exec`.
 *
 * @param query Текст SQL.
 * @returns Вывод `psql` без заголовков и выравнивания.
 */
function sql(query: string): string {
  return execFileSync(
    'docker',
    ['exec', CONTAINER, 'psql', '-U', USER, '-d', DATABASE, '-tAc', query],
    { encoding: 'utf8', timeout: 30_000 },
  ).trim();
}

/**
 * Значение, подставляемое в текст SQL, обязано иметь безопасную форму.
 *
 * Сюда попадают только константы тестов и идентификаторы, прочитанные из базы
 * стенда, — чужого ввода нет. Но гарантировала это одна добросовестность
 * вызывающего: кавычка в названии узла или в ключе настройки молча превратила бы
 * запрос в другой. Проверка делает безопасность свойством функции, а не
 * соглашения, и отказывает громко, а не выполняет что-то иное.
 */
const SAFE_TOKEN = /^[A-Za-z0-9_.:/-]+$/;

/**
 * Проверяет, что значение можно подставить в текст SQL.
 *
 * @param value Подставляемое значение.
 * @param label Что это за значение — для текста ошибки.
 * @returns То же значение.
 * @throws {Error} В значении есть символы, меняющие смысл запроса.
 */
function safe(value: string, label: string): string {
  if (!SAFE_TOKEN.test(value)) {
    throw new Error(`${label}: недопустимая форма значения для SQL: ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Вызывает `mc` внутри контейнера MinIO — без оболочки и без секрета в аргументах.
 *
 * Раньше реквизиты уходили строкой в `sh -c "mc alias set …"`: значения из
 * окружения попадали в текст оболочки (любой спецсимвол в них становился
 * командой) и в список процессов. Теперь `mc` получает массив аргументов, а
 * адрес с реквизитами — переменной `MC_HOST_e2e` окружения дочернего процесса:
 * `docker exec -e MC_HOST_e2e` без значения берёт его оттуда, и в аргументах
 * `docker` секрета нет.
 *
 * @param args Аргументы команды `mc`.
 * @param timeout Сколько миллисекунд ждать завершения.
 */
function mc(args: string[], timeout: number): void {
  const auth = `${encodeURIComponent(MINIO_KEY)}:${encodeURIComponent(MINIO_SECRET)}`;
  execFileSync('docker', ['exec', '-e', 'MC_HOST_e2e', MINIO, 'mc', ...args], {
    env: { ...process.env, MC_HOST_e2e: `http://${auth}@127.0.0.1:9000` },
    stdio: ['ignore', 'ignore', 'pipe'],
    timeout,
  });
}

/**
 * Помечает одну запись удалённой по сроку хранения.
 *
 * Возвращается именно откат, а не «ещё один запрос на потом»: тест обязан
 * оставить стенд таким, каким взял. Звонок выбирается по наибольшей дате —
 * первая страница выдачи отсортирована по ней, и искать его не придётся.
 *
 * @returns Идентификатор сессии звонка и функция, которая возвращает записи прежнее состояние.
 * @throws {Error} На стенде нет ни одного звонка с сохранённой записью.
 */
export function markOneRecordingDeleted(): { sessionId: string; restore: () => void } {
  const row = sql(
    "SELECT id || ' ' || session_id FROM speech_calls " +
      "WHERE audio_status = 'stored' ORDER BY started_at DESC LIMIT 1",
  );
  if (!row) {
    throw new Error(
      'на стенде нет ни одного звонка с сохранённой записью — ' +
        'проверять объяснение про срок хранения не на чем',
    );
  }
  const [rawId, sessionId] = row.split(' ');
  const id = safe(rawId ?? '', 'идентификатор звонка');

  sql(`UPDATE speech_calls SET audio_status = 'deleted_by_retention' WHERE id = '${id}'`);
  return {
    sessionId: sessionId ?? '',
    restore: () => {
      sql(`UPDATE speech_calls SET audio_status = 'stored' WHERE id = '${id}'`);
    },
  };
}

/**
 * Находит звонок, в котором маскировка действительно что-то нашла.
 *
 * Раньше тест маскировки открывал звонок поиском по слову из сидового набора и
 * ждал в нём заранее известный телефон. На настоящей выгрузке не совпало ни то
 * ни другое — а проверяется здесь поведение интерфейса, а не то, чей номер
 * назвали в разговоре.
 *
 * @returns Идентификатор звонка.
 * @throws {Error} На стенде нет ни одной обезличенной реплики.
 */
export function aCallWithMasking(): string {
  const id = sql(
    'SELECT s.call_id FROM speech_transcript_segments s ' +
      "WHERE s.pii_spans::text NOT IN ('[]', 'null') LIMIT 1",
  );
  if (!id) {
    throw new Error('на стенде нет ни одной обезличенной реплики — проверять раскрытие не на чем');
  }
  return id;
}

/**
 * Помечает одну запись отсутствующей у источника.
 *
 * Отдельно от «удалена по сроку»: интерфейс обязан различать эти два случая, и
 * тест, проверяющий один текст, не должен опираться на другой.
 *
 * @returns Идентификатор звонка и функция, которая возвращает записи прежнее состояние.
 * @throws {Error} На стенде нет ни одного звонка с записью.
 */
export function markOneRecordingMissing(): { callId: string; restore: () => void } {
  const found = sql(
    "SELECT id FROM speech_calls WHERE audio_status = 'stored' " +
      'ORDER BY started_at ASC LIMIT 1',
  );
  if (!found) {
    throw new Error('на стенде нет ни одного звонка с записью');
  }
  const id = safe(found, 'идентификатор звонка');
  sql(`UPDATE speech_calls SET audio_status = 'unavailable_at_source' WHERE id = '${id}'`);
  return {
    callId: id,
    restore: () => {
      sql(`UPDATE speech_calls SET audio_status = 'stored' WHERE id = '${id}'`);
    },
  };
}

/**
 * Заводит на стенде запись длиннее получаса.
 *
 * Это единственная фикстура набора, которая создаёт файл, а не помечает
 * существующий: критерий готовности SP-505 назван в минутах — перемотка на
 * записи длиннее получаса, — и на четырнадцатиминутном разговоре он не
 * проверяется. В настоящей выгрузке таких длинных звонков не оказалось.
 *
 * Файл — тишина: ничьих голосов в нём нет и появиться не может. Проверяется на
 * нём не расшифровка, а то, что браузер берёт диапазон вместо того, чтобы
 * тянуть файл целиком, и что позиция после перемотки та, которую попросили.
 *
 * Раньше эта запись жила в `scratchpad/seed_audio.py` — то есть держалась на
 * том, что кто-то не забыл её положить. Теперь её кладёт и убирает сам тест.
 *
 * @param minutes Длительность записи в минутах.
 * @returns Идентификатор звонка и функция, которая убирает запись и её строку.
 * @throws {Error} Длительность не целое число минут или фикстура не получила идентификатор звонка.
 */
export function ensureLongRecording(minutes = 35): { callId: string; restore: () => void } {
  if (!Number.isInteger(minutes) || minutes <= 0) {
    throw new Error(`длительность записи должна быть целым числом минут: ${minutes}`);
  }
  const seconds = minutes * 60;
  const sessionId = `node_9_e2e_long_${seconds}`;
  const bucket = safe(MINIO_BUCKET, 'бакет MinIO');
  const key = `calls/2026/09/09/${sessionId}.mp3`;
  const local = `/tmp/${sessionId}.mp3`;

  // ffmpeg живёт в образе воркера — он же снимает длительность при приёме.
  execFileSync(
    'docker',
    [
      'exec',
      WORKER,
      'ffmpeg',
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=16000:cl=mono',
      '-t',
      String(seconds),
      '-b:a',
      '32k',
      local,
    ],
    { timeout: 300_000 },
  );
  execFileSync('docker', ['cp', `${WORKER}:${local}`, local], { timeout: 120_000 });
  execFileSync('docker', ['cp', local, `${MINIO}:${local}`], { timeout: 120_000 });
  mc(['cp', local, `e2e/${bucket}/${key}`], 300_000);

  // `INSERT ... RETURNING` через psql печатает не только строку, но и тег
  // команды: `INSERT 0 1` второй строкой. Взяв вывод целиком, тест получал
  // идентификатор с хвостом, шёл по нему на несуществующий адрес и падал — а
  // откат по такому же битому идентификатору падал следом, оставляя строку в
  // базе. Обёртка в CTE возвращает ровно одно поле.
  const callId = sql(
    'WITH ins AS (' +
      'INSERT INTO speech_calls (id, session_id, direction, started_at, ended_at, duration_s, ' +
      'audio_status, audio_object_key, processing_status, analysis_status, source_snapshot, ' +
      'first_seen_at, created_at, updated_at) VALUES (gen_random_uuid(), ' +
      `'${sessionId}', 'inbound', now() - interval '1 hour', now(), ${seconds}, ` +
      `'stored', '${key}', 'done', 'skipped', '{}', now(), now(), now()) RETURNING id) ` +
      'SELECT id FROM ins',
  );
  if (!/^[0-9a-f-]{36}$/.test(callId)) {
    throw new Error(`фикстура не получила идентификатор звонка: ${JSON.stringify(callId)}`);
  }

  return {
    callId,
    restore: () => {
      // Строка удаляется по ключу сессии, а не по идентификатору: если тест
      // упал между вставкой и получением идентификатора, убрать её больше
      // нечем, а остаться она не должна.
      sql(`DELETE FROM speech_calls WHERE session_id = '${sessionId}'`);
      mc(['rm', `e2e/${bucket}/${key}`], 120_000);
    },
  };
}

/** Проверочная ветка классификатора: корень и узел под ним. Ключ узла — его название. */
const PROBE_ROOT = 'e2e-probe-root';
const PROBE_NODE = 'e2e-probe-node';

/**
 * Заводит на стенде проверочный узел классификатора (SP-310).
 *
 * Узел стоит под **выключенным** корнем: выключенная ветка не попадает в дерево
 * для модели, поэтому переключение узла под ней не меняет того, что видит анализ
 * на стенде. Интерфейс узлы не удаляет — и правильно: узлом уже могут быть
 * размечены звонки, — но проверочный узел к звонкам отношения не имеет.
 *
 * Откат вызывается и **до** сценария: прогон, упавший в середине прошлого раза,
 * иначе оставил бы ветку, и вставка упала бы на повторном ключе.
 *
 * @returns Название узла и функция, которая убирает проверочную ветку.
 */
export function aProbeClassifierNode(): { label: string; remove: () => void } {
  const root = safe(PROBE_ROOT, 'корень проверочной ветки');
  const label = safe(PROBE_NODE, 'проверочный узел');
  /**
   * Убирает проверочную ветку классификатора и её следы в журнале.
   */
  const remove = () => {
    sql(
      "DELETE FROM speech_audit_events WHERE event_type = 'classifier.toggle' " +
        `AND payload->>'label' = '${label}'`,
    );
    sql(`DELETE FROM speech_classifier_nodes WHERE level = 2 AND key = '${label}'`);
    sql(`DELETE FROM speech_classifier_nodes WHERE level = 1 AND key = '${root}'`);
  };
  remove();
  const columns =
    'id, parent_id, level, label, key, source, sort_order, is_active, ' +
    'first_seen_at, created_at, updated_at';
  sql(
    `INSERT INTO speech_classifier_nodes (${columns}) VALUES (gen_random_uuid(), NULL, 1, ` +
      `'${root}', '${root}', 'ncc', 100000, false, now(), now(), now())`,
  );
  sql(
    `INSERT INTO speech_classifier_nodes (${columns}) SELECT gen_random_uuid(), id, 2, ` +
      `'${label}', '${label}', 'ncc', 100000, true, now(), now(), now() ` +
      `FROM speech_classifier_nodes WHERE level = 1 AND key = '${root}'`,
  );
  return { label, remove };
}

/**
 * Готовит звонок, который сервис согласится переобработать.
 *
 * Переобработка отказывает звонку с незавершёнными заданиями — и правильно
 * отказывает: она бы их продублировала. На стенде, где целый этап заблокирован
 * (приложения Dify ещё нет), незавершённое задание есть **у каждого** звонка, и
 * проверять сценарий приёмки не на чем.
 *
 * Поэтому предусловие создаётся здесь: незавершённые задания звонка снимаются
 * целиком и возвращаются обратно ровно теми же строками — снимок берётся
 * `row_to_json`, возврат идёт `json_populate_recordset`. Заодно убирается всё,
 * что успела наделать сама переобработка: стенд обязан остаться таким, каким
 * его взяли.
 *
 * @returns Идентификатор звонка и функция, которая возвращает его задания на место.
 */
export function aCallReadyForReprocess(): { callId: string; restore: () => void } {
  const callId = safe(aCallWithMasking(), 'идентификатор звонка');
  const snapshot = sql(
    "SELECT coalesce(json_agg(row_to_json(j))::text, '[]') FROM speech_jobs j " +
      `WHERE j.call_id = '${callId}' AND j.status IN ('queued', 'running')`,
  );
  sql(`DELETE FROM speech_jobs WHERE call_id = '${callId}' AND status IN ('queued', 'running')`);

  return {
    callId,
    restore: () => {
      sql(
        `DELETE FROM speech_jobs WHERE call_id = '${callId}' AND status IN ('queued', 'running')`,
      );
      sql(
        'INSERT INTO speech_jobs SELECT * FROM json_populate_recordset(null::speech_jobs, ' +
          `'${snapshot.replace(/'/g, "''")}')`,
      );
    },
  };
}

/**
 * Запоминает одну настройку стенда.
 *
 * Вернуть значение через интерфейс недостаточно: «задано» на этом экране
 * означает «в базе есть строка», и настройка, которой никто не задавал, после
 * прогона осталась бы закреплённой. Разница не косметическая — закреплённое
 * значение переживёт смену умолчания, а незакреплённое поедет вслед за ним.
 *
 * @param key Ключ настройки.
 * @returns Функция, которая возвращает настройку ровно в прежнее состояние.
 */
export function snapshotSetting(key: string): () => void {
  const setting = safe(key, 'ключ настройки');
  const stored = sql(`SELECT value::text FROM speech_settings WHERE key = '${setting}'`);
  return () => {
    sql(`DELETE FROM speech_settings WHERE key = '${setting}'`);
    if (stored) {
      sql(
        `INSERT INTO speech_settings (key, value) VALUES ('${setting}', ` +
          `'${stored.replace(/'/g, "''")}'::jsonb)`,
      );
    }
  };
}
