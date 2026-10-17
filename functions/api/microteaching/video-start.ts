import { handleMtVideoStart, type MtEnv } from '../_lib/microteaching'

/** POST /api/microteaching/video-start — 수업 영상 조각 올리기 시작 (강사) — 일은 _lib/microteaching 이 한다 (검사가 같은 함수를 부른다). 호출자 확인도 그 안에서 한다 (verify:api ⑤) */
export const onRequestPost: PagesFunction<MtEnv> = (ctx) => handleMtVideoStart(ctx.env, ctx.request)
