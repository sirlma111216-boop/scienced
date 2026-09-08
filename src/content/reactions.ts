/**
 * 의견 광장의 반응 4종.
 *
 * 좋아요를 쓰지 않는다. 컨텍스트 19.7이 "좋아요 중심 인기 평가"를 금지한다.
 * 하루짜리 연수에서는 하트가 무해하지만, 같은 30명이 18주를 함께 가는 강의에서는
 * 인기 순위가 굳는다. 14강이 다루는 참여 형평성과도 정면으로 부딪힌다.
 *
 * 기존 앱대로 하트 하나로 되돌리고 싶으면 이 배열만 고치면 된다.
 * 정렬 옵션에 인기순을 만들지 않는다 (verify:wall 이 감시한다).
 */
/*
 * 이름은 두 글자로 짧게 둔다.
 *
 * 「나도 그렇게 생각했다」처럼 문장으로 두었더니 단추 네 개가 두 줄을 먹었다.
 * 스무 명이 올린 글을 훑어야 하는 화면에서 카드 하나가 화면을 다 차지했다.
 * 긴 뜻은 meaning 에 남겨 두고, 화면은 마크 + 두 글자만 쓴다 —
 * 마우스를 올리거나 화면 낭독으로 들으면 긴 뜻이 그대로 나온다.
 */
export const REACTIONS = [
  { key: 'agreed', label: '동의', meaning: '나도 그렇게 생각했다', mark: '=' },
  { key: 'wantEvidence', label: '의문', meaning: '근거가 궁금하다', mark: '?' },
  { key: 'disagree', label: '이견', meaning: '나는 다르게 본다', mark: '≠' },
  { key: 'learned', label: '발견', meaning: '새로 알았다', mark: '+' },
] as const

export type ReactionKey = (typeof REACTIONS)[number]['key']
export const REACTION_KEYS = REACTIONS.map((r) => r.key) as ReactionKey[]

/**
 * 정렬 기본값은 '아직 반응이 없는 글 먼저'.
 * 아무도 읽지 않은 글이 계속 밑에 깔리는 일을 막는다.
 */
/*
 * 정렬은 둘뿐이다.
 *
 * 「강사 추천」·「내가 반응한 것」·「우리 모둠」을 뺐다. 강사가 고정한 글은 어느 정렬에서든
 * 맨 앞에 오므로 따로 고를 이유가 없었고, 나머지 둘은 고르는 사람이 없는 채로 자리만 먹었다.
 * 수업 중에 누를 것이 적을수록 좋다.
 */
export const WALL_SORTS = [
  { key: 'unanswered', label: '아직 반응이 없는 글 먼저' },
  { key: 'recent', label: '최신순' },
] as const

export type WallSortKey = (typeof WALL_SORTS)[number]['key']

/** 댓글 문장 틀. 버튼으로 제공하고 강제하지 않는다 (컨텍스트 17.3). */
export const COMMENT_STARTERS = [
  '이 부분이 ___와(과) 연결된다고 봅니다',
  '이 주장에 필요한 증거는 ___라고 생각합니다',
  '저는 ___ 때문에 다르게 봅니다',
]

export const COMMENT_MAX = 200
