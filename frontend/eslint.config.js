import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // Grid lookups are bounds-checked by the game logic; `noUncheckedIndexedAccess` needs `!`.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
