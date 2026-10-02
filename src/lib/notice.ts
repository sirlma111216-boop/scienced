/**
 * 전체 공지 — 로그인한 사람 모두에게 한 번 뜨는 창 (강의자 지시 2026-10-02).
 *
 * 공지는 번들에 적는다. 서버 문서가 아니다 — 올리려면 여기에 한 줄을 더하고 배포한다.
 * 띄우는 기간(`from` ~ `until`)이 지나면 저절로 사라지고, [닫기]를 누른 사람에게는 그 기기에서 다시 뜨지 않는다.
 * 화면·저장을 부르지 않는 순수 함수만 둔다 — verify:a11y 「공지」가 그대로 불러 검사한다.
 */
export interface SiteNotice {
  /** 닫은 기록의 열쇠. 내용을 고쳐 다시 띄우려면 id 를 바꾼다 */
  id: string
  title: string
  /** 문단마다 한 줄 */
  body: string[]
  /** 띄우기 시작하는 때 (ISO 8601, 시간대 포함) */
  from: string
  /** 이때부터 뜨지 않는다 */
  until: string
}

export const SITE_NOTICES: SiteNotice[] = [
  {
    id: 'microteaching-apply-1204',
    title: '마이크로티칭 일자 · 주제 신청 안내',
    body: [
      '12월 4일 0시에 마이크로티칭 일자와 주제를 신청하는 창이 이 사이트에 새로 열립니다.',
      '그때 로그인하면 신청 창이 뜹니다. 원하는 일자와 주제를 미리 생각해 두세요.',
    ],
    from: '2026-10-02T00:00:00+09:00',
    until: '2026-10-04T00:00:00+09:00',
  },
]

/** 지금 띄울 공지 — 기간 안에 있고 아직 닫지 않은 것, 적힌 순서대로 */
export function activeNotices(now: number, dismissed: ReadonlySet<string>, notices: SiteNotice[] = SITE_NOTICES): SiteNotice[] {
  return notices.filter((n) => now >= Date.parse(n.from) && now < Date.parse(n.until) && !dismissed.has(n.id))
}

/** 닫은 기록을 두는 자리 — 사람마다 따로다 (같은 기기를 둘이 쓰는 경우) */
export function noticeStorageKey(uid: string): string {
  return `sls.v1.notice.dismissed.${uid}`
}
