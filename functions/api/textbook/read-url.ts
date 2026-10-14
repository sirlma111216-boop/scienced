import { handleReadUrl, type TbEnv } from '../_lib/textbook'

/** POST /api/textbook/read-url — PDF 를 읽을 짧은 주소 (로그인한 사람 · 비공개는 강사만) — 일은 전부 _lib/textbook 이 한다 (검사가 같은 함수를 부른다) */
export const onRequestPost: PagesFunction<TbEnv> = (ctx) => handleReadUrl(ctx.env, ctx.request)
