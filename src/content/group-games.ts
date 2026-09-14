import type { LessonId } from './types'

/**
 * 모둠 나누기 게임 여섯 개 (6차 지시서 작업 O·P.1).
 *
 * 방식이 서로 다르다 — 이질로 묶기 / 동질로 묶기 / 갈린 쪽에서 하나씩 / 조각 맞추기 / 역할 나누기 / 한 벌 모으기.
 * 각 게임은 그 차시의 학습 내용과 잇는다.
 *
 * ★ 게임이 결과를 정하는 척하지 않는다 (N.6).
 *   게임은 「분류 기준」을 만들 뿐이다. 그 분류를 만족하는 배치는 여러 개고, 그중에서 중복이
 *   가장 적은 것을 배정 규칙이 고른다. 학생이 고른 것이 배정에 어떻게 반영되는지를 effectScope 에
 *   적고, 화면이 그것을 그대로 보여 준다. 선택이 결과에 영향을 주지 않는 게임에서는 그렇다고 적는다.
 */

export type GroupGameId = '01-words' | '03-cases' | '05-forks' | '07-pieces' | '09-parts' | '11-analogy'

export type GroupGameMode =
  | 'heterogeneous' // 다른 답끼리
  | 'homogeneous' // 같은 답끼리 (1지망 존중)
  | 'oneFromEachFork' // 갈래마다 한 명씩
  | 'assembleSentence' // 조각 맞추기
  | 'distributeRoles' // 역할 나누기
  | 'collectSet' // 한 벌 모으기

/** 배분형 게임의 카드 한 벌. 한 벌이 한 모둠이다. */
export interface GroupCardSet {
  id: string
  /** 모둠 이름이 된다 */
  name: string
  /** 모둠 크기만큼 나눠 준다. 크기가 더 크면 앞에서부터 다시 돈다. */
  cards: Array<{ label: string; text: string }>
  /** 성취기준처럼 원문 대조가 필요한 것은 라벨을 붙인다 */
  tag?: string
}

export interface GroupGameDef {
  id: GroupGameId
  lessonId: LessonId
  title: string
  /** 지금 할 일 — 명령형 한 문장 (4차 H.1) */
  doNow: string
  mode: GroupGameMode
  /** N.6 — 선택이 배정에 어떻게 반영되는지 학생에게 보이는 문장 */
  effectScope: string
  /** 왜 이렇게 묶는가 — 강사 화면에만 */
  why: string
  /** 입력형 게임의 선택지. 카드에서 온 것과 같은 낱말을 쓴다. */
  options?: Array<{ id: string; label: string }>
  /** 2지망을 받는가 (동질 모둠) */
  secondChoice?: boolean
  /** 배분형 게임의 카드 묶음 */
  cardSets?: GroupCardSet[]
  groupNaming: 'fromCards' | 'numbered'
  /** 연출을 글로 — 그림을 못 보는 자리(낭독·reduced-motion)에서 읽는다 */
  revealText: string
}

