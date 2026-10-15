import { handleMtDetail, type MtEnv } from '../_lib/microteaching'

/** POST /api/microteaching/detail — 발표 소재 · 수업 방식 (신청한 본인) — 일은 _lib/microteaching 이 한다 (검사가 같은 함수를 부른다). 호출자 확인도 그 안에서 한다 (verify:api ⑤) */
export const onRequestPost: PagesFunction<MtEnv> = (ctx) => handleMtDetail(ctx.env, ctx.request)
