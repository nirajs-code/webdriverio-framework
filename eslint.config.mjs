// @ts-check
import { fileURLToPath } from 'url'
import path from 'path'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import prettierRecommended from 'eslint-plugin-prettier/recommended'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default tseslint.config(
    // ─── Global ignores ──────────────────────────────────────────────────────────
    {
        ignores: ['dist/**', '.tmp/**', 'allure-results/**', 'node_modules/**'],
    },

    // ─── TypeScript source files ──────────────────────────────────────────────
    {
        files: ['**/*.ts'],

        extends: [...tseslint.configs.recommendedTypeChecked],

        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: __dirname,
            },
        },

        plugins: {
            import: importPlugin,
        },

        settings: {
            'import/resolver': {
                typescript: {
                    alwaysTryTypes: true,
                    project: path.resolve(__dirname, 'tsconfig.json'),
                },
            },
            'import/parsers': {
                '@typescript-eslint/parser': ['.ts'],
            },
        },

        rules: {
            // ── TypeScript ────────────────────────────────────────────────────
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/no-misused-promises': [
                'error',
                {
                    // Allow async functions as non-Promise callbacks (common in WDIO hooks)
                    checksVoidReturn: { arguments: false, attributes: false },
                },
            ],
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    prefer: 'type-imports',
                    fixStyle: 'inline-type-imports',
                },
            ],
            // require() is used intentionally in conf files for dynamic protocol/glob
            '@typescript-eslint/no-require-imports': 'warn',

            // ── Import paths ──────────────────────────────────────────────────
            // Validates that every import resolves to an actual file (uses the
            // TypeScript resolver so path aliases and .ts sources are found).
            'import/no-unresolved': ['error', { commonjs: true }],
            'import/no-duplicates': 'error',

            // Enforce no file extension on TypeScript imports — moduleResolution:node
            // does not support explicit .ts extensions; tsc rejects them.
            // Paths to JSON files must keep their .json extension.
            'import/extensions': ['error', 'never', { json: 'always' }],

            // Import grouping: builtins/externals → internal/relative, separated
            // by a blank line. Alphabetised within each group.
            'import/order': [
                'warn',
                {
                    groups: [
                        ['builtin', 'external'],
                        ['internal', 'parent', 'sibling', 'index'],
                    ],
                    'newlines-between': 'always',
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],

            // ── General ───────────────────────────────────────────────────────
            eqeqeq: ['error', 'always'],
            'no-debugger': 'error',
            'no-console': 'off', // tests legitimately use console
        },
    },

    // ─── Relax require() in conf files (dynamic protocol / glob requires) ─────
    {
        files: ['conf/**/*.ts'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    },

    // ─── Prettier (must be last — overrides conflicting formatting rules) ─────
    prettierRecommended
)
