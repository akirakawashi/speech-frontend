/**
 * Скачивание файла, который отдаёт API: выгрузка дашборда, файл сверки оценок.
 *
 * Запросом, а не ссылкой `<a download>`: отказ сервера ссылка сохранила бы
 * файлом с телом ошибки внутри. Здесь отказ становится исключением со словами,
 * которые экран показывает человеку.
 */

/** Имя файла из `Content-Disposition`; нет — запасное. */
export function filenameFrom(disposition: string | null, fallback: string): string {
  const match = disposition ? /filename="?([^";]+)"?/.exec(disposition) : null;
  return match?.[1] ?? fallback;
}

/**
 * Скачать файл: кука сессии уходит с запросом, отказ — исключением.
 *
 * `refusal` — слова отказа по коду и причине сервера: у каждой выгрузки свои
 * («нечего сверять» бывает только у файла сверки).
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
