import { MARBLE_DEFAULT_MAP, MARBLE_DEFAULT_PICK, MARBLE_MAPS, MARBLE_PICKS } from '@/lib/marble'
import type { GameKind } from './types'

/**
 * 발표자 선정 게임 라이브러리 (8차 6절).
 *
 * 공통 규칙
 *   · 3분 이내. 80분 차시의 활동 1 에 붙는 것은 1분 이내.
 *   · 학생은 [참가] 하나, 강사는 [시작] 하나. 규칙은 화면 한 줄.
 *   · 결과는 서버 시드로 정해지고 결과 화면에 시드와 후보를 남긴다.
 *   · 발표 횟수가 적은 사람의 가중치 · 재추첨 · 수동 지정 · 비상 추첨은 GameShell 이 공통으로 갖는다.
 *   · 폰 세로 화면에서 된다. 루미 런만 가로.
 *   · 모둠 협동 게임은 모둠 단계가 끝난 뒤에만 뜬다.
 *   · 반응 속도 게임(late · flash)은 결과에 「반응 속도 게임입니다」를 적고 한 학기에 두 번 이하.
 *
 * 배치는 차시 파일의 activity.game 이 정한다 — 강의자가 바꾼다. verify:games 가 6.4 를 본다.
 */
export interface GameSpec {
  kind: GameKind
  name: string
  /** 규칙 한 줄 — 학생 화면에 그대로 */
  rule: string
  scope: 'individual' | 'group'
  /** 대략 걸리는 시간(초). 80분 활동 1 은 60 이하 */
  seconds: number
  /** 발표자를 정하는 규칙 */
  winner: string
  /** 기기·회선에 좌우되는 반응 속도 게임인가 */
  reaction?: boolean
  /** 폰 가로 화면 필요 */
  landscape?: boolean
  /** 옛 게임을 그대로 쓴다 (1·2강) */
  legacy?: boolean
  /** 차시별로 고를 수 있는 옵션과 기본값 */
  options?: Record<string, { label: string; values: string[]; default: string }>
}

