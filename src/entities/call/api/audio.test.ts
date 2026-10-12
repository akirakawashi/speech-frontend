import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, resetConfigCache } from '@/shared/config';
import { audioUrl } from './audio';

beforeEach(() => {
  resetConfigCache({ ...DEFAULT_CONFIG, authMode: 'open' });
});

describe('ссылка на аудио', () => {
  it('перемотка идёт к сервису напрямую, скачивание — отдельным признаком', () => {
    expect(audioUrl('c1')).toBe('/api/v1/calls/c1/audio');
    expect(audioUrl('c1', true)).toBe('/api/v1/calls/c1/audio?download=1');
  });
});
