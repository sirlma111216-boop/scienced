/**
 * 검증기 공통 — 두 과목의 차시를 전부 불러온다 (8차 8.1).
 *
 * 차시 내용은 import() 로 나뉘어 있으므로 검증기는 색인을 돌며 하나씩 불러온다.
 * 앱이 쓰는 그 코드(courses/index.ts 의 loadLesson)를 그대로 부른다.
 */
export async function loadCourses() {
  const { COURSE_IDS, loadAllLessons, lessonIndex, courseTitle } = await import('../src/content/courses/index.ts')
  const out = []
  for (const courseId of COURSE_IDS) {
    out.push({ courseId, title: courseTitle(courseId), index: lessonIndex(courseId), lessons: await loadAllLessons(courseId) })
  }
  return out
}

export async function allLessons() {
  const courses = await loadCourses()
  return courses.flatMap((c) => c.lessons)
}

export const COURSE_SHORT = { method: '교수법', edu: '교육론' }

export function where(lesson) {
  return `${COURSE_SHORT[lesson.courseId] ?? lesson.courseId} ${Number(lesson.id)}강`
}

export async function stepsOf(lesson) {
  const { buildSteps } = await import('../src/content/steps.ts')
  return buildSteps(lesson)
}

/** 활동 목록 — edu80 은 둘 */
export function activitiesOf(lesson) {
  return [lesson.activity, lesson.activity2].filter(Boolean)
}

/** 개념 카드 — edu80 은 두 부 */
export function conceptsOf(lesson) {
  return [...(lesson.concepts ?? []), ...(lesson.concepts2 ?? [])]
}
