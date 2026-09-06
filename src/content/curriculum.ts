/**
 * 교육과정 메타데이터.
 *
 * 컨텍스트 13.4 가 요구한 대로 일곱 가지를 따로 저장한다.
 *   교육과정 판 · 학교급 · 학년 · 영역 · 성취기준 · 핵심 아이디어 · 적용 연도
 *
 * 2026년 현재 학교에는 2022 개정 적용 학년과 이전 교육과정 적용 학년이 함께 있다.
 * 그래서 단원 이름이 같아도 같은 교육과정이 아니다. 자료를 볼 때 발행 연도와
 * 적용 학년을 먼저 확인하는 습관을 이 데이터 구조가 강제한다.
 *
 * ⚠ 아래 성취기준 문장은 전부 `verified: false` 다.
 *   NCIC 원문과 대조하기 전에는 화면에 「대표 예시」로 표시되고 코드가 붙지 않는다.
 *   대조를 마친 항목만 code 를 채우고 verified 를 켠다. verify:standards 가 이 순서를 지킨다.
 */

export type CurriculumEdition = '2015 개정' | '2022 개정'
export type SchoolLevel = '중학교' | '고등학교'

export interface Standard {
  id: string
  edition: CurriculumEdition
  level: SchoolLevel
  /** 학년군 또는 과목 */
  grade: string
  domain: string
  /** 성취기준 문장 */
  text: string
  /** 원문 대조를 마친 뒤에만 채운다 */
  code: string | null
  bigIdea: string
  /** 지식·이해 / 과정·기능 / 가치·태도 각각에서 요구하는 것 */
  categories: { knowledge: string; practice: string; value: string }
  /** 이 성취기준 앞에 와야 하는 개념 */
  prerequisites: string[]
  /** 이 성취기준 뒤에 오는 개념 */
  next: string[]
  appliedFrom: number
  verified: boolean
}

export const DOMAINS = ['운동과 에너지', '물질', '생명', '지구와 우주', '과학과 사회'] as const

