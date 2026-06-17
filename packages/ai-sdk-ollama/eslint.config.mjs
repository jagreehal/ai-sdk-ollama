import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  eslintPluginUnicorn.configs.recommended,
  {
    rules: {
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/no-null': 'off',
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/no-nested-ternary': 'off',
      'unicorn/no-immediate-mutation': 'off',
      // Stylistic rules introduced by the eslint-plugin-unicorn 66/67 upgrade.
      // We opt out of these rather than churn the codebase to match them.
      'unicorn/max-nested-calls': 'off',
      'unicorn/no-break-in-nested-loop': 'off',
      'unicorn/consistent-boolean-name': 'off',
      'unicorn/prefer-unicode-code-point-escapes': 'off',
      'unicorn/no-useless-else': 'off',
      'unicorn/prefer-uint8array-base64': 'off',
      'unicorn/no-declarations-before-early-exit': 'off',
      'unicorn/consistent-class-member-order': 'off',
      'unicorn/prefer-early-return': 'off',
      'unicorn/prefer-else-if': 'off',
      'unicorn/prefer-minimal-ternary': 'off',
      'unicorn/prefer-number-coercion': 'off',
      'unicorn/no-computed-property-existence-check': 'off',
      'unicorn/prefer-object-iterable-methods': 'off',
      'unicorn/prefer-object-define-properties': 'off',
      'unicorn/prefer-await': 'off',
      'unicorn/prefer-object-from-entries': 'off',
      'unicorn/prefer-ternary': 'off',
      'unicorn/class-reference-in-static-methods': 'off',
      'unicorn/prefer-smaller-scope': 'off',
    },
  },
);
