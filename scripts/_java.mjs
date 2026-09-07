/**
 * Firestore 에뮬레이터는 Java 위에서 돈다.
 *
 * 설치했는데도 PATH 에 안 잡히는 일이 흔하다(설치 후 연 적 없는 셸, 사용자 폴더 설치 등).
 * 그럴 때 "Java 를 설치하세요"라고만 하면 이미 설치한 사람이 막힌다.
 * 그래서 흔한 설치 위치를 직접 뒤져 PATH 에 얹어 준다.
 *
 * 경로는 문자열을 이어 붙이지 않고 join 으로 만든다.
 * 템플릿 문자열 안의 `\P` 는 유효한 이스케이프가 아니라 백슬래시가 조용히 사라진다.
 */
import { existsSync, readdirSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const LOCAL = process.env.LOCALAPPDATA
const PF = process.env.ProgramFiles
const PF86 = process.env['ProgramFiles(x86)']

/** JDK 가 들어앉는 흔한 자리들. 하위 폴더까지 한 겹 더 본다. */
const CANDIDATE_ROOTS = [
  process.env.JAVA_HOME && join(process.env.JAVA_HOME, 'bin'),
  LOCAL && join(LOCAL, 'Programs', 'Eclipse Adoptium'),
  PF && join(PF, 'Eclipse Adoptium'),
  PF && join(PF, 'Java'),
  PF && join(PF, 'Microsoft', 'jdk'),
  PF && join(PF, 'Amazon Corretto'),
  PF86 && join(PF86, 'Java'),
  '/usr/lib/jvm',
  '/Library/Java/JavaVirtualMachines',
  '/opt/homebrew/opt/openjdk/bin',
].filter(Boolean)

function javaWorksIn(binDir) {
  const exe = join(binDir, process.platform === 'win32' ? 'java.exe' : 'java')
  if (!existsSync(exe)) return false
  return spawnSync(exe, ['-version']).status === 0
}

/**
 * java 를 찾아 PATH 에 얹는다.
 * @returns 찾은 bin 경로, 이미 PATH 에 있으면 'PATH', 못 찾으면 null
 */
export function ensureJavaOnPath() {
  if (spawnSync('java', ['-version'], { shell: true }).status === 0) return 'PATH'

  for (const root of CANDIDATE_ROOTS) {
    if (!existsSync(root)) continue

    // root 자체가 bin 인 경우
    if (javaWorksIn(root)) {
      process.env.PATH = root + delimiter + process.env.PATH
      return root
    }

    // root 아래 버전 폴더들
    let entries = []
    try {
      entries = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())
    } catch {
      continue
    }
    for (const e of entries) {
      const candidates = [
        join(root, e.name, 'bin'),
        join(root, e.name, 'Contents', 'Home', 'bin'), // macOS
      ]
      for (const bin of candidates) {
        if (javaWorksIn(bin)) {
          process.env.PATH = bin + delimiter + process.env.PATH
          return bin
        }
      }
    }
  }
  return null
}
