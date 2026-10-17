import { handleMtVideoFinish, type MtEnv } from '../_lib/microteaching'

/** POST /api/microteaching/video-finish — 조각을 합쳐 연결 (강사) — 일은 _lib/microteaching 이 한다 (검사가 같은 함수를 부른다). 호출자 확인도 그 안에서 한다 (verify:api ⑤) */
export const onRequestPost: PagesFunction<MtEnv> = (ctx) => handleMtVideoFinish(ctx.env, ctx.request)
