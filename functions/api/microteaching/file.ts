import { handleMtFile, type MtEnv } from '../_lib/microteaching'

/** GET · HEAD /api/microteaching/file — 서명된 주소로 양식 · 지도안 · 수업 영상을 내려보낸다 (Range 지원). 서명과 만료를 _lib/microteaching 이 본다 */
export const onRequestGet: PagesFunction<MtEnv> = (ctx) => handleMtFile(ctx.env, ctx.request)
export const onRequestHead: PagesFunction<MtEnv> = (ctx) => handleMtFile(ctx.env, ctx.request)
