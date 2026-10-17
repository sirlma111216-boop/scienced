import { handleMtVideoAbort, type MtEnv } from '../_lib/microteaching'

/** POST /api/microteaching/video-abort — 그만둔 조각 치우기 (강사) — 일은 _lib/microteaching 이 한다 (검사가 같은 함수를 부른다). 호출자 확인도 그 안에서 한다 (verify:api ⑤) */
export const onRequestPost: PagesFunction<MtEnv> = (ctx) => handleMtVideoAbort(ctx.env, ctx.request)
