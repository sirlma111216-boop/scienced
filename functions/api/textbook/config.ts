import { handleConfig, type TbEnv } from '../_lib/textbook'

/** POST /api/textbook/config — 올릴 수 있는 크기와 저장소 준비 상태 (강사) — 일은 전부 _lib/textbook 이 한다 (검사가 같은 함수를 부른다) */
export const onRequestPost: PagesFunction<TbEnv> = (ctx) => handleConfig(ctx.env, ctx.request)
