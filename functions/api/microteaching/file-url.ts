import { handleMtFileUrl, type MtEnv } from '../_lib/microteaching'

/** POST /api/microteaching/file-url — 양식 · 계획안을 내려받을 10분짜리 주소 — 일은 _lib/microteaching 이 한다 (검사가 같은 함수를 부른다). 호출자 확인도 그 안에서 한다 (verify:api ⑤) */
export const onRequestPost: PagesFunction<MtEnv> = (ctx) => handleMtFileUrl(ctx.env, ctx.request)
