import { handleMtUpload, type MtEnv } from '../_lib/microteaching'

/** PUT /api/microteaching/template?classId= — 수업계획안 양식 올리기 (강사) — 일은 _lib/microteaching 이 한다 (검사가 같은 함수를 부른다). 호출자 확인도 그 안에서 한다 (verify:api ⑤) */
export const onRequestPut: PagesFunction<MtEnv> = (ctx) => handleMtUpload(ctx.env, ctx.request, 'template')
