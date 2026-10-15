import { handleMtUpload, type MtEnv } from '../_lib/microteaching'

/** PUT /api/microteaching/plan?classId= — 내 수업계획안 올리기 (신청한 본인, 양식이 올라온 뒤) — 일은 _lib/microteaching 이 한다 (검사가 같은 함수를 부른다). 호출자 확인도 그 안에서 한다 (verify:api ⑤) */
export const onRequestPut: PagesFunction<MtEnv> = (ctx) => handleMtUpload(ctx.env, ctx.request, 'plan')
