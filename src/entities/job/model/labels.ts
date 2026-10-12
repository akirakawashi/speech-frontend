export const JOB_STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'plain'> = {
  queued: 'plain',
  running: 'warn',
  done: 'ok',
  failed: 'bad',
  dead: 'bad',
};

export const JOB_STATUS_LABEL: Record<string, string> = {
  queued: 'в очереди',
  running: 'выполняется',
  done: 'готово',
  failed: 'сбой',
  dead: 'исчерпано',
};

export const JOB_KIND_LABEL: Record<string, string> = {
  ingest: 'приём',
  transcribe: 'расшифровка',
  mask: 'обезличивание',
  analyze: 'анализ',
};

export const JOB_LANE_LABEL: Record<string, string> = {
  daily: 'суточная',
  backfill: 'история',
};

/** Этапы конвейера по порядку обработки звонка. */
export const JOB_KINDS = ['ingest', 'transcribe', 'mask', 'analyze'] as const;

/** Состояния задания в том порядке, в каком их показывает фильтр. */
export const JOB_STATUSES = ['queued', 'running', 'done', 'failed', 'dead'] as const;

/** Полосы очереди: суточная и разбор истории. */
export const JOB_LANES = ['daily', 'backfill'] as const;
