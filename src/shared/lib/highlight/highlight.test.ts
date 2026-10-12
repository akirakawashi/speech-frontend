import { describe, expect, it } from 'vitest';
import { HIGHLIGHT_START, HIGHLIGHT_STOP, splitHighlight, stripHighlight } from './highlight';

const S = HIGHLIGHT_START;
const E = HIGHLIGHT_STOP;

describe('разбор подсветки', () => {
  it('делит цитату на обычный текст и найденное', () => {
    const pieces = splitHighlight(`не работает ${S}интернет${E} уже второй день`);

    // Смещения проверяются отдельно: здесь важно, что и как разделено.
    expect(pieces.map(({ text, marked }) => ({ text, marked }))).toEqual([
      { text: 'не работает ', marked: false },
      { text: 'интернет', marked: true },
      { text: ' уже второй день', marked: false },
    ]);
  });

  it('у каждого куска своё смещение — это ключ списка в React', () => {
    // Индекс в массиве ключом не годится: он говорит «третий по счёту», а не
    // «вот этот текст», и React переиспользовал бы чужой узел при правке цитаты.
    const offsets = splitHighlight(`${S}интернет${E} и ещё раз ${S}интернет${E} в конце`).map(
      (piece) => piece.offset,
    );

    expect(new Set(offsets).size).toBe(offsets.length);
    expect([...offsets]).toEqual([...offsets].sort((a, b) => a - b));
  });

  it('кавычки-ёлочки в расшифровке подсветкой не считаются', () => {
    // Ради этого сервер и помечает найденное управляющими символами: «Кошелёк»
    // в тексте иначе был бы неотличим от совпадения.
    const pieces = splitHighlight(`подключите «Кошелёк», ${S}интернет${E} не нужен`);

    expect(pieces.filter((piece) => piece.marked).map((piece) => piece.text)).toEqual(['интернет']);
    expect(pieces.map((piece) => piece.text).join('')).toContain('«Кошелёк»');
  });

  it('несколько совпадений в одной цитате', () => {
    const pieces = splitHighlight(`${S}интернет${E} и ещё раз ${S}интернет${E}`);

    expect(pieces.filter((piece) => piece.marked)).toHaveLength(2);
  });

  it('цитата без совпадений остаётся одним куском', () => {
    expect(splitHighlight('обычный текст')).toEqual([
      { text: 'обычный текст', marked: false, offset: 0 },
    ]);
  });

  it('пустая цитата не даёт пустых кусков', () => {
    expect(splitHighlight('')).toEqual([]);
  });

  it('оборванная метка показывается как текст, а не съедает хвост', () => {
    // Потерять конец цитаты хуже, чем не подсветить: пользователь читает её,
    // чтобы понять, о чём разговор.
    const pieces = splitHighlight(`начало ${S}без конца`);

    expect(pieces.map((piece) => piece.text).join('')).toBe(`начало ${S}без конца`);
    expect(pieces.every((piece) => !piece.marked)).toBe(true);
  });

  it('метки не попадают в текст кусков', () => {
    for (const piece of splitHighlight(`а ${S}б${E} в`)) {
      expect(piece.text).not.toContain(S);
      expect(piece.text).not.toContain(E);
    }
  });
});

describe('очистка от меток', () => {
  it('убирает и открывающие, и закрывающие', () => {
    expect(stripHighlight(`${S}интернет${E} не работает`)).toBe('интернет не работает');
  });

  it('чужие кавычки не трогает', () => {
    expect(stripHighlight('подключите «Кошелёк»')).toBe('подключите «Кошелёк»');
  });
});
