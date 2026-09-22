import type { CourseId } from './types'

/**
 * 모둠 나누기 — 아이스브레이킹 질문 은행 (8차 5.1).
 *
 * 기호를 묻는 질문 하나로 모둠을 나눈다. 같은 답끼리 모으되 동석 최소화는 그대로 돈다.
 * 모둠 이름은 답이다 — 「일본 모둠」 「아이스티 모둠」.
 * 과학 이야기는 넣지 않는다 (verify:groups 가 과학 낱말을 본다).
 * 질문은 학기 안에 되풀이하지 않는다 — 클래스마다 쓴 질문을 기록한다 (ClassDoc.formationQuestions).
 */
export interface FormationQuestion {
  id: string
  question: string
  /** 6~8개. 모둠 수 이상 */
  options: string[]
}

export const FORMATION_QUESTIONS: FormationQuestion[] = [
  { id: 'country', question: '가장 가 보고 싶은 나라는?', options: ['일본', '프랑스', '미국', '스위스', '베트남', '호주', '아이슬란드', '스페인'] },
  { id: 'drink', question: '제일 좋아하는 음료는?', options: ['아메리카노', '라떼', '아이스티', '탄산', '녹차', '주스', '물', '코코아'] },
  { id: 'morning', question: '나는 어느 쪽인가?', options: ['아침형', '저녁형', '새벽형', '그때그때 다름', '점심형', '밤샘형'] },
  { id: 'season', question: '좋아하는 계절은?', options: ['봄', '여름', '가을', '겨울', '늦봄', '초가을'] },
  { id: 'ramen', question: '라면에 꼭 넣는 것은?', options: ['계란', '파', '치즈', '김치', '만두', '떡', '아무것도', '콩나물'] },
  { id: 'trip', question: '여행 가면 먼저 하는 것은?', options: ['맛집 찾기', '숙소에서 쉬기', '시장 구경', '산책', '사진 찍기', '카페 가기', '박물관'] },
  { id: 'fruit', question: '좋아하는 과일은?', options: ['딸기', '수박', '사과', '귤', '포도', '망고', '복숭아', '바나나'] },
  { id: 'movie', question: '영화는 어디서?', options: ['영화관', '집 소파', '침대', '기차 안', '카페', '친구 집'] },
  { id: 'nature', question: '산과 바다 중?', options: ['산', '바다', '강', '호수', '섬', '계곡'] },
  { id: 'pet', question: '강아지와 고양이 중?', options: ['강아지', '고양이', '햄스터', '물고기', '앵무새', '토끼', '없음'] },
  { id: 'app', question: '오늘 가장 오래 쓴 앱은?', options: ['메신저', '유튜브', '인스타그램', '음악', '지도', '쇼핑', '게임', '메모'] },
  { id: 'color', question: '좋아하는 색은?', options: ['파랑', '초록', '검정', '흰색', '보라', '주황', '분홍', '회색'] },
  { id: 'breakfast', question: '아침으로 고른다면?', options: ['밥', '빵', '시리얼', '과일', '커피만', '안 먹음', '죽'] },
  { id: 'weather', question: '좋아하는 날씨는?', options: ['맑음', '비', '눈', '흐림', '바람', '안개'] },
  { id: 'snack', question: '영화 볼 때 간식은?', options: ['팝콘', '나초', '오징어', '초콜릿', '젤리', '안 먹음', '핫도그'] },
  { id: 'seat', question: '카페에서 앉는 자리는?', options: ['창가', '구석', '가운데', '바 자리', '문 옆', '2층', '야외'] },
  { id: 'transport', question: '주로 타는 것은?', options: ['버스', '지하철', '자전거', '걷기', '자동차', '킥보드', '기차'] },
  { id: 'dessert', question: '디저트 하나만 고른다면?', options: ['케이크', '아이스크림', '마카롱', '빙수', '와플', '떡', '푸딩', '쿠키'] },
  { id: 'holiday', question: '쉬는 날 하는 것은?', options: ['늦잠', '운동', '드라마', '친구 만나기', '청소', '요리', '독서', '산책'] },
  { id: 'noodle', question: '면 요리 하나만?', options: ['짜장면', '냉면', '파스타', '쌀국수', '칼국수', '라멘', '우동', '비빔국수'] },
  { id: 'music', question: '공부할 때 소리는?', options: ['조용히', '가사 없는 음악', '가요', '백색소음', '카페 소리', '라디오'] },
  { id: 'time', question: '하루 중 좋아하는 시간은?', options: ['이른 아침', '점심 직후', '해 질 무렵', '밤', '새벽', '오전 열 시쯤'] },
  { id: 'gift', question: '받고 싶은 선물은?', options: ['책', '옷', '먹을 것', '여행', '현금', '공연 표', '문구', '식물'] },
  { id: 'cook', question: '자신 있는 요리는?', options: ['계란 요리', '볶음밥', '라면', '파스타', '찌개', '샐러드', '없음', '김밥'] },
]

export const FORMATION_QUESTION_BY_ID = Object.fromEntries(FORMATION_QUESTIONS.map((q) => [q.id, q])) as Record<string, FormationQuestion>

/**
 * 그 차시의 질문 — 차시 번호 자리에서 시작해 이미 쓴 질문만 건너뛴다.
 *
 * 질문은 모둠을 나누는 차시만이 아니라 매 차시 뜬다 (답하면 출석이다 · 강의자 지시 2026-09-22).
 * 그래서 「아직 안 쓴 첫 질문」으로 고르면 아직 안 나눈 차시가 모두 같은 질문을 보인다.
 * 두 과목을 같이 듣는 학생이 같은 주에 같은 질문을 두 번 받지 않도록 과목마다 시작 자리를 어긋나게 둔다 (8.3).
 * 이 함수는 firebase 를 부르지 않는다 — verify:groups 가 그대로 불러 본다.
 */
export function questionForLessonNumber(lessonNo: number, courseId: CourseId, used: Iterable<string> = []): FormationQuestion {
  const n = FORMATION_QUESTIONS.length
  const taken = new Set(used)
  const offset = courseId === 'method' ? Math.floor(n / 2) : 0
  const start = (offset + Math.max(0, (Number.isFinite(lessonNo) ? lessonNo : 1) - 1)) % n
  for (let k = 0; k < n; k++) {
    const q = FORMATION_QUESTIONS[(start + k) % n]
    if (!taken.has(q.id)) return q
  }
  return FORMATION_QUESTIONS[start]
}
