import type { FieldDef, Lesson, Step, Stimulus } from '@/content/types'
import { buildSteps } from '@/content/steps'

/**
 * 수업 화면 등록표 (8차 7절 · 7차 Q.2 를 잇는다).
 *
 * 학생 화면과 강사 화면은 같은 블록 정의를 읽는다 — stepBlocks() 하나가 두 화면의 순서를 정한다.
 * 강사 화면은 블록 옆에 등록표가 정한 조작부만 인라인으로 그린다. 덮개 화면이 아니다.
 *
 * ★ 수업 중에 누르는 것은 다섯 가지뿐이다 (7.3 — 발표 모드는 강의자 지시로 뺐다). verify:teach 가 이 목록과 Teach.tsx 를 대조한다.
 */

export type BlockKind =
  | 'stimulus' // 읽을 것·볼 것 — 조작부 없음
  | 'stimulusReveal' // 강사가 공개해야 열리는 자료 — 자료 공개 / 되돌리기
  | 'field' // 학생이 쓰는 칸 — 응답 n/N ▸ 분포 또는 목록
  | 'concepts' // 개념 카드 — 카드마다 잠깐 확인 응답 n/N ▸
  | 'wall' // ③ 공유 — 올라온 글 n ▸
  | 'group' // ④ 모둠 — 모둠별 ▸ (모둠 나누기는 도입 단계 머리에)
  | 'game' // ⑤ 게임 — 게임 시작 · 참가 n/N
  | 'recap' // 정리 — 기준 다시 보기, 조작부 없음
  | 'more' // 더 읽기 (이론 배경) — 조작부 없음

export type ControlId = 'reveal' | 'responses' | 'wall' | 'group' | 'game'

export const CONTROLS: Record<BlockKind, ControlId[]> = {
  stimulus: [],
  stimulusReveal: ['reveal'],
  field: ['responses'],
  concepts: ['responses'],
  wall: ['wall'],
  group: ['group'],
  game: ['game'],
  recap: [],
  more: [],
}

/** 7.3 — 수업 화면에 있는 단추 다섯 가지. 이 밖의 단추가 있으면 verify:teach 가 실패한다 */
export const TEACH_BUTTONS = ['단계 열기', '자료 공개', '모둠 나누기', '게임 시작', '응답 펼치기'] as const

export interface Block {
  /** `${stepId}:${kind}:${key}` */
  id: string
  kind: BlockKind
  stepId: string
  label: string
  field?: FieldDef
  material?: Stimulus
  /** reveal 이 다루는 sessions.revealed 의 id */
  gateId?: string
  /** 선택형 옆의 이유 칸 key */
  reasonKey?: string
  controls: ControlId[]
}

/** 한 단계의 블록을 학생 화면 순서로. 활동 단계는 ①과제 ②쓰기 ③공유 ④모둠 ⑤게임 */
export function stepBlocks(step: Step, lesson: Lesson): Block[] {
  const out: Block[] = []
  const mk = (kind: BlockKind, key: string, label: string, extra: Partial<Block> = {}): Block => ({ id: `${step.id}:${kind}:${key}`, kind, stepId: step.id, label, controls: CONTROLS[kind], ...extra })

  for (const m of step.material) {
    if (m.gate?.type === 'afterReveal') out.push(mk('stimulusReveal', m.id, `자료 · ${m.title}`, { material: m, gateId: m.gate.of }))
    else out.push(mk('stimulus', m.id, `자료 · ${m.title}`, { material: m }))
  }
  if (step.concepts.length > 0) out.push(mk('concepts', 'cards', `개념 카드 ${step.concepts.length}장`))
  if (step.kind === 'wrapup' && step.recap?.length) out.push(mk('recap', 'recap', '기준 다시 보기'))
  const reasonOf = (f: FieldDef) => {
    const i = step.fields.indexOf(f)
    const next = step.fields[i + 1]
    return next && (next.kind === 'longtext' || next.kind === 'text') && /reason|이유/i.test(next.key + next.label) ? next.key : undefined
  }
  for (const f of step.fields) out.push(mk('field', f.key, f.label, { field: f, reasonKey: f.kind === 'choice' ? reasonOf(f) : undefined }))
  if (step.activity) {
    out.push(mk('wall', 'wall', '공유 — 의견 광장'))
    out.push(mk('group', 'group', `모둠 — ${GROUP_FORMAT_LABEL[step.activity.group.format]}`))
    out.push(mk('game', step.activity.game, '게임 — 발표자 선정'))
  }
  if (step.kind === 'wrapup' && lesson.theory) out.push(mk('more', 'theory', '더 읽기 — 이론 배경'))
  return out
}

export const GROUP_FORMAT_LABEL: Record<string, string> = {
  allocation: '배분',
  rank: '순위',
  vote: '투표와 이유',
  sentence: '합의 문장',
  sort: '분류',
}

export function lessonBlocks(lesson: Lesson): Array<{ step: Step; blocks: Block[] }> {
  return buildSteps(lesson).map((step) => ({ step, blocks: stepBlocks(step, lesson) }))
}

/** 이 단계에서 강사가 공개할 수 있는 자료 */
export function gatesOf(blocks: Block[]): Array<{ id: string; label: string }> {
  const seen = new Set<string>()
  const out: Array<{ id: string; label: string }> = []
  for (const b of blocks) {
    if (!b.gateId || seen.has(b.gateId)) continue
    seen.add(b.gateId)
    out.push({ id: b.gateId, label: b.material?.title ?? b.label })
  }
  return out
}
