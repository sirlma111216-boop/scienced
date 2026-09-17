import { useEffect, useState } from 'react'
import type { CourseId, Lesson, LessonId } from '@/content/types'
import { courseIdFromTitle, loadLesson } from '@/content/courses'
import type { ClassDoc } from './types'

/**
 * 차시 내용 불러오기 (8차 부록 ①).
 *
 * 내용은 import() 로 따로 내려온다. 이 훅은 그것을 화면에 이어 준다.
 * 미공개 차시는 학생 화면이 아예 부르지 않는다 — 부르는 쪽(Lesson.tsx)이 공개 여부를 먼저 본다.
 */
export function useLesson(courseId: CourseId | null, id: LessonId | null, enabled = true): { lesson: Lesson | null; loading: boolean; error: string | null } {
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId || !id || !enabled) {
      setLesson(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    loadLesson(courseId, id)
      .then((l) => {
        if (cancelled) return
        setLesson(l ?? null)
        if (!l) setError('그 차시가 없습니다.')
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[차시] 불러오지 못했다:', err)
        setError('차시를 불러오지 못했습니다. 새로고침해 보세요.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [courseId, id, enabled])

  return { lesson, loading, error }
}

/** 클래스의 과목. 옛 클래스 문서에는 courseId 가 없다 — 강의 제목에서 알아낸다 */
export function courseOf(cls: ClassDoc | null | undefined): CourseId {
  return cls?.courseId ?? courseIdFromTitle(cls?.courseTitle)
}
