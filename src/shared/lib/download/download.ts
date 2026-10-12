/**
 * Скачивание файла, который отдаёт API: выгрузка дашборда, файл сверки оценок.
 *
 * Запросом, а не ссылкой `<a download>`: отказ сервера ссылка сохранила бы
 * файлом с телом ошибки внутри. Здесь отказ становится исключением со словами,
 * которые экран показывает человеку.
 */

/**
 * Достаёт имя файла из заголовка ответа.
 *
 * @param disposition Значение `Content-Disposition`; `null` — заголовка нет.
 * @param fallback Имя на случай, если заголовок имени не называет.
 * @returns Имя файла из заголовка или запасное.
 */
export function filenameFrom(disposition: string | null, fallback: string): string {
  const match = disposition ? /filename="?([^";]+)"?/.exec(disposition) : null;
  return match?.[1] ?? fallback;
}

/**
 * Скачать файл: кука сессии уходит с запросом, отказ — исключением.
 *
 * `refusal` — слова отказа по коду и причине сервера: у каждой выгрузки свои
 * («нечего сверять» бывает только у файла сверки).
 *
 * @param href Адрес файла на API.
 * @param fallbackName Имя файла на случай, если сервер его не назвал.
 * @param refusal Переводит код ответа и причину отказа в слова для человека.
 * @throws {Error} Сервис недоступен или ответил отказом; текст ошибки показывается пользователю.
 */
export async function downloadFile(
  href: string,
  fallbackName: string,
  refusal: (status: number, detail: string) => string,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(href, { credentials: 'same-origin' });
  } catch {
    throw new Error('Файл не собран: сервис недоступен.');
  }
  if (!response.ok) {
    let detail = '';
    try {
      detail = String(((await response.json()) as { detail?: unknown }).detail ?? '');
    } catch {
      detail = '';
    }
    throw new Error(refusal(response.status, detail));
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filenameFrom(response.headers.get('Content-Disposition'), fallbackName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
