import { handleUpload, type TbEnv } from '../_lib/textbook'

/** PUT /api/textbook/upload?id= — PDF 올리기 · 바꾸기 (강사) — 일은 전부 _lib/textbook 이 한다 (검사가 같은 함수를 부른다) */
export const onRequestPut: PagesFunction<TbEnv> = (ctx) => handleUpload(ctx.env, ctx.request)
