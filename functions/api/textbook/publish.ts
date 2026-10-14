import { handlePublish, type TbEnv } from '../_lib/textbook'

/** POST /api/textbook/publish — 공개 · 비공개 (강사, PDF 가 있어야 공개) — 일은 전부 _lib/textbook 이 한다 (검사가 같은 함수를 부른다) */
export const onRequestPost: PagesFunction<TbEnv> = (ctx) => handlePublish(ctx.env, ctx.request)
