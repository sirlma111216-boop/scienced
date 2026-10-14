import { handleDelete, type TbEnv } from '../_lib/textbook'

/** POST /api/textbook/delete — 목차와 쓰지 않게 된 파일 지우기 (강사) — 일은 전부 _lib/textbook 이 한다 (검사가 같은 함수를 부른다) */
export const onRequestPost: PagesFunction<TbEnv> = (ctx) => handleDelete(ctx.env, ctx.request)
