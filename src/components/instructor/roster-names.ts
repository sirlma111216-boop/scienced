import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import type { RosterEntry } from '@/lib/types'

/**
 * 명단의 실명 — 강사 화면에서만 부른다.
 *
 * 실명은 classes/{cid}/roster 에만 있고 학생은 읽지 못한다(보안 규칙). 이 훅은 강사가 아니면 구독하지 않는다.
 * 학생·강사가 같이 쓰는 화면이 실명을 다루려면 이 훅으로만 받는다 — verify:classes 「실명 보호」가 rosterName 을 만지는 파일을 센다.
 */
export function useRosterNames(classId: string): (uid: string) => string {
  const { repo, isInstructor } = useAuth()
  const [roster, setRoster] = useState<RosterEntry[]>([])
  useEffect(() => {
    if (!repo || !classId || !isInstructor) {
      setRoster([])
      return
    }
    return repo.watchRoster(classId, setRoster)
  }, [repo, classId, isInstructor])
  return useCallback((uid: string) => roster.find((r) => r.uid === uid)?.rosterName ?? '', [roster])
}
