import type { CourseId, Lesson, LessonId, LessonIndexEntry } from '../types'
import { METHOD_INDEX, loadMethodLesson } from './method'
import { EDU_INDEX, loadEduLesson } from './edu'
import { THEORY } from '../theory'

/**
 * 두 과목 (8차 8절).
 *   method  교과교수법 18차시
 *   edu     과학교육론 12차시 (1강은 교수법 1강과 같다 — 강의자 답 4)
 *
 * ★ 차시 내용은 `import()` 로 따로 내려온다 (부록 ①). 번들 하나에 18+12차시가 다 들어가면
 *   미공개 차시도 개발자 도구로 읽힌다. 색인(제목·중심 질문·골격)만 앞에 있고, 내용은
 *   공개된 차시이거나 강사일 때만 불러온다.
 */
export interface CourseDef {
  id: CourseId
  title: string
  short: string
  index: LessonIndexEntry[]
  load: (id: LessonId) => Promise<Lesson | undefined>
}

export const COURSES: Record<CourseId, CourseDef> = {
  method: { id: 'method', title: '과학교과교수법', short: '교수법', index: METHOD_INDEX, load: loadMethodLesson },
  edu: { id: 'edu', title: '과학교육론', short: '교육론', index: EDU_INDEX, load: loadEduLesson },
}

export const COURSE_IDS: CourseId[] = ['method', 'edu']

export function courseTitle(id: CourseId): string {
  return COURSES[id].title
}

/** 클래스의 강의 제목에서 과목을 알아낸다 — 옛 클래스 문서에는 courseId 가 없다 */
export function courseIdFromTitle(title: string | undefined): CourseId {
  return /교육론/.test(title ?? '') ? 'edu' : 'method'
}

export function lessonIndex(courseId: CourseId): LessonIndexEntry[] {
  return COURSES[courseId].index
}

export function indexEntry(courseId: CourseId, id: LessonId): LessonIndexEntry | undefined {
  return COURSES[courseId].index.find((l) => l.id === id)
}

/** 이론 배경(5차)은 content/theory 에 있다. 불러올 때 붙인다 */
const cache = new Map<string, Promise<Lesson | undefined>>()

export function loadLesson(courseId: CourseId, id: LessonId): Promise<Lesson | undefined> {
  const key = `${courseId}:${id}`
  let p = cache.get(key)
  if (!p) {
    p = COURSES[courseId].load(id).then((l) => {
      if (!l) return undefined
      const t = THEORY[courseId]?.[l.id]
      return t && !l.theory ? { ...l, theory: t } : l
    })
    cache.set(key, p)
  }
  return p
}

/** 검증기·검사용 — 과목의 모든 차시를 한꺼번에 */
export async function loadAllLessons(courseId: CourseId): Promise<Lesson[]> {
  const out: Lesson[] = []
  for (const e of COURSES[courseId].index) {
    const l = await loadLesson(courseId, e.id)
    if (l) out.push(l)
  }
  return out
}
