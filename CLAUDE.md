# 이 저장소에서 일하는 방식

## 「완료」라고 말하기 전에

검증기 19종은 **소스의 불변식**만 본다. 실제로 터진 버그는 전부 그 바깥, **이음매**에 있었다.

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
   본보기: `scripts/test-writes.mjs` — `createFirestoreRepo` 와 `game-core` 를 직접 부른다.
2. **반복 왕복이 있는 동작은 시간을 재고 상한을 검사에 넣는다.**
3. 배포가 필요한 변경은 **배포된 번들에 그 코드가 들어갔는지 확인**한 뒤에 완료라고 말한다.

## 조용한 실패를 만들지 마라

- `catch { cb([]) }` — 「없음」과 「읽지 못함」이 화면에서 같아 보인다
- 서버 함수의 `200 + ok:false` — 화면이 `ok` 만 읽고 `message` 를 버리면 원인이 사라진다
- 응답 결과를 확인하지 않는 `await fetch(...)`

삼켜야 한다면 **콘솔에 이유를 남기고**, 화면에는 다음에 할 일을 적는다.

## 서버 호출

`fetch('/api/…')` 를 직접 부르지 않는다. `src/lib/api.ts` 의 `apiPost` 만 쓴다. `verify:api` 가 우회를 막는다.

## 외부 설정

**역할을 주는 것과 API 를 켜는 것은 다른 일이다.** 둘 다 해야 한다. Vertex AI 는 결제 계정도 필요하다.

| 하는 일 | 역할 |
|---|---|
| AI 프록시 (Vertex AI) | `Vertex AI 사용자` |
| 학생 계정 만들기 | `Firebase 인증 관리자` |
| 명단 문서 저장 (Firestore) | `Cloud Datastore 사용자` |

## 차시 콘텐츠 (8차)

지시서는 `docs/8차_변경지시서_전면개편.md`, 판단이 갈린 것은 **`docs/검토/8차-결정.md`** 에 「이렇게 정했다, 이유는」으로 적는다. 그때그때 강의자에게 묻지 않는다.

**차시 하나를 쓰는 순서** — 문서가 먼저다.
1. `docs/검토/<과목>-<nn>.md` 를 지시서 10.1 의 꼴로 쓴다 (본보기 `docs/검토/method-01.md`).
2. `src/content/courses/<과목>/lesson<nn>.ts` 로 옮긴다 (본보기 `method/lesson01.ts`). 색인(`index.ts`)에 한 줄, loaders 에 한 줄.
3. `npm run verify` — `audit:draft` 가 문서와 코드를 대조하고, `verify:flow` · `verify:concepts` · `audit:activity` · `verify:wording` 이 꼴을 본다.

지켜야 하는 꼴 (검증기가 센다):
- 개념 카드: `what` 3~4문장 · `why` 2~3 · `inClass` 3~4 · `keyPoints` 3줄은 「~이 아니라 ~다」「~이면 ~다」「~를 보면 ~를 알 수 있다」 꼴의 완전한 문장.
- 잠깐 확인: 카드마다 4지선다 하나, **이유 칸 없음**. 검토 문서 카드 끝의 「확인」 블록에 먼저 쓰고 `npm run sync:checks -- <과목>-<nn>` 으로 옮긴다. 장면을 주고 묻는다(정의 되묻기·부정 물음 금지) · 보기 길이가 비슷하다(긴 보기가 답이 되는 버릇 금지) · 정답 자리가 고르다 — `verify:concepts` 가 센다.
- 활동: 상황 200~400자 + 「수업용으로 만든 가상 자료」 꼬리표 · 명령형 과제 한 문장 · 칸 1~2 · 네 검사(정답·갈림·이해·상황)를 코드 주석과 `checks` 양쪽에.
- 글: 어미 「~다」「~하세요」만 · 문장 60자 · 문단 4문장 · 정의 → 예 · 비유·구호·다짐·장식 기호 없음.
- 모둠 데이터 형식은 연속 차시에 같지 않게, 배분은 학기당 3회 이하. 게임은 6.3 배치표.
- 두 과목은 자료·상황·과제·개념 문장을 공유하지 않는다 (1강 제외). `verify:course` 가 문장 단위로 본다.

