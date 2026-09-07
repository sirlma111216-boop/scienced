/**
 * 검증 스크립트가 소스의 .ts 를 그대로 import 하기 위한 해석 훅.
 *
 * Vite/TypeScript 는 `./lesson01` 처럼 확장자 없는 import 를 해석하지만
 * Node 의 ESM 해석기는 그러지 않는다. 여기서 .ts / .tsx / /index.ts 를 차례로 시도한다.
 * 타입 제거 자체는 Node 24 가 기본으로 해 준다.
 *
 * `@/…` 와 `@shared/…` 별칭도 여기서 푼다 (tsconfig 의 paths 와 같은 규칙).
 * 이것이 없으면 앱 코드를 그대로 불러 검사할 수 없고,
 * 검사용으로 다시 쓴 코드를 검사하게 된다 — 그것은 아무것도 보장하지 않는다.
 */
import { pathToFileURL } from 'node:url'
import { resolve as resolvePath } from 'node:path'

const ROOT = resolvePath(import.meta.dirname, '..')

const ALIASES = [
  ['@/', 'src/'],
  ['@shared/', 'shared/'],
]

function expandAlias(specifier) {
  for (const [prefix, target] of ALIASES) {
    if (specifier.startsWith(prefix)) {
      return pathToFileURL(resolvePath(ROOT, target + specifier.slice(prefix.length))).href
    }
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  const aliased = expandAlias(specifier)
  const target = aliased ?? specifier

  try {
    return await nextResolve(target, context)
  } catch (err) {
    if (aliased || target.startsWith('.') || target.startsWith('/')) {
      for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
        try {
          return await nextResolve(target + suffix, context)
        } catch {
          /* 다음 후보 */
        }
      }
    }
    throw err
  }
}
