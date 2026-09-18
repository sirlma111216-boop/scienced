/**
 * npm run verify — 배포 전 전체 검증 (8차 11절).
 * 하나라도 실패하면 종료 코드 1.
 */
import { spawnSync } from 'node:child_process'

const CHECKS = [
  ['verify:ladder', '사다리 — 전단사·가로줄 인접 금지·발표자 수·씨앗 재현성·좌우 이동률'],
  ['verify:course', '두 과목 — 색인↔파일 · 과목 간 문장 중복 · 클래스 courseId · 지연 불러오기'],
  ['verify:flow', '골격 4/6/4 · 쓰기 칸 3/4 · 활동 다섯 단 · 정리 문항 꼴'],
  ['verify:concepts', '개념 카드 — 문단 셋 · 기준 3줄 · 판단 기준의 꼴 · 명사 나열 금지'],
  ['audit:activity', '활동 — 네 검사 · 상황 200~400자 · 명령형 과제 · 선택지 3 이상'],
  ['audit:draft', '검토 문서 ↔ 코드'],
  ['verify:classes', '수강 클래스 격리 · 실명 분리 · 보안 규칙'],
  ['verify:content', '교재 OCR 오독 · 반복 템플릿 · 차시 간 문장 중복'],
  ['verify:wording', '연수 어휘 · 화면의 분 표시 · 8차 글 규칙(비유·구호·어미·문장 길이)'],
  ['verify:api', '서버 호출에 인증 토큰이 붙는가 · 열린 서버 함수가 없는가'],
  ['verify:games', '게임 라이브러리 15종 · 계산 · 배치 6.4 · 서버 시각 · 단추'],
  ['verify:groups', '질문 은행 · 모둠 데이터 형식 · 모의 실행 · 접근성'],
  ['verify:teach', '등록표 · 같은 부품 · 단추 다섯 · 실명 가리기 · 발표 모드·단계 시간 없음 · /live 없음'],
  ['verify:modules', 'AI 교사 검토 관문'],
  ['verify:a11y', '드래그 전용 없음 · 포커스 · 대체 텍스트 · reduced-motion'],
  ['verify:publish', '시드 공개 차시 · 보안 규칙 · 내용 전송'],
  ['verify:stimulus', '자료 — id · 꼬리표 · 대본 줄머리 · 자료 연결'],
  ['verify:figures', '그림 제작 명세 · 그림 속 글자 금지'],
  ['verify:theory', '이론 배경 — 깨진 표기 · 카드 연결 · 더 읽기'],
]

let failed = 0
for (const [script, label] of CHECKS) {
  console.log(`\n▶ ${script} — ${label}`)
  const file = script.replace('verify:', 'verify-').replace('audit:', 'audit-')
  const r = spawnSync(process.execPath, ['--import', './scripts/_loader.mjs', `scripts/${file}.mjs`], { stdio: 'inherit' })
  if (r.status !== 0) failed++
}

console.log('\n' + '─'.repeat(60))
if (failed > 0) {
  console.error(`검증 실패 ${failed} / ${CHECKS.length}`)
  process.exit(1)
}
console.log(`검증 ${CHECKS.length}종 전부 통과`)
