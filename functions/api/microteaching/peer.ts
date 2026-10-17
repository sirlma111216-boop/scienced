import { handleMtPeer, type MtEnv } from '../_lib/microteaching'

/** POST /api/microteaching/peer — 다른 수강생의 수업에 훌륭한 점 · 개선점 — 일은 _lib/microteaching 이 한다 (검사가 같은 함수를 부른다). 호출자 확인도 그 안에서 한다 (verify:api ⑤) */
export const onRequestPost: PagesFunction<MtEnv> = (ctx) => handleMtPeer(ctx.env, ctx.request)
