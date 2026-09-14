# 이 저장소에서 일하는 방식

## 「완료」라고 말하기 전에

검증기 13종은 **소스의 불변식**만 본다. 실제로 터진 버그는 전부 그 바깥, **이음매**에 있었다.

| 터진 것 | 검증기가 못 잡은 이유 |
|---|---|
| 서버 호출 6곳에 인증 토큰 누락 | 문법은 멀쩡하다. 실행해야 드러난다 |
| 로그인 전 구독이 죽어 영영 안 붙음 | 타이밍. 정적 검사로 안 보인다 |
| 서비스 계정 IAM 역할 누락 | 코드 밖의 일 |
| 클래스 삭제 기능 자체가 없음 | 없는 것을 검사기가 알 리 없다 |
| 삭제가 왕복 190번이라 몇 분 걸림 | 동작은 한다. 느릴 뿐이다 |

그래서 기능을 만들거나 고친 뒤에는 **반드시** 이 순서를 지킨다.

1. **앱이 실제로 쓰는 코드를 그대로 불러** 에뮬레이터에서 통과시킨다.
   검사용으로 다시 쓴 코드를 검사하면 아무것도 보장하지 않는다.
   본보기: `scripts/test-delete.mjs` — `createFirestoreRepo` 를 직접 부른다.
2. **반복 왕복이 있는 동작은 시간을 재고 상한을 검사에 넣는다.**
   화면에서 끝나지 않는 것처럼 보이는 순간부터는 동작하지 않는 것과 같다.
3. 배포가 필요한 변경은 **배포된 번들에 그 코드가 들어갔는지 확인**한 뒤에 완료라고 말한다.

## 조용한 실패를 만들지 마라

이 앱은 수업 중에 멈추면 안 되므로 실패를 삼키는 자리가 많다.
그것이 원인을 감춘 사고가 반복됐다.

- `catch { cb([]) }` — 「없음」과 「읽지 못함」이 화면에서 같아 보인다
- 서버 함수의 `200 + ok:false` — 엣지가 5xx 본문을 덮어쓰기 때문에 필요하지만,
  화면이 `ok` 만 읽고 `message`·`failures` 를 버리면 원인이 사라진다
- 응답 결과를 확인하지 않는 `await fetch(...)`

삼켜야 한다면 **콘솔에 이유를 남기고**, 화면에는 다음에 할 일을 적는다.

## 서버 호출

`fetch('/api/…')` 를 직접 부르지 않는다. `src/lib/api.ts` 의 `apiPost` 만 쓴다.
토큰을 붙이는 일이 한 곳에만 있어야 한다. `verify:api` 가 우회를 막는다.

## 외부 설정

**역할을 주는 것과 API 를 켜는 것은 다른 일이다.** 둘 다 해야 한다.
역할만 있고 API 가 꺼져 있으면 403 `API has not been used in project ... or it is disabled` 가 온다.
Vertex AI 는 무료 등급이 없어 결제 계정도 연결되어 있어야 한다.

서비스 계정 하나가 세 가지를 한다. IAM 역할도 셋 다 있어야 한다.

| 하는 일 | 역할 |
|---|---|
| AI 프록시 (Vertex AI) | `Vertex AI 사용자` |
| 학생 계정 만들기 | `Firebase 인증 관리자` |
| 명단 문서 저장 (Firestore) | `Cloud Datastore 사용자` |

하나라도 빠지면 **그 기능만** 조용히 막힌다.
외부 설정이 걸린 기능은 코드를 끝까지 따라가 필요한 것을 **처음에 전부** 알려 준다.

## 모둠 나누기 (6차)

배정 계산은 **`shared/groups-core.ts` 하나**다. 서버 함수(`/api/groups/assign`)·강사 화면(로컬 모드)·`verify:groups` 가 같은 코드를 쓴다.

- **회차마다 따로 최적화하지 않는다.** 그렇게 하면 1~3회차는 0이지만 5~6회차에서 만날 사람이 다 떨어진다.
  남은 회차 전체를 한꺼번에 짜고(`planSchedule`), 이번 회차는 그 계획의 첫 장을 쓴다. 계획은 회차 문서의
  `plannedNext` 에 저장돼 다음 회차가 거기서 출발한다. 제약이 없으면 계획에서 벗어나지 않는다 —
  「이번 회차만 보면 한 번 덜 만난다」며 벗어나면 뒤 회차가 전부 어긋난다(계획 8회 → 실행 17회로 실측).
- **N.5 의 공식은 필요조건이다.** 20명×5모둠×6회는 공식상 0 이지만 6회째에 반드시 중복이 생긴다(5-4-6 배치는 없다).
  강사 화면은 공식과 함께 계획기가 실제로 짠 예상 중복을 보인다. 30명×6모둠×6회에서 이 계획기는 8~11회다 — 0 이 아니다.
- Firestore 는 배열 속 배열을 못 담는다. 계획은 `encodePlan` 으로 싸서 저장한다.
- 닉네임의 출처는 등록 문서다. `users` 는 본인·강사만 읽는다.

## 진행 콘솔 (7차)

콘솔은 **`src/lib/console-registry.ts`** 의 등록표에서 그려진다 — 학생 화면과 같은 블록 정의를 읽고, 블록 종류마다 정해진 조작부만 그린다.
학생 화면과 콘솔을 따로 만들어 여섯 차례 변경 동안 어긋났던 것을 이렇게 끝냈다.

