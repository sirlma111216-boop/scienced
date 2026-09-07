/**
 * npm run verify — 배포 전 전체 검증.
 * 하나라도 실패하면 종료 코드 1.
 */
import { spawnSync } from 'node:child_process'

const CHECKS = [
  ['verify:ladder', '사다리 — 전단사·가로줄 인접 금지·발표자 수·씨앗 재현성·좌우 이동률'],
  ['verify:lessons', '18개 차시 메타데이터 · 개념 여섯 층 · 강사 대본'],
  ['verify:classes', '수강 클래스 격리 · 실명 분리 · 보안 규칙'],
  ['verify:content', '교재 OCR 오독과 72회 반복 템플릿 유입 차단'],
  ['verify:wording', '하루짜리 연수 어휘 차단 · 마무리 단계 이름 · 타임라인 링크'],
  ['verify:tiers', '50분 판 — 빈 차시 없음 · 절대 빼지 않는 넷 · 이동이지 삭제 아님'],
  ['verify:standards', '원문 대조 전 성취기준의 「대표 예시」 라벨'],
  ['verify:games', '18개 게임 등록 · mode 고유 · 1강 ladder'],
  ['verify:modules', '핵심 모듈 배치 · AI 교사 검토 관문'],
  ['verify:wall', '의견 광장 배치 · 인기순 정렬 없음'],
  ['verify:a11y', '드래그 전용 없음 · 포커스 · 대체 텍스트 · reduced-motion'],
  ['verify:publish', '시드에서 1강만 공개 · 보안 규칙'],
]

let failed = 0

for (const [script, label] of CHECKS) {
  console.log(`\n▶ ${script} — ${label}`)
  const r = spawnSync(
    process.execPath,
    ['--import', './scripts/_loader.mjs', `scripts/${script.replace('verify:', 'verify-')}.mjs`],
    { stdio: 'inherit' },
  )
  if (r.status !== 0) failed++
}

console.log('\n' + '─'.repeat(60))
if (failed > 0) {
  console.error(`검증 실패 ${failed} / ${CHECKS.length}`)
  process.exit(1)
}
console.log(`검증 ${CHECKS.length}종 전부 통과`)
