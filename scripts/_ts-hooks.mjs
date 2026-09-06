/**
 * 검증 스크립트가 소스의 .ts 를 그대로 import 하기 위한 해석 훅.
 *
 * Vite/TypeScript 는 `./lesson01` 처럼 확장자 없는 import 를 해석하지만
 * Node 의 ESM 해석기는 그러지 않는다. 여기서 .ts / .tsx / /index.ts 를 차례로 시도한다.
 * 타입 제거 자체는 Node 24 가 기본으로 해 준다.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      for (const suffix of ['.ts', '.tsx', '/index.ts']) {
        try {
          return await nextResolve(specifier + suffix, context)
        } catch {
          /* 다음 후보 */
        }
      }
    }
    throw err
  }
}
