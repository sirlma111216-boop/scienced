import { handleReorder, type TbEnv } from '../_lib/textbook'

/** POST /api/textbook/reorder — 한 단원 안의 순서 (강사) — 일은 전부 _lib/textbook 이 한다 (검사가 같은 함수를 부른다) */
export const onRequestPost: PagesFunction<TbEnv> = (ctx) => handleReorder(ctx.env, ctx.request)
