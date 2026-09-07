/**
 * npm run emulators
 *
 * Firestore 에뮬레이터를 띄운다. Java 가 PATH 에 없어도 찾아서 얹는다.
 */
import { spawn } from 'node:child_process'
import { ensureJavaOnPath } from './_java.mjs'

const found = ensureJavaOnPath()
if (!found) {
  console.error(
    '\nJava 를 찾지 못했습니다. Firestore 에뮬레이터는 Java 위에서 돕니다.\n' +
      '  JDK 21 이상 설치 — https://adoptium.net (Temurin)\n' +
      '  이미 설치했다면 JAVA_HOME 을 설정하고 다시 실행하세요.\n',
  )
  process.exit(1)
}
console.log(found === 'PATH' ? 'Java: PATH' : `Java: ${found}`)

// Windows 에서 npx 는 .cmd 라 shell 없이는 못 띄운다.
// shell 을 쓰면서 args 배열을 함께 주면 Node 가 이스케이프 경고를 낸다(DEP0190).
// 인자는 전부 여기 적힌 고정 문자열이라 한 줄로 합쳐도 안전하다.
const CMD = [
  'npx --yes --package=firebase-tools firebase emulators:start',
  '--only firestore',
  '--project sls-rules-test',
].join(' ')

const child = spawn(CMD, { stdio: 'inherit', shell: true, env: process.env })
child.on('exit', (code) => process.exit(code ?? 0))
