/**
 * Cloudflare Pages Functions 최소 타입.
 *
 * @cloudflare/workers-types 전체를 넣으면 DOM lib 과 충돌한다
 * (같은 이름의 Request/Response/crypto 를 다시 선언한다).
 * 이 앱의 함수가 실제로 쓰는 모양만 여기에 적는다.
 */

interface EventContext<Env, _P extends string = string, _D = unknown> {
  request: Request
  env: Env
  params: Record<string, string | string[]>
  waitUntil(promise: Promise<unknown>): void
  next(): Promise<Response>
}

type PagesFunction<Env = unknown, P extends string = string, D = unknown> = (
  context: EventContext<Env, P, D>,
) => Response | Promise<Response>
