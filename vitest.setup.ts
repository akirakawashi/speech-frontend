import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { resetConfigCache } from '@/shared/config';

afterEach(() => {
  // Конфигурация запоминается на модуле, а модуль между случаями не
  // перезагружается: без сброса второй тест видит ответ первого.
  resetConfigCache();
  // Наборы в окружении `node` (проброс `/api`) хранилища браузера не имеют.
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
