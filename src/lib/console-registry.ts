import type { FieldDef, KeyConcept, Lesson, Stimulus, Step } from '@/content/types'

/**
 * 진행 콘솔 등록표 (7차 Q.2 · 8차 A 과도기 판).
 *
 * 콘솔은 학생 화면이 읽는 것과 같은 블록 정의를 읽고, 블록 종류에 따라 조작부를 그린다.
 * 8차 A 에서 뺀 것: 재응답 요청 · 고정 · 숨김 · 갈린 글 · 광장의 유형 묶기 · 2차 응답 열기 · 「수업 후 이어서」.
 * C 단계에서 `/teach` 한 화면의 인라인 조작부 등록표로 다시 짠다.
 */

export type BlockKind =
  | 'stimulus' // 읽을 것·볼 것 — 조작부 없음
  | 'stimulusReveal' // gate 가 afterReveal 인 자료 — 자료 공개 / 되돌리기
  | 'input' // 서술형 칸 (text · longtext)
  | 'choice' // 선택형 칸 (choice · multi · rank)
  | 'sorter' // 배분·4칸 (allocation · quadrant · cardSorter)
  | 'canvas' // 노드·그림 (nodeCanvas)
  | 'module' // 그 밖의 전용 모듈
  | 'opinionWall' // 의견 광장 — 읽기만
  | 'ladder' // 발표자 뽑기
  | 'groupGame' // 모둠 나누기
  | 'groupBuild' // 모둠 토의 (제출 뒤 모둠원의 글이 모임)
  | 'concepts' // 개념 카드 — 조작부 없음

export type ControlId =
  | 'reveal' // 자료 공개 / 되돌리기
  | 'submissions' // 제출 현황
  | 'responses' // 응답 목록
  | 'cluster' // 유형 묶기 (AI 제안 — 확정으로 표시하지 않는다)
  | 'distribution' // 분포
  | 'byOption' // 선택지별 명단과 이유
  | 'sideBySide' // 개인·모둠별 배분 나란히 보기
  | 'thumbnails' // 썸네일 격자 · 크게 보기
  | 'wallList' // 올라온 글 목록
  | 'ladder' // 후보 확인 · 제외 · 실행 · 재추첨 · 수동 지정
  | 'groupGame' // 실행 · 미리보기 · 재배정 · 수동 이동 · 확정 · 동석 기록

export const CONTROLS: Record<BlockKind, ControlId[]> = {
  stimulus: [],
  stimulusReveal: ['reveal'],
  input: ['submissions', 'responses', 'cluster'],
  choice: ['submissions', 'distribution', 'byOption'],
  sorter: ['submissions', 'sideBySide'],
  canvas: ['submissions', 'thumbnails'],
  module: ['submissions', 'responses'],
  opinionWall: ['wallList'],
  ladder: ['ladder'],
  groupGame: ['groupGame'],
  groupBuild: ['sideBySide'],
  concepts: [],
}

export const CONTROL_LABEL: Record<ControlId, string> = {
  reveal: '자료 공개 / 되돌리기',
  submissions: '제출 현황',
  responses: '응답 목록',
  cluster: '유형 묶기',
  distribution: '분포',
  byOption: '선택지별 명단',
  sideBySide: '개인·모둠별 나란히 보기',
  thumbnails: '썸네일 격자',
  wallList: '올라온 글 목록',
  ladder: '발표자 뽑기',
  groupGame: '모둠 나누기',
}

/** 학생 화면과 콘솔이 같이 읽는 단계 한 벌. 판(tier)이 없어졌으므로 자르는 것 없이 그대로다. */
export interface StepView {
  step: Step
  fields: Step['fields']
  material: NonNullable<Step['material']>
  concepts: KeyConcept[]
}

export function lessonView(lesson: Lesson): StepView[] {
  const conceptById = new Map(lesson.keyConcepts.map((c) => [c.id, c]))
  return lesson.steps.map((step) => ({
    step,
    fields: step.fields,
    material: step.material ?? [],
    concepts: (step.conceptIds ?? []).map((id) => conceptById.get(id)).filter((x): x is KeyConcept => !!x),
  }))
}

export interface ConsoleBlock {
  /** 콘솔 안에서만 쓰는 열쇠. `${stepId}:${종류}:${id}` */
  id: string
  kind: BlockKind
  stepId: string
  label: string
  field?: FieldDef
  material?: Stimulus
  /** reveal 이 다루는 sessions.revealed 의 id */
  gateId?: string
  /** 응답에서 함께 보여 줄 이유 칸의 key (선택형 옆의 이유) */
  reasonKey?: string
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
 * 학생 화면(Lesson.tsx)의 순서: 모둠 게임 → 자료 → 개념 카드 → 전용 모듈 → 칸들 → 모둠 토의 → 의견 광장 → 발표자 뽑기.
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
  }
  if (s.groupBuild) out.push(mk('groupBuild', 'groupBuild', '모둠 토의 — 모둠별 나란히 보기'))
  if (s.wall?.enabled) out.push(mk('opinionWall', 'wall', '의견 광장'))
  if (s.picker?.enabled) out.push(mk('ladder', s.picker.gameId, '발표자 뽑기'))
  return out
}

/** 이 단계에서 강사가 공개할 수 있는 자료 — 진행 바의 「자료 공개」가 쓴다 */
export function gatesOf(blocks: ConsoleBlock[]): Array<{ id: string; label: string }> {
  const seen = new Set<string>()
  const out: Array<{ id: string; label: string }> = []
  for (const b of blocks) {
    if (!b.gateId || seen.has(b.gateId)) continue
    seen.add(b.gateId)
    out.push({ id: b.gateId, label: b.material?.title ?? b.label })
  }
  return out
}
