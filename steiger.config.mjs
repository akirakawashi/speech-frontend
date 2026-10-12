import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

/** Проверка раскладки `src/` на соответствие Feature-Sliced Design. */
export default defineConfig([...fsd.configs.recommended]);
