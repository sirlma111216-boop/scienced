import { handleFile, type TbEnv } from '../_lib/textbook'

/** GET · HEAD /api/textbook/file?id&exp&m&sig — 서명된 주소로 PDF 를 흘려보낸다 (Range 지원). 일은 _lib/textbook 이 한다 */
export const onRequestGet: PagesFunction<TbEnv> = (ctx) => handleFile(ctx.env, ctx.request)
export const onRequestHead: PagesFunction<TbEnv> = (ctx) => handleFile(ctx.env, ctx.request)
