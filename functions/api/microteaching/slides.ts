import { handleMtUpload, type MtEnv } from '../_lib/microteaching'

/** PUT /api/microteaching/slides?classId= — 내 강의용 PT 올리기 (신청한 본인, 파워포인트 · PDF) — 일은 _lib/microteaching 이 한다 (검사가 같은 함수를 부른다). 호출자 확인도 그 안에서 한다 (verify:api ⑤) */
export const onRequestPut: PagesFunction<MtEnv> = (ctx) => handleMtUpload(ctx.env, ctx.request, 'slides')
