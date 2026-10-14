import { handleSave, type TbEnv } from '../_lib/textbook'

/** POST /api/textbook/save — 소단원 만들기 · 제목과 설명 고치기 (강사) — 일은 전부 _lib/textbook 이 한다 (검사가 같은 함수를 부른다) */
export const onRequestPost: PagesFunction<TbEnv> = (ctx) => handleSave(ctx.env, ctx.request)