## 수업 화면 (8차)

**강사 홈(`/instructor/classes`)은 지금 클래스의 차시 목록이다** — 이어서 할 차시 하나와 [수업 열기]가 가장 크고, 명단·모둠·등록·보관·지우기·새 클래스는 「클래스 관리」(`/instructor/class/:classId/{students,groups,settings}`) 탭 셋에 있다 (강의자 지시 2026-09-21). 학기에 한 번 쓰는 것을 홈에 두지 않는다.

강사는 **`/teach/:classId/:lessonId` 화면 하나**로 가르친다. `src/components/lesson/LessonBody.tsx` 가 학생 화면과 강사 화면을 같은 블록으로 그리고, `src/lib/teach-registry.ts` 의 등록표가 블록 종류마다 조작부를 정한다. 강사용 화면을 따로 만들지 않는다.

- 수업 중 누르는 것은 다섯 가지뿐이다: `단계 열기` · `자료 공개` · `모둠 나누기` · `게임 시작` · `응답 펼치기`. 그 밖의 단추는 `verify:teach` 가 막는다. 「응답 펼치기」는 `<summary>` 접기 요소다.
- **발표 모드와 단계 시간은 없다** (강의자 지시 2026-09-18). 추측으로 만든 화면 기능을 넣지 않는다. `verify:teach` 가 되살아나는 것을 막는다.
- **묻는 것이 맨 앞이다** (강의자 지시 2026-09-21). 도입·정리는 `prompt` 블록(`StepPrompt`), 활동은 `task` 블록(`TaskCard`)이 자료보다 먼저 나온다 — 물음·과제문은 제목 크기(`text-headline`)로, 그 아래에 「무엇을 보고 정하나」와 「무엇을 쓰나」. 작은 캡션으로만 두지 않는다.
- 활동의 칸마다 `help` 한 줄이 있어야 한다 (무엇을 보고 무엇을 쓰는지). 과제 블록이 그 줄을 그대로 보인다 — `audit:activity` 가 빈 칸을 막는다.
- 새 블록 종류를 만들면 등록표에 한 줄, `LessonBody` 의 `switch` 에 한 갈래를 더한다.
- 이름: 기본은 강사가 적은 이름(`rosterName`), 없으면 닉네임. **「실명 가리기」가 켜지면 닉네임만** (`components/teach/names.tsx` 의 `NamesProvider`).
- 학생의 쓰는 칸은 강사가 「단계 열기」를 누른 뒤에만 열린다 (`session.openSteps`). 잠깐 확인은 쓰는 칸이 아니라 열기와 상관없이 푼다 — 개념 단계 응답 문서에 `{카드 id: 보기 자리}` 로 모인다 (`src/lib/concept-check.ts`).

## 게임 (8차)

게임 상태는 **`src/lib/game-core.ts`** 가 (서버 시드 · 참가 · 입력 · 서버 시각)에서 계산한다. 강사 화면은 게임 진행자 루프를 돌지 않는다 — 끝난 것을 보면 세션에 결과를 적고 발표 횟수를 올린다.
- 학생은 `sessions/{lid}/gameInputs/{stepId}__{uid}` 자기 문서만 쓴다. 세션의 `games` 는 강사만 쓴다.
- 반응 시각은 `serverNow()` (참가 때 `/api/game/time` 으로 잰 오프셋).
- 새 게임: `content/games.ts` 라이브러리 · `game-core.ts` 의 `DERIVE` 표 · `GameInputs.tsx` 의 `case`. `verify:games` 가 셋을 대조한다.
- 1강 사다리·2강 봉투는 옛 엔진(`ladder.ts`) 그대로 (`components/games/LegacyLadder.tsx`).
- 결과를 적는 자리는 하나다 — `src/lib/game-record.ts` 의 `finalizeGame`(세션 · 뽑기 기록 · 발표 횟수). 게임을 새로 붙여도 여기로 보낸다.

## 교실 구슬 레이스 — 교육론 2강 (강의자 지시 2026-09-21)