export const STANDARDS: Standard[] = [
  {
    id: 'std-motion-1',
    edition: '2022 개정',
    level: '중학교',
    grade: '1~3학년',
    domain: '운동과 에너지',
    text: '물체의 운동을 시간과 위치로 나타내고, 운동 상태가 변하는 까닭을 힘과 관련지어 설명한다.',
    code: null,
    bigIdea: '물체의 운동 상태 변화는 물체에 작용하는 힘으로 설명된다.',
    categories: {
      knowledge: '힘, 속력, 운동 상태의 변화',
      practice: '위치－시간 자료를 해석하고 힘 화살표로 모형화한다',
      value: '측정값을 정직하게 기록하고 예외를 임의로 버리지 않는다',
    },
    prerequisites: ['위치와 거리', '시간 측정'],
    next: ['등가속도 운동', '뉴턴 운동 법칙'],
    appliedFrom: 2025,
    verified: false,
  },
  {
    id: 'std-particle-1',
    edition: '2022 개정',
    level: '중학교',
    grade: '1~3학년',
    domain: '물질',
    text: '기체의 압력과 부피의 관계를 실험으로 확인하고 입자 모형으로 설명한다.',
    code: null,
    bigIdea: '물질의 거시적 성질은 입자의 배열과 운동으로 설명된다.',
    categories: {
      knowledge: '입자 모형, 압력, 부피',
      practice: '변인을 통제해 자료를 얻고 입자 그림으로 번역한다',
      value: '모형의 한계를 밝히고 과장하지 않는다',
    },
    prerequisites: ['물질의 상태', '입자의 운동'],
    next: ['기체 법칙', '분자 운동론'],
    appliedFrom: 2025,
    verified: false,
  },
  {
    id: 'std-photosynthesis-1',
    edition: '2022 개정',
    level: '중학교',
    grade: '1~3학년',
    domain: '생명',
    text: '광합성에 필요한 물질과 생성물을 자료로 확인하고, 식물 몸을 이루는 물질의 출처를 설명한다.',
    code: null,
    bigIdea: '생물은 물질을 주고받으며 에너지를 전환해 생명을 유지한다.',
    categories: {
      knowledge: '광합성, 물질의 이동과 전환',
      practice: '기체 자료를 해석해 탄소의 경로를 추적한다',
      value: '생태계 문제에 근거를 가지고 참여한다',
    },
    prerequisites: ['세포', '기체의 성질'],
    next: ['세포호흡', '생태계 물질 순환'],
    appliedFrom: 2025,
    verified: false,
  },
  {
    id: 'std-ecosystem-1',
    edition: '2022 개정',
    level: '중학교',
    grade: '1~3학년',
    domain: '생명',
    text: '자료를 수집하여 생태계 구성 요소의 관계를 설명한다.',
    code: null,
    bigIdea: '생태계에서 물질은 순환하고 에너지는 한 방향으로 전달된다.',
    categories: {
      knowledge: '생물적·비생물적 요소, 먹이 관계',
      practice: '제한된 관찰에서 과한 일반화를 하지 않고 관계의 방향과 불확실성을 말한다',
      value: '지역 환경 문제를 자기 문제로 다룬다',
    },
    prerequisites: ['생물의 분류', '광합성'],
    next: ['물질 순환과 에너지 흐름', '생태계 평형'],
    appliedFrom: 2025,
    verified: false,
  },
  {
    id: 'std-season-1',
    edition: '2022 개정',
    level: '중학교',
    grade: '1~3학년',
    domain: '지구와 우주',
    text: '지구의 자전축 기울기와 공전으로 계절 변화가 생기는 까닭을 모형으로 설명한다.',
    code: null,
    bigIdea: '지구와 천체의 상대적 위치와 운동이 관측되는 현상을 만든다.',
    categories: {
      knowledge: '자전축 기울기, 태양 고도, 낮의 길이',
      practice: '관찰자 시점과 우주 시점을 오가며 같은 사건을 표현한다',
      value: '반례를 만났을 때 설명을 수정한다',
    },
    prerequisites: ['지구의 자전과 공전', '태양 고도'],
    next: ['기후와 위도', '천체의 일주 운동'],
    appliedFrom: 2025,
    verified: false,
  },
  {
    id: 'std-circuit-1',
    edition: '2022 개정',
    level: '중학교',
    grade: '1~3학년',
    domain: '운동과 에너지',
    text: '전기 회로에서 전류와 전압, 저항의 관계를 실험으로 확인하고 모형으로 설명한다.',
    code: null,
    bigIdea: '에너지는 전달·전환되며 그 과정에서 총량은 보존된다.',
    categories: {
      knowledge: '전류, 전압, 저항, 전하의 보존',
      practice: '여러 지점의 측정값을 비교해 전하 흐름 모형을 수정한다',
      value: '측정 결과가 예상과 달라도 자료를 버리지 않는다',
    },
    prerequisites: ['전기와 자기의 기초'],
    next: ['전기 에너지', '옴의 법칙 정량 관계'],
    appliedFrom: 2025,
    verified: false,
  },
  {
    id: 'std-climate-1',
    edition: '2022 개정',
    level: '고등학교',
    grade: '통합과학',
    domain: '과학과 사회',
    text: '기후 변화 자료를 해석하고 지역 사회의 대응 방안을 근거를 들어 제안한다.',
    code: null,
    bigIdea: '지구 시스템의 변화는 인간 활동과 상호작용한다.',
    categories: {
      knowledge: '온실효과, 복사 평형, 기후와 날씨의 차이',
      practice: '시계열 자료의 기간과 범위를 확인하고 외삽의 위험을 판단한다',
      value: '조건부 결론을 밝히고 소수 관점을 고려한다',
    },
    prerequisites: ['지구 시스템', '에너지 수지'],
    next: ['환경 정의', '지속가능한 발전'],
    appliedFrom: 2025,
    verified: false,
  },
  {
    id: 'std-legacy-motion',
    edition: '2015 개정',
    level: '중학교',
    grade: '1~3학년',
    domain: '운동과 에너지',
    text: '물체의 운동을 속력으로 나타내고 등속 운동을 그래프로 표현한다.',
    code: null,
    bigIdea: '(2015 개정에는 핵심 아이디어 진술이 이 형태로 제시되지 않는다)',
    categories: {
      knowledge: '속력, 등속 운동',
      practice: '그래프로 표현한다',
      value: '(가치·태도 범주가 별도로 제시되지 않는다)',
    },
    prerequisites: ['거리와 시간'],
    next: ['운동과 힘'],
    appliedFrom: 2018,
    verified: false,
  },
]

export function searchStandards(q: {
  edition?: CurriculumEdition | ''
  level?: SchoolLevel | ''
  domain?: string
  text?: string
}): Standard[] {
  return STANDARDS.filter((s) => {
    if (q.edition && s.edition !== q.edition) return false
    if (q.level && s.level !== q.level) return false
    if (q.domain && s.domain !== q.domain) return false
    if (q.text) {
      const needle = q.text.trim()
      if (!needle) return true
      const hay = `${s.text} ${s.bigIdea} ${s.domain} ${s.prerequisites.join(' ')} ${s.next.join(' ')}`
      if (!hay.includes(needle)) return false
    }
    return true
  })
}
