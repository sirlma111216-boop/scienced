import type { Enrollment, GroupInput, SessionState } from './types'

/**
 * 출석 — 「오늘의 질문」에 답한 사람이 오늘 온 사람이다 (강의자 지시 2026-09-22).
 *
 * 그 목록이 수업의 기준이다. 모둠 배정 대상 · 응답 n/N 의 N · 게임 참가 대상이 모두 이것이다.
 * 수강생 전체를 기준으로 두면 결석자가 늘 「미제출」로 남아 누가 아직 안 냈는지가 보이지 않는다.
 *
 * 기준은 두 가지뿐이다.
 *   ① 그 차시의 groupInputs — 학생이 스스로 남긴다
 *   ② 세션 문서의 손질(attendance) — 답을 못 누른 사람을 강사가 넣거나 뺀 것만 남는다
 * 둘 다 저장되어 있으므로 화면을 새로 고쳐도 같은 목록이 나온다. 손질은 예외 처리이지 기본이 아니다.
 */

export interface AttendanceEdit {
  /** 답을 안 눌렀지만 강사가 출석으로 넣은 사람 */
  in: string[]
  /** 답은 눌렀지만 강사가 뺀 사람 */
  out: string[]
}

export const NO_ATTENDANCE_EDIT: AttendanceEdit = { in: [], out: [] }

/** 세션 문서의 손질을 읽는다. 없으면 빈 손질 */
export function attendanceEdit(raw: SessionState['attendance'] | null | undefined): AttendanceEdit {
  return { in: raw?.in ?? [], out: raw?.out ?? [] }
}

/** 이 차시의 질문에 답한 사람. 강사가 질문을 바꿨어도 답한 사실은 출석이다 */
export function answeredUids(inputs: GroupInput[]): Set<string> {
  return new Set(inputs.map((i) => i.uid))
}

export function isAttending(uid: string, answered: Set<string>, edit: AttendanceEdit): boolean {
  if (edit.out.includes(uid)) return false
  return answered.has(uid) || edit.in.includes(uid)
}

/** 오늘 온 사람 — 명단 순서 그대로 */
export function attendingStudents(students: Enrollment[], inputs: GroupInput[], edit: AttendanceEdit): Enrollment[] {
  const answered = answeredUids(inputs)
  return students.filter((s) => isAttending(s.uid, answered, edit))
}

/**
 * 명단 서랍·모둠 나누기의 체크 하나. 손질만 남긴다 —
 * 답을 누른 사람을 켜 두는 것은 손질이 아니므로 아무것도 적지 않는다.
 */
export function withAttendance(edit: AttendanceEdit, uid: string, answered: boolean, attending: boolean): AttendanceEdit {
  const put = new Set(edit.in)
  const drop = new Set(edit.out)
  if (attending) {
    drop.delete(uid)
    if (answered) put.delete(uid)
    else put.add(uid)
  } else {
    put.delete(uid)
    if (answered) drop.add(uid)
    else drop.delete(uid)
  }
  return { in: [...put], out: [...drop] }
}

/** 학기 출석부 — 차시마다 누가 왔나. 한 사람도 없는 차시는 아직 안 한 차시로 보고 뺀다 */
export function attendanceByLesson(inputs: GroupInput[], sessions: SessionState[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  const at = (lessonId: string) => {
    const cur = out.get(lessonId) ?? new Set<string>()
    out.set(lessonId, cur)
    return cur
  }
  for (const i of inputs) at(i.lessonId).add(i.uid)
  for (const s of sessions) {
    const edit = attendanceEdit(s.attendance)
    if (edit.in.length === 0 && edit.out.length === 0) continue
    const set = at(s.lessonId)
    for (const uid of edit.in) set.add(uid)
    for (const uid of edit.out) set.delete(uid)
  }
  for (const [lessonId, set] of out) if (set.size === 0) out.delete(lessonId)
  return out
}