따로 배포된 활동 앱(`https://classroom-marble-race.sirlma.workers.dev`)을 iframe 으로 붙인다. 루미 런과 달리 **서버·티켓·webhook 이 없다** (`mode: 'local'`) — 강사 화면(프로젝터) 하나에서 돌고 학생 기기는 참가하지 않는다.
- 화면 `src/lib/marble.ts` · `src/components/marble/`. 명단은 수강생 전원(uid + 닉네임), 당첨자의 `participantId` 가 그 uid 다.
- 맵 id 와 규칙 꼴은 **배포된 활동 앱 기준**이다 — 붙이는 안내서의 `ext-*` 맵과 `firstN`·`lastN` 규칙은 그 앱에 없다. 포털 연구소는 `mix-portal`, 「먼저 n명」은 `{kind:'topK', k:n}`, 「늦게 n명」은 `{kind:'bottomK', k:n}`.
- 활동 앱은 `frame-ancestors` 로 자기 주소와 `scienced.labbitory.com` 에서만 열린다. **localhost 에서는 화면이 뜨지 않는다** — 8초 뒤 그 이유를 화면에 적는다. 확인은 배포 주소에서 한다.
- 결과는 서버가 확인해 주지 않는다(`serverVerified: false`). 결과에 「화면에서 계산한 결과」를 적고 성적에 쓰지 않는다.

## 모둠 나누기 (6차 · 8차)

배정 계산은 **`shared/groups-core.ts` 하나**다. 서버 함수(`/api/groups/assign`)·강사 화면·`verify:groups` 가 같은 코드를 쓴다.
- 8차: 과학 소재 게임 대신 **아이스브레이킹 질문**(`content/formation-questions.ts`) 하나로 나눈다. 같은 답끼리 모으되(`categoryMode: 'gather'`) 동석 최소화는 그대로. 모둠 이름은 답이다. 쓴 질문은 클래스 문서 `formationQuestions` 에 남아 학기 안에 되풀이하지 않는다.
- **회차마다 따로 최적화하지 않는다.** 남은 회차 전체를 짜고(`planSchedule`) 이번 회차는 그 첫 장을 쓴다. 계획은 `plannedNext` 에 저장된다.
- Firestore 는 배열 속 배열을 못 담는다. 계획은 `encodePlan` 으로 싼다.

## 루미 런 — 교수법 3·4강

따로 배포된 게임(저장소 `sirlma111216-boop/gamerun`, Render)을 iframe 으로 붙인다. 화면 `src/lib/lumi.ts` · `src/components/lumi/`, 서버 `functions/api/lumi/`.
- **발표할 등수는 번들에 없다** — `functions/api/_lib/lumi-rules.ts`. 강사 티켓에만 규칙이 붙고 학생 티켓에는 코스·제한 시간만 온다.
- 발표자는 webhook(`/api/lumi/result`)으로만 확정된다. 같은 경기는 한 번만 센다.
- 외부 설정 셋: Cloudflare `LUMI_SHARED_SECRET` / Render `LESSON_SHARED_SECRET`(같은 값) · `LESSON_RESULT_URL`.
- 로컬 저장 모드에서는 브라우저가 `local-dev` 비밀로 티켓을 만든다. webhook 은 `npm run test:lumi` 가 확인한다.

## 검사 명령

```bash
npm run verify        # 19종 — 소스 불변식
npm run typecheck
npm run lint
npm run emulators     # 아래의 선행
npm run test:rules    # 보안 규칙을 실제로 읽고 써 본다
npm run test:writes   # 앱이 쓰는 코드로 제출·모둠 데이터·사다리·모둠 나누기·게임 계산
npm run test:flow     # 클래스 만들기 → 등록 → 제출 → 강사가 읽기
npm run test:delete   # 지우기가 하위 자료까지 치우는지 + 걸리는 시간
npm run test:lumi     # 루미 런 결과 webhook 함수를 그대로 불러 발표자 저장·멱등·거절을 본다
```

## Windows 에서 파일을 고칠 때

Bash heredoc 과 `node -e` 는 백틱과 `${}` 를 먹는다. 패치는 스크립트 파일로 써서 `node` 로 돌린다. `python3` 는 스토어 스텁이다. CRLF 파일은 먼저 LF 로 바꾼다.
