/**
 * Разбор подсветки в цитате.
 *
 * Сервер помечает найденное управляющими символами STX/ETX, а не разметкой
 * HTML и не кавычками. Ни то ни другое не годилось: HTML пришлось бы вставлять
 * как есть — это путь, на котором рано или поздно окажется чужой текст; а
 * «ёлочки» встречаются в самой расшифровке («Кошелёк», «Ромашка»), и отличить
 * свою метку от чужой кавычки было бы нечем. Управляющие символы в выводе
 * распознавания появиться не могут.
 */

export const HIGHLIGHT_START = '\u0002';
export const HIGHLIGHT_STOP = '\u0003';

export type Piece = {
  text: string;
  marked: boolean;
  /**
   * Смещение куска в исходной цитате.
   *
   * Нужно как ключ списка в React. Индекс в массиве для этого не годится: он
   * говорит «третий по счёту», а не «вот этот текст», и при изменении цитаты
   * React переиспользует чужой узел. Смещение привязано к содержимому.
   */
  offset: number;
};

/**
 * Раскладывает цитату на куски: найденное и остальной текст.
 *
 * Возвращается список, а не строка с разметкой: подсветку рисует React, и промежуточного
 * представления, которое кто-то однажды вставит в `innerHTML`, здесь не появляется.
 *
 * Непарные метки не считаются подсветкой, а показываются как обычный текст:
 * оборванная разметка — повод показать цитату целиком, а не потерять её хвост.
 *
 * @param quote Цитата с метками подсветки от сервера.
 * @returns Куски по порядку; у каждого — текст, признак подсветки и смещение в цитате.
 */
export function splitHighlight(quote: string): Piece[] {
  const pieces: Piece[] = [];
  let rest = quote;
  let offset = 0;

  while (rest.length > 0) {
    const start = rest.indexOf(HIGHLIGHT_START);
    if (start === -1) break;
    const stop = rest.indexOf(HIGHLIGHT_STOP, start + 1);
    if (stop === -1) break;

    if (start > 0) {
      pieces.push({ text: rest.slice(0, start), marked: false, offset });
    }
    pieces.push({ text: rest.slice(start + 1, stop), marked: true, offset: offset + start });
    offset += stop + 1;
    rest = rest.slice(stop + 1);
  }

  if (rest.length > 0) pieces.push({ text: rest, marked: false, offset });
  return pieces.filter((piece) => piece.text.length > 0);
}
