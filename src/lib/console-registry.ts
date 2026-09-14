import type { FieldDef, Lesson, Stimulus, Step } from '@/content/types'
import type { StepView } from './tiers'

/**
 * 진행 콘솔 등록표 (7차 지시서 Q.2 · R-1).
 *
 * 콘솔은 학생 화면이 읽는 것과 같은 블록 정의를 읽고, 블록 종류에 따라 조작부를 그린다.
 * 학생 화면과 콘솔을 따로 만들어 여섯 차례 변경 동안 어긋났던 것을 여기서 끝낸다.
 *
 * ★ 등록표에 없는 조작부는 콘솔에 그리지 않는다. 새 블록 종류를 만들면 여기에 한 줄을 더한다.
 *   verify:console 이 양방향으로 본다 — 학생 화면의 모든 블록 종류가 여기 있는가,
 *   콘솔이 여기 없는 조작부를 그리지 않는가.
 */

export type BlockKind =
  | 'stimulus' // 읽을 것·볼 것 — 조작부 없음
  | 'stimulusReveal' // gate 가 afterReveal 인 자료 — 자료 공개 / 되돌리기
  | 'input' // 서술형 칸 (text · longtext)
  | 'choice' // 선택형 칸 (choice · multi · rank)
  | 'sorter' // 배분·4칸 (allocation · quadrant · cardSorter)
  | 'canvas' // 노드·그림 (nodeCanvas)
  | 'module' // 그 밖의 전용 모듈
  | 'opinionWall' // 의견 광장
  | 'ladder' // 발표자 뽑기
  | 'groupGame' // 모둠 나누기
  | 'groupBuild' // 즉석 모둠 (제출 뒤 모둠원의 글이 모임)
  | 'concepts' // 개념 카드 — 조작부 없음
  | 'gateOpen' // afterInstructorOpen 으로 잠긴 칸 — 열기 / 닫기
  | 'deferred' // 50분 판에서 「수업 후 이어서」로 내려간 것 — 제출 현황

export type ControlId =
  | 'reveal' // 자료 공개 / 되돌리기
  | 'open' // 열기 / 닫기 (afterInstructorOpen)
  | 'submissions' // 제출 현황
  | 'responses' // 응답 목록
  | 'cluster' // 유형 묶기 (AI 제안 — 확정으로 표시하지 않는다)
  | 'reask' // 재응답 요청 (전체 / 고른 학생)
  | 'distribution' // 분포
  | 'byOption' // 선택지별 명단과 이유
  | 'sideBySide' // 개인·모둠별 배분 나란히 보기
  | 'thumbnails' // 썸네일 격자 · 크게 보기
  | 'pin' // 고정
  | 'hide' // 숨김
  | 'split' // 갈린 글 표시
  | 'ladder' // 후보 확인 · 제외 · 실행 · 재추첨 · 수동 지정
  | 'groupGame' // 실행 · 미리보기 · 재배정 · 수동 이동 · 확정 · 동석 기록
  | 'deferredStatus' // 「수업 후 이어서」 제출 여부

/** Q.2 표 그대로. 여기 없는 조작부는 콘솔에 없다. */
export const CONTROLS: Record<BlockKind, ControlId[]> = {
  stimulus: [],
  stimulusReveal: ['reveal'],
  input: ['submissions', 'responses', 'cluster', 'reask'],
  choice: ['submissions', 'distribution', 'byOption', 'reask'],
  sorter: ['submissions', 'sideBySide', 'reask'],
  canvas: ['submissions', 'thumbnails', 'reask'],
  module: ['submissions', 'responses', 'reask'],
  opinionWall: ['pin', 'hide', 'cluster', 'split'],
  ladder: ['ladder'],
  groupGame: ['groupGame'],
  groupBuild: ['sideBySide'],
  concepts: [],
  gateOpen: ['open'],
  deferred: ['deferredStatus'],
}

export const CONTROL_LABEL: Record<ControlId, string> = {
  reveal: '자료 공개 / 되돌리기',
  open: '열기 / 닫기',
  submissions: '제출 현황',
  responses: '응답 목록',
  cluster: '유형 묶기',
  reask: '재응답 요청',
  distribution: '분포',
  byOption: '선택지별 명단',
  sideBySide: '개인·모둠별 나란히 보기',
  thumbnails: '썸네일 격자',
  pin: '고정',
  hide: '숨김',
  split: '갈린 글 표시',
  ladder: '발표자 뽑기',
  groupGame: '모둠 나누기',
  deferredStatus: '「수업 후 이어서」 제출 현황',
}

export interface ConsoleBlock {
  /** 콘솔 안에서만 쓰는 열쇠. `${stepId}:${종류}:${id}` */
  id: string
  kind: BlockKind
  stepId: string
  label: string
  /** 칸 블록이면 그 칸 */
  field?: FieldDef
  /** 자료 블록이면 그 자료 */
  material?: Stimulus
  /** reveal / open 이 다루는 sessions.revealed 의 id */
  gateId?: string
  /** 응답에서 함께 보여 줄 이유 칸의 key (선택형 옆의 이유) */
  reasonKey?: string
  /** 응답이 저장되는 단계가 이 블록의 단계와 다를 때 (수업 후 이어서 등) */
  controls: ControlId[]
}

