// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // The domain package must stay deterministic. Reading the wall clock
      // inside domain logic is the most common source of evaluation drift, so
      // time always arrives through an explicit TemporalContext.
      //
      // This targets CLOCK READS specifically. Date.parse on a timestamp that
      // was passed in is not a clock read and stays allowed.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Date.now() reads the wall clock. Pass the instant in through TemporalContext instead.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'new Date() reads the wall clock. Pass the instant in through TemporalContext instead.',
        },
      ],
    },
  },
  {
    // Fixtures, the CLI, scripts and tests legitimately construct timestamps.
    files: ['src/fixtures/**', 'src/cli/**', 'scripts/**', 'tests/**'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
)