- 새 블록 종류를 만들면 등록표에 한 줄을 더한다. 콘솔 코드(`Live.tsx`)를 따로 고치지 않는다.
- 콘솔에는 수업 중에 누르는 것만 둔다. 블록 추가·삭제·순서 바꾸기는 편집 화면 소관이다.
- **강사 대본은 어디에도 그리지 않는다.** `instructorScript` 필드는 남아 있지만 `MustSay` 는 지웠다.
- 이름: 기본은 강사가 적은 이름(`rosterName`), 없으면 닉네임. **발표 모드거나 「실명 가리기」가 켜지면 닉네임만** (`components/console/shared.tsx` 의 `useNames`).
- `npm run audit:console` 이 18차시 블록과 등록표를 대조해 `docs/7차-콘솔-대조표.md` 를 만든다.

## 루미 런 — 3·4강 발표자 선정 게임

3·4강의 발표자 뽑기(`03-lumi-race` 먼저 도착 · `04-lumi-last` 꼴찌)는 따로 배포된 게임(저장소 `sirlma111216-boop/gamerun`, Render)을 iframe 으로 붙인다. 화면 쪽은 `src/lib/lumi.ts` · `src/components/lumi/`, 서버 쪽은 `functions/api/lumi/`.

- **발표자는 webhook 으로만 확정된다.** 브라우저의 `lumi:result` 는 「확인 중」으로만 보이고, 게임 서버가 서명해 `/api/lumi/result` 로 보낸 결과가 세션(`lumi.result` · `ladders[gameId].winnerUids`) · `lumiResults` · `picks` · `participation.presentCount` 에 적힌다. 같은 경기는 한 번만 센다.
- 학생은 코드·닉네임을 넣지 않는다. 강사가 「게임 방 만들기」를 누르면 세션 `lumi.roomCode` 가 적히고, 학생 화면은 `/api/lumi/ticket` 으로 자기 티켓을 받아 저절로 들어간다. 티켓은 현재 활동(`activityInstanceId`)에만 나온다.
- 동점은 공동 선정이다(N명을 요청해도 더 뽑힐 수 있다). 완주가 없으면 빈 결과를 그대로 적는다 — 임의로 채우지 않는다.
- **외부 설정 셋이 다 있어야 한다.** Cloudflare `LUMI_SHARED_SECRET` / Render `LESSON_SHARED_SECRET`(같은 값) · `LESSON_RESULT_URL`. 게임 주소는 `src/lib/lumi.ts` 의 `LUMI_DEFAULT_ORIGIN`(https://gamerun-mlhh.onrender.com)이고 `VITE_LUMI_ORIGIN` 은 옮길 때만. 게임 `/health` 의 `lesson.configured` · `resultUrl` 로 Render 쪽을 확인한다. Render 의 `ALLOWED_ORIGINS` 는 두지 않는다(WebSocket 은 iframe 이 있는 게임 origin 에서 오므로 기본 같은-host 검사로 충분하고, 강의 앱 주소만 넣으면 오히려 막힌다).
- 로컬 저장 모드에서는 서버 함수가 없으므로 티켓을 브라우저가 `local-dev` 비밀로 만든다(`fetchTicket`). 게임 서버를 `LESSON_SHARED_SECRET=local-dev` 로 띄우면 방 만들기·자동 참가·경기까지 돈다. webhook 은 `npm run test:lumi` 가 **그 함수 그대로** 에뮬레이터에 대고 확인한다.

## 강의 콘텐츠를 고칠 때

강의자가 **「3, 4강을 지난 강의들처럼 일괄로 수정해」** 라고 하면
**`docs/강의-일괄-수정-기준.md`** 대로 한다. 무엇을 고쳐야 하는지 다시 묻지 않는다.

1·2강은 실제 수업에 쓰면서 강의자의 지시로 열두 가지를 고쳤다.
그 열두 가지에 5차 지시서의 이론 배경(F)과 50분 판 규칙(G)을 더해 항목 A1~G3 으로 정리돼 있고, **`npm run audit:lesson -- 03` 이 그것을 센다.**
문서와 스크립트가 어긋나면 스크립트가 맞다 — 문서를 고친다.

## 검사 명령

```bash
npm run verify        # 17종 — 소스 불변식
npm run typecheck
npm run lint
npm run audit:lesson  # 차시가 1·2강 기준(A~G)에 맞는가 (인수 없으면 18차시 요약)
npm run verify:theory # 이론 배경 — 깨진 인명 표기 · 확인 중 배지 · 카드 연결 · 팝오버 (5차)
npm run verify:groups # 모둠 나누기 — 게임 6종 · 모의 실행 1000번 (SIM_RUNS 로 조절) · 접근성 (6차)
npm run emulators     # 아래 둘의 선행
npm run test:rules    # 보안 규칙을 실제로 읽고 써 본다
npm run test:writes   # 앱이 쓰는 코드로 실제 저장·모둠·덮어쓰기·내보내기
npm run test:delete   # 지우기가 하위 자료까지 치우는지 + 걸리는 시간
npm run test:lumi     # 루미 런 결과 webhook 함수를 그대로 불러 발표자 저장·멱등·거절을 본다
```
