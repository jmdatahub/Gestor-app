import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Don't lint generated output, deps, or PWA service worker.
  { ignores: ['dist', 'node_modules', 'public/sw.js', 'public/workbox-*.js', 'dev-dist'] },

  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // The codebase uses `any` in several places (recharts custom tooltips, supabase generic responses).
      // Don't block on it — flag as warning so refactors get a nudge.
      '@typescript-eslint/no-explicit-any': 'warn',
      // The project disables noUnusedLocals/Parameters in tsconfig deliberately; keep eslint aligned.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // API folder runs in Node, not browser.
  {
    files: ['api/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Tests: jest-dom matchers + vitest globals.
  {
    files: ['src/test/**/*.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, vi: 'readonly' },
    },
  },
)