export const GAME_LIBRARY: Record<GameKind, GameSpec> = {
  bomb: {
    kind: 'bomb',
    name: '폭탄 돌리기',
    rule: '폭탄을 가진 사람은 넘기기를 누르세요. 시간이 끝났을 때 든 사람이 발표합니다.',
    scope: 'individual',
    seconds: 60,
    winner: '시간이 끝났을 때 폭탄을 든 사람',
  },
  closest: {
    kind: 'closest',
    name: '숫자 가까이',
    rule: '1부터 100 사이에서 하나를 고르세요. 서버가 뽑은 숫자에 가장 가까운 사람이 발표합니다.',
    scope: 'individual',
    seconds: 30,
    winner: '가장 가까운 사람 (동점 공동)',
  },
  doors: {
    kind: 'doors',
    name: '문 세 개',
    rule: '문 하나를 고르세요. 열린 문을 고른 사람은 통과합니다. 마지막까지 남은 한 사람이 발표합니다.',
    scope: 'individual',
    seconds: 120,
    winner: '끝까지 안 뽑힌 사람',
  },
  mine: {
    kind: 'mine',
    name: '지뢰 한 칸',
    rule: '5×5 격자에서 한 칸을 고르세요. 지뢰를 밟은 사람이 발표합니다.',
    scope: 'individual',
    seconds: 30,
    winner: '지뢰를 밟은 사람 (없으면 재추첨)',
  },
  late: {
    kind: 'late',
    name: '늦게 눌러라',
    rule: '10초 카운트다운. 가장 늦게 누른 사람이 발표합니다. 0 이 지난 뒤 누르면 탈락입니다.',
    scope: 'individual',
    seconds: 30,
    winner: '0 이 되기 전에 가장 늦게 누른 사람',
    reaction: true,
  },
  rps: {
    kind: 'rps',
    name: '가위바위보 토너먼트',
    rule: '짝이 정해지면 동시에 내세요. 진 사람은 탈락합니다.',
    scope: 'individual',
    seconds: 120,
    winner: '우승자 (또는 첫 탈락자 — 차시별 선택)',
    options: { pick: { label: '누가 발표하는가', values: ['winner', 'firstOut'], default: 'winner' } },
  },
  sync: {
    kind: 'sync',
    name: '동시에 눌러라',
    rule: '모둠원 전원이 「지금」을 누르세요. 누른 시각의 편차가 가장 작은 모둠이 발표합니다.',
    scope: 'group',
    seconds: 30,
    winner: '편차가 가장 작은 모둠의 대표',
    reaction: true,
  },
  sum: {
    kind: 'sum',
    name: '비밀 합',
    rule: '말하지 말고 1에서 5 중 하나를 고르세요. 합이 서버가 정한 목표에 가장 가까운 모둠이 발표합니다.',
    scope: 'group',
    seconds: 30,
    winner: '합이 목표에 가장 가까운 모둠의 대표',
  },
  relay: {
    kind: 'relay',
    name: '릴레이 단어',
    rule: '모둠원이 순서대로 한 글자씩 넣어 여섯 글자 낱말을 완성하세요. 가장 빠른 모둠이 발표합니다.',
    scope: 'group',
    seconds: 60,
    winner: '가장 먼저 완성한 모둠의 대표',
  },
  bingo: {
    kind: 'bingo',
    name: '빙고',
    rule: '3×3 판의 항목을 서버가 하나씩 뽑습니다. 먼저 한 줄을 만든 사람이 발표합니다.',
    scope: 'individual',
    seconds: 120,
    winner: '첫 빙고',
  },
  estimate: {
    kind: 'estimate',
    name: '추정',
    rule: '오늘 모둠 질문에서 그 답을 고른 사람이 몇 명인지 맞히세요. 가장 가까운 사람이 발표합니다.',
    scope: 'individual',
    seconds: 30,
    winner: '가장 가까운 사람',
  },
  flash: {
    kind: 'flash',
    name: '순간 포착',
    rule: '화면이 초록으로 바뀌는 순간 누르세요. 가장 빨리(또는 늦게) 누른 사람이 발표합니다.',
    scope: 'individual',
    seconds: 30,
    winner: '가장 빠른 사람 (또는 가장 늦은 사람 — 차시별 선택)',
    reaction: true,
    options: { pick: { label: '누가 발표하는가', values: ['fastest', 'slowest'], default: 'fastest' } },
  },
  lumi: {
    kind: 'lumi',
    name: '루미 런',
    rule: '루미와 함께 달립니다. 몇 등이 발표자가 될지는 결과 때 알려드립니다.',
    scope: 'individual',
    seconds: 180,
    winner: '미리 정한 등수 (결과 때만 공개)',
    landscape: true,
    options: { map: { label: '코스', values: ['1', '2', '3', '4', '5'], default: '1' } },
  },
  marble: {
    kind: 'marble',
    name: '교실 구슬 레이스',
    rule: '수강생 모두가 구슬이 되어 앞 화면에서 함께 달립니다. 차시가 정한 도착 순서에 든 사람이 발표합니다.',
    scope: 'individual',
    seconds: 60,
    winner: '차시가 정한 도착 순서 — 먼저 온 몇 명 또는 늦게 온 몇 명',
    options: {
      map: { label: '맵', values: Object.keys(MARBLE_MAPS), default: MARBLE_DEFAULT_MAP },
      pick: { label: '발표자', values: Object.keys(MARBLE_PICKS), default: MARBLE_DEFAULT_PICK },
    },
  },
  ladder: {
    kind: 'ladder',
    name: '사다리타기',
    rule: '자리를 하나 고르세요. 강사가 결과를 열면 사다리를 타고 내려갑니다.',
    scope: 'individual',
    seconds: 90,
    winner: '발표 칸에 도착한 사람',
    legacy: true,
  },
  envelope: {
    kind: 'envelope',
    name: '발표자 선정 봉투',
    rule: '봉투 하나를 고르세요. 열기 전에는 아무도 모릅니다.',
    scope: 'individual',
    seconds: 60,
    winner: '발표 표시가 든 봉투를 고른 사람',
    legacy: true,
  },
}

/** 6.2 의 새 게임 12 + 밖에서 붙인 게임 2(루미 런 · 구슬 레이스) — 라이브러리 14종. 사다리·봉투는 1·2강에 유지되는 옛 게임이다 */
export const LIBRARY_KINDS: GameKind[] = ['bomb', 'closest', 'doors', 'mine', 'late', 'rps', 'sync', 'sum', 'relay', 'bingo', 'estimate', 'flash', 'lumi', 'marble']
export const LEGACY_KINDS: GameKind[] = ['ladder', 'envelope']

export function gameSpec(kind: GameKind): GameSpec {
  return GAME_LIBRARY[kind]
}

/** 릴레이 단어에 쓰는 여섯 글자 낱말 — 과학 낱말이 아니다 */
export const RELAY_WORDS = ['다람쥐도토리', '봄바람산책길', '고구마아이스', '바닷가모래성', '초록우산하나', '겨울밤귤껍질', '동네빵집냄새', '기차역대합실', '토요일늦잠꿈', '수박화채한통']
