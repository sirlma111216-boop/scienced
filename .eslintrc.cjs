/**
 * ESLint.
 *
 * tsc 가 잡지 못하는 것만 본다. 형식 취향은 다루지 않는다 —
 * 규칙이 많으면 아무도 읽지 않고 그냥 끄게 된다.
 *
 * 여기서 잡으려는 것:
 *  · React 훅 규칙 — 조건 안의 훅, 빠뜨린 의존성. 화면이 조용히 안 갱신되는 원인이다.
 *  · 쓰지 않는 변수 — 지우다 만 코드의 흔적.
 *  · floating promise — 저장이 실패해도 아무도 모르는 경로를 막는다.
 */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    // 앞에 _ 를 붙인 것은 일부러 안 쓰는 것이다
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // void 를 붙여 "결과를 안 기다린다"고 밝힌 것만 허용한다
    '@typescript-eslint/no-floating-promises': 'error',
    // ! 는 이 코드베이스에서 classId 처럼 상위에서 이미 가른 값에 쓴다
    '@typescript-eslint/no-non-null-assertion': 'off',
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    'scripts/**', // 검증 스크립트는 .mjs 라 tsconfig 프로젝트 밖에 있다
    '*.cjs',
    '*.config.ts',
  ],
}
