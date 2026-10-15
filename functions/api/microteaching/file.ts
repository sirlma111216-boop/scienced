import { handleMtFile, type MtEnv } from '../_lib/microteaching'

/** GET /api/microteaching/file — 서명된 주소로 양식 · 계획안을 내려보낸다. 서명과 만료를 _lib/microteaching 이 본다 */
export const onRequestGet: PagesFunction<MtEnv> = (ctx) => handleMtFile(ctx.env, ctx.request)
