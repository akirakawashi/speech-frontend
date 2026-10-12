import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { resetConfigCache } from '@/shared/config';

afterEach(() => {
  // Конфигурация запоминается на модуле, а модуль между случаями не
  // перезагружается: без сброса второй тест видит ответ первого.
  resetConfigCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
