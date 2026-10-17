import { handleMtPeerList, type MtEnv } from '../_lib/microteaching'

/** POST /api/microteaching/peer-list — 발표자(익명 번호) · 강사(이름)가 받는 동료 의견 목록 — 일은 _lib/microteaching 이 한다 (검사가 같은 함수를 부른다). 호출자 확인도 그 안에서 한다 (verify:api ⑤) */
export const onRequestPost: PagesFunction<MtEnv> = (ctx) => handleMtPeerList(ctx.env, ctx.request)
