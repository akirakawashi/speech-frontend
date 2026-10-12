import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import { errorText } from './error-text';

describe('errorText', () => {
  it('переводит код отказа в то, что читателю делать дальше', () => {
    const error = new ApiError(409, 'call_has_queued_or_running_jobs', 'conflict');

    // Проверяется не совпадение строки, а то, что кода в ней не осталось: код
    // в баннере — это строка, которую читатель не обязан понимать, а работает
    // он в колл-центре.
    expect(errorText(error)).not.toContain('call_has_queued_or_running_jobs');
    expect(errorText(error)).toContain('незавершённые задания');
  });

  it('объясняет отказ синхронизации, а не показывает его код', () => {
    const error = new ApiError(503, 'ncc_not_configured', 'unavailable');

    // Чинить надо развёртывание, и повторное нажатие кнопки этого не сделает —
    // именно это читателю и надо сказать.
    expect(errorText(error)).toContain('развёртывании');
    expect(errorText(error)).not.toContain('ncc_not_configured');
  });

  it('отказ самого NCC читается, даже если его код нам незнаком', () => {
    // Перевести каждый код NCC нельзя, но показать код без единого слова —
    // значит показать код.
    const text = errorText(new ApiError(502, 'ncc_employees_http_500', 'unavailable'));

    expect(text).toContain('NCC');
    expect(text).toContain('не изменены');
  });

  it('оставляет неизвестный код как есть, а не выдумывает ему текст', () => {
    const error = new ApiError(409, 'some_new_refusal', 'conflict');

    // Выдуманное объяснение хуже непонятного кода: по коду можно спросить, по
    // выдумке — нельзя.
    expect(errorText(error)).toBe('some_new_refusal');
  });

  it('разбирает код с уточнением после двоеточия', () => {
    const error = new ApiError(422, 'unknown_settings: retention_dayz', 'invalid');

    const text = errorText(error);
    expect(text).toContain('retention_dayz');
    expect(text).not.toMatch(/^unknown_settings/);
  });

  it('различает отказ в правах и недоступность сервиса', () => {
    // Одинаковое «что-то пошло не так» на оба случая превращает разбор жалобы
    // в разговор вслепую: в одном случае нужна группа, в другом — дежурный.
    const forbidden = errorText(new ApiError(403, '', 'forbidden'));
    const unavailable = errorText(new ApiError(503, '', 'unavailable'));

    expect(forbidden).toContain('speech_admin');
    expect(unavailable).toContain('недоступен');
    expect(forbidden).not.toBe(unavailable);
  });

  it('говорит, что данные не изменены, когда запрос не дошёл', () => {
    // Иначе после отказа сети человек не знает, повторять ли действие.
    expect(errorText(new ApiError(0, 'fetch failed', 'network'))).toContain('не изменены');
  });
});
