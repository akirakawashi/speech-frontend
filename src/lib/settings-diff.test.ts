import { describe, expect, it } from 'vitest';
import { changedValues } from '@/lib/settings-diff';

describe('changedValues', () => {
  it('одинаковые значения не считаются изменением', () => {
    // Ровно этого не хватало: форма отправляла всё подряд, и сервер помечал
    // изменёнными все восемь настроек после правки одной.
    const values = { retention_days: 180, daily_ingest_at: '00:05' };

    expect(changedValues({ ...values }, values)).toEqual({});
  });

  it('отдаёт только тронутые ключи', () => {
    const server = { retention_days: 180, transcribe_concurrency: 2 };
    const draft = { retention_days: 200, transcribe_concurrency: 2 };

    expect(changedValues(draft, server)).toEqual({ retention_days: 200 });
  });

  it('вложенный объект сравнивается по содержимому, а не по ссылке', () => {
    // `max_attempts` пересобирается при правке любого этапа, и сравнение по
    // ссылке объявляло бы его изменённым всегда.
    const server = { max_attempts: { ingest: 6, transcribe: 3, mask: 5, analyze: 3 } };
    const same = { max_attempts: { ingest: 6, transcribe: 3, mask: 5, analyze: 3 } };
    const other = { max_attempts: { ingest: 6, transcribe: 4, mask: 5, analyze: 3 } };

    expect(changedValues(same, server)).toEqual({});
    expect(changedValues(other, server)).toEqual({ max_attempts: other.max_attempts });
  });

  it('ноль и пустая строка — значения, а не отсутствие', () => {
    // Канал оператора бывает левым, и ноль здесь надо уметь сохранить.
    const server = { stereo_operator_channel: 1 };

    expect(changedValues({ stereo_operator_channel: 0 }, server)).toEqual({
      stereo_operator_channel: 0,
    });
  });

  it('ключ, которого сервер не знает, считается изменением', () => {
    // Решает сервер: он ответит `unknown_settings`, и человек увидит, какой
    // ключ лишний. Промолчав здесь, мы бы съели это сообщение.
    expect(changedValues({ made_up: 1 }, {})).toEqual({ made_up: 1 });
  });
});
