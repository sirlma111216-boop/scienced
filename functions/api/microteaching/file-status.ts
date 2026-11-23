import { handleMtFileStatus, type MtEnv } from '../_lib/microteaching'

/** POST /api/microteaching/file-status — 발표자마다 지도안 · 강의 PT 를 냈는지 (같은 반 · 강사) — 일은 _lib/microteaching 이 한다 (검사가 같은 함수를 부른다). 호출자 확인도 그 안에서 한다 (verify:api ⑤) */
export const onRequestPost: PagesFunction<MtEnv> = (ctx) => handleMtFileStatus(ctx.env, ctx.request)