export const GROUP_GAMES: GroupGameDef[] = [
  {
    id: '01-words',
    lessonId: '01',
    title: '다른 단어끼리 모이기',
    doNow: '좋은 과학 수업을 한 마디로 말한다면 어느 쪽에 가깝습니까? 하나만 고르세요.',
    mode: 'heterogeneous',
    effectScope:
      '여러분이 고른 단어가 모둠을 나누는 기준이 됩니다. 같은 단어를 고른 사람은 되도록 다른 모둠으로 갑니다. 그 안에서는 지난번에 만난 적이 가장 적은 사람끼리 묶입니다.',
    why:
      '4단계 경매에서 모둠이 100포인트를 나눠야 한다. 같은 생각만 모여 있으면 협상이 30초에 끝난다. 의견이 갈려 있어야 그 활동이 산다.',
    /* 4단계 경매의 여덟 장과 같은 카드 */
    options: [
      { id: 'fun', label: '재미있는 현상' },
      { id: 'explanation', label: '정확한 설명' },
      { id: 'question', label: '학생의 질문' },
      { id: 'collaboration', label: '협력' },
      { id: 'evidence', label: '학습의 증거' },
      { id: 'reallife', label: '실생활 연계' },
      { id: 'safety', label: '안전' },
      { id: 'participation', label: '모두의 참여' },
    ],
    groupNaming: 'fromCards',
    revealText: '고른 낱말들이 흩어져 떠다니다가, 같은 낱말끼리 잠시 뭉치고, 서로 다른 낱말이 하나씩 짝을 이루며 모둠 자리로 모입니다.',
  },
  {
    id: '03-cases',
    lessonId: '03',
    title: '진단 사건 배정소',
    doNow: '아래 학생 발화 여섯 개 중, 직접 다뤄 보고 싶은 것을 하나 고르고 2지망도 고르세요.',
    mode: 'homogeneous',
    effectScope:
      '고른 발화가 이번 두 차시 동안 여러분 모둠이 다룰 사건입니다. 같은 발화를 고른 사람끼리 되도록 한 모둠이 됩니다. 1지망이 몰리면 2지망으로 갑니다. 먼저 고른 순서가 아니라 전체 배치를 함께 계산합니다.',
    why: '그 모둠이 이 차시 내내 그 발화 하나를 진단한다. 모둠 나누기가 곧 과제 배정이다.',
    options: [
      { id: 'fall', label: '“무거운 물체가 더 빨리 떨어져요”' },
      { id: 'current', label: '“전류는 전구를 지나면서 줄어들어요”' },
      { id: 'plant', label: '“식물은 흙에서 양분을 먹고 자라요”' },
      { id: 'season', label: '“여름은 지구가 태양에 가까워서예요”' },
      { id: 'moon', label: '“달 모양이 바뀌는 건 지구 그림자 때문이에요”' },
      { id: 'boil', label: '“물을 계속 끓이면 온도가 계속 올라가요”' },
    ],
    secondChoice: true,
    groupNaming: 'fromCards',
    revealText: '사건 파일 여섯 개가 책상에 놓이고, 각자의 이름표가 자기가 맡을 파일 위로 내려앉습니다.',
  },
  {
    id: '05-forks',
    lessonId: '05',
    title: '갈림길에서 한 명씩',
    doNow: '60 °C 물 100 g 과 20 °C 물 100 g 을 섞으면 몇 도가 될까요? 예상해 보세요.',
    mode: 'oneFromEachFork',
    effectScope:
      '서로 다르게 예상한 사람끼리 한 모둠이 됩니다. 같은 예상을 한 사람은 되도록 다른 모둠으로 갑니다. 누가 맞았는지는 아직 알려 주지 않습니다.',
    why: '이 차시는 개념변화를 다룬다. 모둠 안에 예상이 이미 갈려 있어야 인지갈등이 사람 사이에서 일어난다. 혼자 겪는 갈등보다 힘이 세다. 정답을 이 단계에서 공개하지 않는다 — 모둠 이름에도 넣지 않는다.',
    options: [
      { id: 'below', label: '40 °C 보다 낮다' },
      { id: 'exact', label: '정확히 40 °C' },
      { id: 'above', label: '40 °C 보다 높다' },
      { id: 'near80', label: '80 °C 에 가깝다' },
    ],
    /* 예상을 이름으로 쓰지 않는다 — 정답을 암시하게 된다 */
    groupNaming: 'numbered',
    revealText: '길이 네 갈래로 갈리고, 각자의 표식이 자기가 고른 길로 걸어가 길이 얼마나 갈렸는지 보인 뒤, 각 길에서 한 명씩 가운데로 모입니다.',
  },
  {
    id: '07-pieces',
    lessonId: '07',
    title: '성취기준 조각 맞추기',
    doNow: '화면에 뜬 조각을 읽고, 이 조각이 어떤 문장의 일부일지 짐작해 보세요.',
    mode: 'assembleSentence',
    effectScope:
      '조각은 무작위로 나눠 드렸습니다. 같은 문장의 조각을 받은 분들이 한 모둠입니다. 여러분의 선택은 배정에 영향을 주지 않습니다 — 조각을 나눠 주는 것이 곧 배정이라, 지난번에 만난 적이 가장 적은 사람끼리 같은 문장을 받습니다.',
    why: '이 차시는 성취기준을 수업목표로 번역한다. 조각을 읽고 맞추는 동안 이미 성취기준 문장 구조를 한 번 훑게 된다.',
    cardSets: [
      {
        id: 'pressure',
        name: '압력과 부피',
        tag: '대표 예시',
        cards: [
          { label: '조각 ①', text: '기체의' },
          { label: '조각 ②', text: '압력과 부피의 관계를' },
          { label: '조각 ③', text: '실험으로 측정하여' },
          { label: '조각 ④', text: '그 결과를 그래프로 나타내고' },
          { label: '조각 ⑤', text: '입자 모형으로' },
          { label: '조각 ⑥', text: '설명할 수 있다' },
        ],
      },
      {
        id: 'photosynthesis',
        name: '광합성',
        tag: '대표 예시',
        cards: [
          { label: '조각 ①', text: '광합성에' },
          { label: '조각 ②', text: '빛과 이산화탄소가 필요함을' },
          { label: '조각 ③', text: '실험으로 확인하고' },
          { label: '조각 ④', text: '식물 질량의 출처를' },
          { label: '조각 ⑤', text: '자료를 근거로' },
          { label: '조각 ⑥', text: '설명할 수 있다' },
        ],
      },
      {
        id: 'motion',
        name: '운동과 힘',
        tag: '대표 예시',
        cards: [
          { label: '조각 ①', text: '물체의 운동을' },
          { label: '조각 ②', text: '시간과 위치로 나타내고' },
          { label: '조각 ③', text: '운동 상태가 변하는 까닭을' },
          { label: '조각 ④', text: '힘과 관련지어' },
          { label: '조각 ⑤', text: '모형으로 그려' },
          { label: '조각 ⑥', text: '설명할 수 있다' },
        ],
      },
      {
        id: 'ecosystem',
        name: '생태계',
        tag: '대표 예시',
        cards: [
          { label: '조각 ①', text: '생태계 구성 요소에 관한' },
          { label: '조각 ②', text: '자료를 수집하여' },
          { label: '조각 ③', text: '먹이 관계와 물질 순환을' },
          { label: '조각 ④', text: '그림으로 나타내고' },
          { label: '조각 ⑤', text: '구성 요소 사이의 관계를' },
          { label: '조각 ⑥', text: '설명할 수 있다' },
        ],
      },
      {
        id: 'star',
        name: '별의 밝기',
        tag: '대표 예시',
        cards: [
          { label: '조각 ①', text: '별의 겉보기 밝기와' },
          { label: '조각 ②', text: '거리의 관계를' },
          { label: '조각 ③', text: '모형 실험으로 알아보고' },
          { label: '조각 ④', text: '실제 별 자료에 적용하여' },
          { label: '조각 ⑤', text: '절대 밝기의 뜻을' },
          { label: '조각 ⑥', text: '설명할 수 있다' },
        ],
      },
      {
        id: 'reaction',
        name: '화학 반응',
        tag: '대표 예시',
        cards: [
          { label: '조각 ①', text: '화학 반응 전후의' },
          { label: '조각 ②', text: '질량을 측정하여' },
          { label: '조각 ③', text: '질량이 보존됨을 확인하고' },
          { label: '조각 ④', text: '그 까닭을' },
          { label: '조각 ⑤', text: '입자의 재배열로' },
          { label: '조각 ⑥', text: '설명할 수 있다' },
        ],
      },
    ],
    groupNaming: 'fromCards',
    revealText: '각자 자기 조각만 보이다가, 「맞춰 보기」를 누르면 조각들이 날아가 문장이 한 줄씩 완성되고, 같은 문장 앞에 선 사람들이 모둠이 됩니다.',
  },
  {
    id: '09-parts',
    lessonId: '09',
    title: '부품이 하나씩만 있다',
    doNow: '여러분에게 부품 하나가 배달되었습니다. 무엇인지 확인하세요.',
    mode: 'distributeRoles',
    effectScope:
      '부품은 무작위로 나눠 드렸습니다. 여섯 부품이 다 모여야 모형 하나가 됩니다. 여러분의 선택은 배정에 영향을 주지 않습니다 — 지난번에 만난 적이 가장 적은 사람끼리 같은 세트를 받습니다.',
    why: '나중에 배울 긍정적 상호의존을 미리 몸으로 겪게 한다. 누구도 혼자서는 모형을 못 만든다. 결석자가 있으면 강사가 부품을 재배분한다.',
    cardSets: [
      {
        id: 'roof',
        name: '지붕 색과 온도',
        cards: [
          // wording-ok: 실험 자료 안의 측정 시간 — 앱의 진행 시간이 아니다
          { label: '관찰 자료', text: '흰 지붕 상자 안 34 °C · 검은 지붕 상자 안 47 °C (정오, 30분 뒤)' },
          { label: '바꾼 것', text: '지붕의 색 — 흰색 / 검은색' },
          { label: '같게 둔 것', text: '상자 크기 · 재질 · 놓은 자리 · 잰 시각' },
          { label: '그림 규칙', text: '노란 화살표 = 빛, 빨간 화살표 = 열, 화살표 굵기 = 양' },
          // wording-ok: 실험의 제약 조건 — 앱의 진행 시간이 아니다
          { label: '제약 조건', text: '상자 두 개 · 온도계 두 개 · 30분' },
          { label: '검증 기준', text: '회색 지붕의 온도를 예측해 맞히면 이 모형은 쓸 만하다' },
        ],
      },
      {
        id: 'evaporation',
        name: '물의 증발',
        cards: [
          { label: '관찰 자료', text: '접시 물 50 mL 가 하루 뒤 32 mL · 뚜껑 덮은 접시는 49 mL' },
          { label: '바꾼 것', text: '뚜껑의 유무' },
          { label: '같게 둔 것', text: '물의 양 · 접시 크기 · 놓은 자리 · 시간' },
          { label: '그림 규칙', text: '작은 원 = 물 입자, 위로 향한 짧은 화살표 = 빠져나감' },
          { label: '제약 조건', text: '접시 두 개 · 눈금 실린더 · 하루' },
          { label: '검증 기준', text: '접시를 넓게 하면 더 줄어든다는 예측이 맞으면 쓸 만하다' },
        ],
      },
      {
        id: 'circuit',
        name: '전구 밝기',
        cards: [
          { label: '관찰 자료', text: '전구 하나 밝기 100 · 직렬 둘 각 45 · 병렬 둘 각 100' },
          { label: '바꾼 것', text: '전구를 잇는 방식 — 직렬 / 병렬' },
          { label: '같게 둔 것', text: '전지 · 전구 종류 · 전선 길이' },
          { label: '그림 규칙', text: '화살표 = 전류의 방향, 선 굵기 = 전류의 세기' },
          { label: '제약 조건', text: '전지 하나 · 전구 세 개 · 전선 여섯 가닥' },
          { label: '검증 기준', text: '직렬 셋의 밝기를 예측해 맞히면 쓸 만하다' },
        ],
      },
      {
        id: 'germination',
        name: '씨앗의 발아',
        cards: [
          { label: '관찰 자료', text: '물 준 씨앗 10개 중 8개 발아 · 물 안 준 씨앗 0개 발아 (5일)' },
          { label: '바꾼 것', text: '물의 유무' },
          { label: '같게 둔 것', text: '씨앗 종류 · 온도 · 빛 · 용기' },
          { label: '그림 규칙', text: '점선 원 = 씨앗 껍질, 실선 = 싹, 물결 = 물' },
          { label: '제약 조건', text: '씨앗 20개 · 접시 두 개 · 5일' },
          { label: '검증 기준', text: '냉장고에 둔 씨앗의 결과를 예측해 맞히면 쓸 만하다' },
        ],
      },
      {
        id: 'shadow',
        name: '그림자 길이',
        cards: [
          { label: '관찰 자료', text: '막대 그림자 오전 9시 1.7 m · 정오 0.4 m · 오후 3시 1.5 m' },
          { label: '바꾼 것', text: '시각' },
          { label: '같게 둔 것', text: '막대 길이 · 놓은 자리 · 날짜' },
          { label: '그림 규칙', text: '원 = 태양, 선 = 빛, 굵은 선 = 그림자' },
          { label: '제약 조건', text: '막대 하나 · 줄자 · 하루' },
          { label: '검증 기준', text: '겨울 정오의 그림자 길이를 예측해 맞히면 쓸 만하다' },
        ],
      },
      {
        id: 'dissolve',
        name: '설탕의 용해',
        cards: [
          // wording-ok: 실험 자료 안의 측정 시간 — 앱의 진행 시간이 아니다
          { label: '관찰 자료', text: '찬물에 설탕 다 녹는 데 6분 · 따뜻한 물 1분 30초' },
          { label: '바꾼 것', text: '물의 온도' },
          { label: '같게 둔 것', text: '물의 양 · 설탕의 양 · 젓는 횟수' },
          { label: '그림 규칙', text: '큰 원 = 물 입자, 작은 원 = 설탕 입자, 화살표 길이 = 움직임' },
          { label: '제약 조건', text: '컵 두 개 · 설탕 · 온도계 · 초시계' },
          { label: '검증 기준', text: '가루 설탕과 각설탕의 차이를 예측해 맞히면 쓸 만하다' },
        ],
      },
    ],
    groupNaming: 'fromCards',
    revealText: '상자 여섯 개가 열리고 부품이 하나씩 배달됩니다. 모이면 부품이 합쳐져 모형 틀 하나가 세워집니다.',
  },
  {
    id: '11-analogy',
    lessonId: '11',
    title: '비유 한 벌 모으기',
    doNow: '받은 카드를 읽고, 이것이 비유의 어느 부분인지 생각해 보세요.',
    mode: 'collectSet',
    effectScope:
      '카드는 무작위로 나눠 드렸습니다. 같은 비유의 조각을 가진 분들이 한 모둠입니다. 여러분의 선택은 배정에 영향을 주지 않습니다 — 지난번에 만난 적이 가장 적은 사람끼리 같은 비유를 받습니다.',
    why: '이 차시는 비유를 다룬다. 모은 비유가 그대로 그 모둠의 분석 대상이 된다. 이 카드 구성 자체가 「견주는 대상 · 맞는 곳 · 틀리는 곳」 세 칸 형식이다 — 학생이 모둠을 만드는 동안 그 형식을 한 번 겪는다.',
    cardSets: [
      {
        id: 'circuit-water',
        name: '전기회로와 물 흐름',
        cards: [
          { label: '설명하려는 것', text: '전기회로' },
          { label: '견주는 것', text: '물이 흐르는 관' },
          { label: '맞는 점 ①', text: '전지 ↔ 펌프' },
          { label: '맞는 점 ②', text: '저항 ↔ 좁아진 구간' },
          { label: '어긋나는 점 ①', text: '물은 관 밖으로 샐 수 있지만 전하는 회로를 벗어나지 않는다' },
          { label: '어긋나는 점 ②', text: '물은 눈에 보이지만 전하는 보이지 않는다' },
        ],
      },
      {
        id: 'atom-solar',
        name: '원자와 태양계',
        cards: [
          { label: '설명하려는 것', text: '원자의 구조' },
          { label: '견주는 것', text: '태양계' },
          { label: '맞는 점 ①', text: '원자핵 ↔ 태양 (가운데에 질량이 몰려 있다)' },
          { label: '맞는 점 ②', text: '전자 ↔ 행성 (가운데 둘레를 돈다)' },
          { label: '어긋나는 점 ①', text: '행성은 정해진 궤도를 돌지만 전자는 정해진 길이 없다' },
          { label: '어긋나는 점 ②', text: '행성을 붙드는 것은 중력, 전자를 붙드는 것은 전기력이다' },
        ],
      },
      {
        id: 'cell-factory',
        name: '세포와 공장',
        cards: [
          { label: '설명하려는 것', text: '세포의 구조와 기능' },
          { label: '견주는 것', text: '공장' },
          { label: '맞는 점 ①', text: '핵 ↔ 사무실 (지시가 나온다)' },
          { label: '맞는 점 ②', text: '미토콘드리아 ↔ 발전기 (에너지를 낸다)' },
          { label: '어긋나는 점 ①', text: '공장은 설계도를 밖에서 받지만 세포는 자기 안에 갖고 있다' },
          { label: '어긋나는 점 ②', text: '공장은 스스로 둘로 나뉘지 않는다' },
        ],
      },
      {
        id: 'heat-water',
        name: '열의 이동과 물의 흐름',
        cards: [
          { label: '설명하려는 것', text: '열의 이동' },
          { label: '견주는 것', text: '높은 곳에서 낮은 곳으로 흐르는 물' },
          { label: '맞는 점 ①', text: '온도 차 ↔ 높이 차 (차이가 있어야 흐른다)' },
          { label: '맞는 점 ②', text: '같은 온도가 되면 멈춘다 ↔ 수면이 같아지면 멈춘다' },
          { label: '어긋나는 점 ①', text: '물은 물질이지만 열은 물질이 아니라 에너지의 이동이다' },
          { label: '어긋나는 점 ②', text: '물은 모아 둘 수 있지만 「열」을 모아 둘 수는 없다' },
        ],
      },
      {
        id: 'dna-recipe',
        name: 'DNA 와 요리법',
        cards: [
          { label: '설명하려는 것', text: 'DNA 의 역할' },
          { label: '견주는 것', text: '요리법이 적힌 책' },
          { label: '맞는 점 ①', text: '염기 서열 ↔ 글자의 순서 (순서가 뜻을 정한다)' },
          { label: '맞는 점 ②', text: '복제 ↔ 책을 베끼기 (같은 내용이 늘어난다)' },
          { label: '어긋나는 점 ①', text: '요리법은 요리사가 읽지만 DNA 는 읽는 사람이 없다' },
          { label: '어긋나는 점 ②', text: '책은 베낄 때 틀리면 고치지만 DNA 의 오류는 남을 수 있다' },
        ],
      },
      {
        id: 'sound-wave',
        name: '소리와 물결',
        cards: [
          { label: '설명하려는 것', text: '소리의 전달' },
          { label: '견주는 것', text: '물결' },
          { label: '맞는 점 ①', text: '진동이 퍼진다 ↔ 물결이 퍼진다' },
          { label: '맞는 점 ②', text: '큰 소리 ↔ 높은 물결 (진폭)' },
          { label: '어긋나는 점 ①', text: '물결은 위아래로 흔들리지만 소리는 앞뒤로 빽빽해졌다 성겨진다' },
          { label: '어긋나는 점 ②', text: '물결은 눈에 보이지만 소리의 진동은 보이지 않는다' },
        ],
      },
    ],
    groupNaming: 'fromCards',
    revealText: '카드가 뒤집혀 있다가 한 장씩 열리며 같은 비유끼리 겹쳐지고, 한 벌이 완성되면 그 비유가 앞면에 한 장으로 나타납니다.',
  },
]

export const GROUP_GAME_BY_LESSON: Partial<Record<LessonId, GroupGameDef>> = Object.fromEntries(
  GROUP_GAMES.map((g) => [g.lessonId, g]),
)

/** 기본 회차 — 홀수 차시. 13차시 이후는 11차시 모둠을 이어 쓴다. 강사가 설정에서 바꿀 수 있다. */
export const DEFAULT_FORMATION_LESSONS: LessonId[] = ['01', '03', '05', '07', '09', '11']

/** 기본 모둠 수. 예상 수강 인원 20명 안팎 — 강의자가 정한 값. */
export const DEFAULT_GROUP_COUNT = 4
export const DEFAULT_CLASS_SIZE = 20

/** 입력이 있는 게임인가 — 학생이 고르는 단계가 있다 */
export function gameTakesInput(g: GroupGameDef): boolean {
  return Boolean(g.options && g.options.length > 0)
}

/** 배분형 게임인가 — 카드를 나눠 주는 것이 곧 배정이다 */
export function gameDealsCards(g: GroupGameDef): boolean {
  return Boolean(g.cardSets && g.cardSets.length > 0)
}
