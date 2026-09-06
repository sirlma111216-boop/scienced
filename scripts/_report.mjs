/** 검증 스크립트 공통 출력. 실패가 하나라도 있으면 종료 코드 1. */
const failures = []
const passes = []

export function fail(check, message) {
  failures.push({ check, message })
}

export function pass(check, message) {
  passes.push({ check, message })
}

export function report(name) {
  for (const p of passes) console.log(`  ✓ ${p.check} — ${p.message}`)
  if (failures.length > 0) {
    console.error('')
    for (const f of failures) console.error(`  ✗ ${f.check} — ${f.message}`)
    console.error(`\n${name}: 실패 ${failures.length}건\n`)
    process.exit(1)
  }
  console.log(`\n${name}: 통과\n`)
}

/** 소스 트리를 훑을 때 쓰는 헬퍼. */
export async function walk(dir, exts) {
  const { readdir, stat } = await import('node:fs/promises')
  const { join, extname } = await import('node:path')
  const out = []
  async function rec(d) {
    let entries
    try {
      entries = await readdir(d)
    } catch {
      return
    }
    for (const e of entries) {
      if (e === 'node_modules' || e === 'dist' || e === '.git') continue
      const p = join(d, e)
      const s = await stat(p)
      if (s.isDirectory()) await rec(p)
      else if (!exts || exts.includes(extname(p))) out.push(p)
    }
  }
  await rec(dir)
  return out
}