export function fieldBlockKind(f: FieldDef): BlockKind {
  if (f.kind === 'text' || f.kind === 'longtext') return 'input'
  if (f.kind === 'choice' || f.kind === 'multi' || f.kind === 'rank') return 'choice'
  return 'sorter'
}

export function moduleBlockKind(component: NonNullable<Step['moduleComponent']>): BlockKind {
  if (component === 'nodeCanvas') return 'canvas'
  if (component === 'cardSorter') return 'sorter'
  return 'module'
}

/**
 * 한 단계의 블록을 학생 화면과 같은 순서로 늘어놓는다.
 *
 * 학생 화면(Lesson.tsx)의 순서: 모둠 게임 → 자료 → 개념 카드 → 전용 모듈 → 칸들 → 즉석 모둠 → 의견 광장 → 발표자 뽑기.
 * 50분 판에서 내려간 칸·자료·카드는 여기서 빠지고 lessonBlocks 의 deferred 블록 하나로 모인다.
 */
export function stepBlocks(stepView: StepView, opts: { formationRound: boolean }): ConsoleBlock[] {
  const s = stepView.step
  const out: ConsoleBlock[] = []
  const mk = (kind: BlockKind, key: string, label: string, extra: Partial<ConsoleBlock> = {}): ConsoleBlock => ({
    id: `${s.id}:${kind}:${key}`,
    kind,
    stepId: s.id,
    label,
    controls: CONTROLS[kind],
    ...extra,
  })

  if (opts.formationRound && s.order === 1) out.push(mk('groupGame', 'formation', '모둠 나누기'))
  for (const m of stepView.material) {
    if (m.gate?.type === 'afterReveal') out.push(mk('stimulusReveal', m.id, `자료 · ${m.title}`, { material: m, gateId: m.gate.of }))
    else out.push(mk('stimulus', m.id, `자료 · ${m.title}`, { material: m }))
  }
  if (stepView.concepts.length > 0) out.push(mk('concepts', 'cards', `개념 카드 ${stepView.concepts.length}장`))
  if (s.moduleComponent) out.push(mk(moduleBlockKind(s.moduleComponent), s.moduleComponent, `전용 모듈 · ${s.title}`))

  const reasonOf = (f: FieldDef) => {
    const i = stepView.fields.indexOf(f)
    const next = stepView.fields[i + 1]
    return next && (next.kind === 'longtext' || next.kind === 'text') && /reason|이유/i.test(next.key + next.label) ? next.key : undefined
  }
  for (const f of stepView.fields) {
    const kind = fieldBlockKind(f)
    out.push(mk(kind, f.key, f.label, { field: f, reasonKey: kind === 'choice' ? reasonOf(f) : undefined }))
    if (f.gate?.type === 'afterInstructorOpen') {
      out.push(mk('gateOpen', f.gate.of, f.gate.of === 'secondRound' ? '2차 응답 열기' : `열기 · ${f.label}`, { gateId: f.gate.of, field: f }))
    }
  }
  if (s.groupBuild) out.push(mk('groupBuild', 'groupBuild', '즉석 모둠 — 모둠별 나란히 보기'))
  if (s.wall?.enabled) out.push(mk('opinionWall', 'wall', '의견 광장'))
  if (s.picker?.enabled) out.push(mk('ladder', s.picker.gameId, '발표자 뽑기'))
  return out
}

/** 50분 판에서 「수업 후 이어서」로 내려간 것 — 단계 전체와 칸 단위를 한 블록으로 모은다 */
export function deferredBlock(lesson: Lesson, view: { steps: StepView[]; deferredSteps: StepView[] }): ConsoleBlock | null {
  const parts: string[] = []
  for (const v of view.deferredSteps) parts.push(v.step.shortTitle)
  for (const v of view.steps) {
    if (v.deferredFields.length + v.deferredConcepts.length + v.deferredMaterial.length > 0) parts.push(`${v.step.shortTitle}(일부)`)
  }
  if (parts.length === 0) return null
  return {
    id: `${lesson.id}:deferred`,
    kind: 'deferred',
    stepId: '',
    label: `수업 후 이어서 · ${parts.join(' · ')}`,
    controls: CONTROLS.deferred,
  }
}

/** 이 단계에서 강사가 열 수 있는 것 (자료 공개 + afterInstructorOpen) — 진행 바의 「자료 공개」가 쓴다 */
export function gatesOf(blocks: ConsoleBlock[]): Array<{ id: string; label: string; kind: 'reveal' | 'open' }> {
  const seen = new Set<string>()
  const out: Array<{ id: string; label: string; kind: 'reveal' | 'open' }> = []
  for (const b of blocks) {
    if (!b.gateId || seen.has(b.gateId)) continue
    seen.add(b.gateId)
    out.push({ id: b.gateId, label: b.material?.title ?? b.label, kind: b.kind === 'stimulusReveal' ? 'reveal' : 'open' })
  }
  return out
}
