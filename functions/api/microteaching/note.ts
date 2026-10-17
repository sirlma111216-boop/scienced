import { handleMtNote, type MtEnv } from '../_lib/microteaching'

/** POST /api/microteaching/note — 지도안 피드백 · 수업 피드백(강사) · 후기(학생) — 일은 _lib/microteaching 이 한다 (검사가 같은 함수를 부른다). 호출자 확인도 그 안에서 한다 (verify:api ⑤) */
export const onRequestPost: PagesFunction<MtEnv> = (ctx) => handleMtNote(ctx.env, ctx.request)
