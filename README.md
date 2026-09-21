# Science Lesson Studio

경희대학교 「과학교과교수법」(18차시) · 「과학교육론」(12차시) 강의를 웹앱 안에서 전부 진행하기 위한 단일 애플리케이션.

수강생은 예비 과학교사다. 차시마다 교실 장면 하나를 놓고 교사로서 무엇을 하겠는지 정하고, 그 이유를 쓰고,
다른 사람의 선택을 읽고, 모둠의 생각을 데이터로 모으고, 게임으로 뽑힌 사람이 발표한다.
**슬라이드 뷰어가 아니라 학생의 판단을 기록하는 도구다.** (8차 전면 개편 — `docs/8차_변경지시서_전면개편.md`)

## 원칙

1. **한 번 쓴 것은 다시 쓰지 않는다.** 차시마다 쓰는 칸은 셋(80분은 넷)이고, 제출하면 잠긴다. 지우지 않는다.
2. **읽는 것은 읽기로 끝난다.** 의견 광장에 반응·댓글·정렬이 없다.
3. **활동은 「교사가 결정해야 하는 순간」이다.** 정답이 있으면 활동이 아니다 (네 검사 — 정답·갈림·이해·상황).
4. **강사는 화면 하나로 가르친다.** `/teach/:classId/:lessonId`. 학생 화면과 같은 부품이 그리고, 누르는 것은 다섯 가지뿐이다.
5. **학생 순위를 만들지 않는다.** 발표자는 게임(서버 시드)이 뽑고, 발표 횟수가 적은 사람에게 가중치가 간다.

## 지금 할 수 있는 일

```bash
npm install
npm run dev          # http://localhost:5173
```

`.env` 가 없어도 뜬다. **로컬 저장 모드**로 떨어져 이 브라우저 안에서만 동작한다. 상단바가 어느 모드인지 항상 표시한다.

## 차시의 골격

한 차시는 **도입 → 개념 → 활동 → 정리** 넷이다 (교육론 80분 차시는 개념·활동이 두 벌). 단계 id 는 고정이다:
`intro · concepts · activity · (concepts-2 · activity-2) · wrapup`. 차시 파일은 단계를 쓰지 않는다 — `buildSteps(lesson)` 가 `layout` 에서 만든다.

| 단 | 학생이 하는 것 | 강사 화면의 조작부 |
|---|---|---|
| 도입 | 자료 하나 읽고 선택 하나(또는 한 줄) | 단계 열기 · 모둠 나누기(나누는 차시) · 응답 n/N ▸ |
| 개념 | 카드 3~4장 읽기 — 문단 셋 + 판단 기준 3줄 + **잠깐 확인**(카드마다 4지선다 하나, 이유 칸 없음, 한 번 고르면 잠긴다) | 카드마다 물음·보기 + 접힌 「응답 n/N ▸」(정답·분포) |
| 활동 | ① 상황+과제 ② 칸 1~2개 ③ 의견 광장(읽기만) ④ 모둠 데이터 ⑤ 게임 | 자료 공개 · 응답 n/N ▸ · 올라온 글 n ▸ · 모둠별 ▸ · 게임 시작 |
| 정리 | 「내 결정의 근거가 된 개념은 무엇이었고, 없었다면 무엇을 달리 했겠는가」 한 칸 + 기준 다시 보기 + 더 읽기 | 응답 n/N ▸ |

**묻는 것이 맨 앞에 크게 온다** — 도입·정리는 「오늘의 물음」, 활동은 「과제」 블록이 자료보다 먼저 나오고, 그 아래에 무엇을 보고 정하는지와 무엇을 쓰는지(칸마다 안내 한 줄)가 붙는다 (강의자 지시 2026-09-21).

단계마다 시간을 정해 두지 않는다 — 진행 속도는 강의자가 그 자리에서 정한다. 잠깐 확인은 쓰는 칸이 아니다 — 「단계 열기」 없이 풀 수 있고, 제출 현황에 세지 않는다. 검토 문서의 「확인」 블록에 먼저 쓰고 `npm run sync:checks` 로 코드에 옮긴다.

**모둠 데이터**(4.6)는 다섯 형식 — `allocation` 배분 평균 · `rank` 순위 합산 · `vote` 분포+대표 이유 · `sentence` 합의 문장 · `sort` 갈린 카드. 연속 차시에 같은 형식이 없고 배분은 학기당 세 번 이하다.

**모둠 나누기**(5절)는 아이스브레이킹 질문 하나로 한다 (`src/content/formation-questions.ts`, 24개). 같은 답끼리 모으되 동석 최소화(`shared/groups-core.ts`)는 그대로 돈다. 모둠 이름은 답이다 — 「일본 모둠」.

**게임**(6절)은 라이브러리 14종(새 12 + 밖에서 붙인 루미 런 · 교실 구슬 레이스) + 옛 게임 2종(1강 사다리 · 2강 봉투). 상태는 (서버 시드 · 참가 · 입력 · 서버 시각)의 함수라 모든 화면이 같은 것을 계산한다 (`src/lib/game-core.ts`). 학생은 [참가] 하나, 강사는 [게임 시작] 하나.

## 배포 전 검증

```bash
npm run verify        # 19종 — 소스 불변식
npm run typecheck
npm run lint
```

| 스크립트 | 무엇을 막는가 |
|---|---|
| `verify:course` | 두 과목 색인 ↔ 내용 파일 · 과목 간 문장 중복(1강 제외) · 클래스 `courseId` · 차시 내용이 `import()` 로 나뉘어 있는지 |
| `verify:flow` | 골격 4/6/4 단계 · 쓰기 칸 3/4 · 활동 다섯 단과 순서 · 도입에 광장 없음 · 정리 문항 꼴 |
| `verify:concepts` | 카드 문단 셋 · 기준 3줄이 「이 아니라 / 이면 / 를 보면」 꼴의 완전한 문장 · 명사 나열 금지 |
| `audit:activity` | 활동마다 네 검사 주석 · 상황 200~400자 · 명령형 과제 · 선택지 3개 이상 |
| `audit:draft` | `docs/검토/<과목>-<nn>.md` 의 문장이 코드에 그대로 있는지 — 문서가 시드다 |
| `verify:wording` | 어미 「~다 / ~하세요」 · 문장 60자 · 문단 4문장 · 비유·구호·다짐·장식 기호 · 연수 어휘 · 화면의 「○분」 |
| `verify:content` | 교재 OCR 오독 · 반복 템플릿 · 차시 사이 문장 중복 |
| `verify:games` | 라이브러리 16종 · 계산이 실제로 있는지 · 배치(옛 게임은 1·2강, 루미 런은 3·4강, 구슬 레이스는 맵·규칙 명시) · 서버 시각 · 단추 |
| `verify:groups` | 질문 은행 ≥20 · 과학 낱말 없음 · 형식 연속 중복 없음 · 배분 ≤3 · 모의 실행 · 접근성 |
| `verify:teach` | 등록표 ↔ 본문 · 강사와 학생이 같은 부품 · 수업 중 단추 다섯 이외 없음 · 실명 가리기 · 잠깐 확인의 정답은 접혀 있음 · 발표 모드·단계 시간 없음 · `/live` 없음 |
| `verify:classes` | 학기 간 자료 격리 · 실명이 강사 전용 경로에만 · 보안 규칙 |
| `verify:publish` | 시드의 공개 차시 = 새 클래스가 여는 차시 · 규칙의 published 조건 · 학생 화면은 공개된 차시만 불러온다 |
| `verify:stimulus` · `verify:figures` · `verify:theory` | 자료 꼬리표·줄머리 · 그림 명세 · 이론 배경(「더 읽기」) |
| `verify:api` · `verify:modules` · `verify:a11y` · `verify:ladder` | 서버 호출 토큰 · AI 교사 검토 관문 · 접근성 · 사다리 계산 |

검증기는 소스의 불변식만 본다. 실제로 터진 버그는 전부 이음매에 있었다 — 그래서 **앱이 쓰는 코드를 그대로 에뮬레이터에서** 돌린다.

```bash
npm run emulators     # 다른 터미널
npm run test:rules    # 보안 규칙 — 게임 입력·모둠 값·응답·명단
npm run test:writes   # 화면이 보내는 그 값 — 제출·모둠 데이터·사다리·모둠 나누기·게임 계산
npm run test:flow     # 클래스 만들기 → 등록 → 제출 → 강사가 읽기
npm run test:delete   # 지우기가 하위 자료까지 치우는지 + 시간
npm run test:lumi     # 루미 런 결과 webhook 함수 그대로
```

## 구조

```
src/
  content/types.ts             Lesson · KeyConcept · Activity · GroupData · GameKind (8차 4절)
  content/steps.ts             buildSteps — layout → 단계 (id 고정)
  content/courses/
    index.ts                   COURSES = { method, edu } · loadLesson (import() 로 따로 내려온다)
    method/lessonNN.ts         교과교수법 18차시
    edu/lessonNN.ts            과학교육론 12차시 (1강은 교수법 1강 그대로)
  content/games.ts             게임 라이브러리 16종
  content/formation-questions.ts  모둠 나누기 질문 은행
  content/theory/              이론 배경 (정리 끝 「더 읽기」)
  lib/game-core.ts             게임 상태 계산 — React 도 Firestore 도 Math.random() 도 없다
  lib/group-math.ts            모둠 데이터 계산 — 학생·강사·검사가 같은 함수
  lib/teach-registry.ts        블록 종류 → 조작부 등록표 · 수업 중 단추 다섯
  lib/groups.ts · shared/groups-core.ts   모둠 나누기
  lib/repo.ts                  저장 계층 (Firestore / 로컬)
  components/lesson/LessonBody.tsx   한 단계의 본문 — 학생 화면과 강사 화면이 같은 부품
  components/games/            GameShell · GameInputs(학생 입력 12종) · LegacyLadder(1·2강)
  components/group/            GroupStep(학생 ④ 모둠) · GroupBoard(강사 모둠별 나란히)
  components/formation/        아이스브레이킹 질문 (학생)
  components/groups/           FormationPanel (강사 — 배정·미리보기·확정)
  components/lumi/             루미 런 (교수법 3·4강)
  components/marble/           교실 구슬 레이스 (교육론 2강 — 서버 없이 강사 화면에서)
  routes/Teach.tsx             강사 수업 화면 /teach/:classId/:lessonId
  routes/Lesson.tsx            학생 차시 화면 /lesson/:id
  routes/instructor/Classes.tsx   강사 홈 — 차시 목록(이어서 할 차시 · 공개 토글 · 수업 열기)
  routes/instructor/ClassSettings.tsx  클래스 관리 — 등록 · 보관 · 지우기 · 새 클래스
docs/검토/                     차시별 검토 문서(시드) · 8차-결정.md(이렇게 정했다)
functions/api/                 Cloudflare Pages Functions (groups/assign · picker/draw · game/time · lumi/* · ai/* · admin/*)
functions/api/_lib/lumi-rules.ts   루미 런 발표 등수 — 번들에 없다
firestore.rules                보안 규칙
scripts/                       verify-*.mjs · audit-*.mjs · test-*.mjs
```

## 강사 화면

강사 홈(`/instructor/classes`)은 **지금 클래스의 차시 목록**이다. 맨 위에 이어서 할 차시 하나(마지막으로 연 차시)와 [수업 열기], 그 아래에 차시 표(공개 토글 · 수업 열기). 강사가 되면 두 번 안에 수업 화면에 닿는다.

수업이 아닌 일은 **「클래스 관리」 한 곳**에 있다 (`/instructor/class/:classId/{students,groups,settings}` 탭 셋) — 수강생 명단 · 모둠 · 수강 등록 · 보관 · 지우기 · 새 클래스. 학기에 한 번 쓰는 것을 홈에 두면 매주 쓰는 것과 구분되지 않는다 (강의자 지시 2026-09-21).

수업 화면은 학생 화면과 같은 블록을 그리고, 블록 옆에 조작부가 인라인으로 붙는다. 응답은 접혀 있다 — 「응답 12/28 ▸」.

수업 중 누르는 것은 다섯 가지뿐이다: `단계 열기` · `자료 공개` · `모둠 나누기` · `게임 시작` · `응답 펼치기`. `verify:teach` 가 그 밖의 단추를 막는다.

**실명 가리기**는 수업 화면 머리의 체크 상자다 — 켜면 모든 이름이 닉네임으로 바뀐다. 화면을 띄울 때 켠다. 실명(`rosterName`)은 `classes/{cid}/roster` 에만 있고 강사만 읽는다. (발표 모드는 강의자 지시로 뺐다 — 2026-09-18)

## AI는 교사를 지나야 학생에게 간다

```
AI 분류 요청 (AI 검토 화면 안)  →  addAiProposal (status: pending)  →  /instructor/ai-review
                                                                       ├ 읽고 고친다  (원문은 그대로 남는다)
                                                                       ├ 채택한다
                                                                       └ 거부한다     → 이유를 적어야 한다
```

- 제안은 언제나 `pending` 으로 들어온다. Firestore 규칙이 그것을 강제한다.
- `original` 은 규칙에서 잠겨 있다. 거부한 제안도 지우지 않는다.
- 학생용 AI 패널은 교사용 분류 작업을 **타입에서** 받지 못한다.

## 보안 (8차 부록)

- **미공개 차시의 내용은 번들에 없다.** 색인(제목·중심 질문·골격)만 앞에 있고, 내용은 공개된 차시이거나 강사일 때만 `import()` 로 내려온다. `verify:publish` 가 학생 화면의 순서를 본다.
- **루미 런의 발표 등수는 서버에만 있다** (`functions/api/_lib/lumi-rules.ts`). 강사 티켓에만 규칙이 붙고, 학생 티켓에는 코스와 제한 시간만 온다.

## 배포 (Cloudflare Pages)

빌드 명령 `npm run build`, 출력 디렉터리 `dist`. 배포는 `main` 에 push 하면 된다 (https://scienced.labbitory.com).
규칙을 바꿨으면 `npm run deploy:rules` 를 따로 한다.

### 환경 변수

**서버 전용** — Pages 대시보드에만 넣는다. `VITE_` 접두사를 붙이면 번들에 들어가 공개된다.

| 이름 | 값 |
|---|---|
| `GCP_SERVICE_ACCOUNT` | Vertex AI + Identity Toolkit 공용 서비스 계정 JSON (한 줄) |
| `GEN_AI_MODEL` | `gemini-2.5-flash-lite` |
| `GEN_AI_LOCATION` | `us-central1` |
| `AI_RATE_PER_MIN` | `6` |
| `FIREBASE_PROJECT_ID` | `scienced-e721d` |
| `STUDENT_EMAIL_DOMAIN` | `students.slstudio.local` |
| `LUMI_SHARED_SECRET` | 루미 런 게임 서버(Render)의 `LESSON_SHARED_SECRET` 과 같은 값 — 티켓·결과 서명 |

**빌드 변수** (번들에 들어가도 되는 값만)

| 이름 | 값 |
|---|---|
| `VITE_LUMI_ORIGIN` | 루미 런 게임 주소. 비어 있으면 코드의 기본값 `https://gamerun-mlhh.onrender.com`. 게임 쪽(Render)에는 `LESSON_SHARED_SECRET`(같은 비밀)과 `LESSON_RESULT_URL=https://scienced.labbitory.com/api/lumi/result` 를 넣는다 |

#### ① 구글 클라우드에서 API 를 켠다

**역할과 별개로 API 자체를 켜야 한다.** 켜지 않으면 403 `... API has not been used in project ... or it is disabled` 가 돌아온다.

| API | 무엇이 막히는가 |
|---|---|
| `aiplatform.googleapis.com` (Vertex AI) | AI 도움 전부 — [사용 설정](https://console.developers.google.com/apis/api/aiplatform.googleapis.com/overview?project=scienced-e721d) |
| `identitytoolkit.googleapis.com` | 학생 계정 만들기·비밀번호 초기화 |
| `firestore.googleapis.com` | 명단 문서 저장 |

**Vertex AI 는 무료 등급이 없다.** 결제 계정이 연결되어 있어야 한다.

#### ② IAM 역할

| 하는 일 | 필요한 역할 |
|---|---|
| AI 프록시 (Vertex AI) | `Vertex AI 사용자` |
| 학생 계정 만들기 | `Firebase 인증 관리자` |
| 명단 문서 저장 (Firestore) | `Cloud Datastore 사용자` |

하나라도 빠지면 그 기능만 조용히 막힌다. 서버는 5xx 를 던지지 않고 200 + ok:false 로 돌려준다.

**클라이언트** — Firebase 웹 설정값은 `.env.example` 에 있다.

### Firebase 준비

1. Authentication → 이메일/비밀번호 로그인 켜기
2. `npm run firebase:login` → `npm run deploy:rules`
   (`npx firebase …` 는 쓰지 않는다 — 클라이언트 SDK `firebase` 패키지가 잡힌다. 스크립트가 `--package=firebase-tools` 로 못박는다.)
3. **강사 계정을 만든 뒤 콘솔에서 `instructors/{uid}` 문서를 손으로 만든다.** 이 문서의 존재가 강사 권한의 유일한 근거다.
4. 강사로 로그인 → 학생 계정 → CSV(`학번,이름`) 업로드. 초기 비밀번호는 학번이다.

## 진행 상황 (8차)

| 작업 | 상태 |
|---|---|
| A 걷어내기 (형성평가·재응답·반응·댓글·판·여섯 층 카드) | 배포됨 |
| B 골격 · 저장 계층 · 규칙 · 두 과목 색인 | 완료 |
| C 강사 수업 화면 `/teach` | 완료 |
| D 게임 라이브러리 14종 + 옛 2종 | 완료 |
| E 교과교수법 1강 본보기 (검토 문서 → 코드 → 검증 19종 → 에뮬레이터 5종) | 완료 |
| F 교과교수법 2~18강 (7강 우선) · G 과학교육론 2~12강 | 진행 중 — `docs/검토/` 에 검토 문서가 먼저 온다 |

## 참조

- `docs/8차_변경지시서_전면개편.md` — 이번 개편의 지시서
- `docs/검토/8차-결정.md` — 판단이 갈린 것을 어떻게 정했는가
- `DESIGN.md` — 시각 디자인
- `CLAUDE.md` — 이 저장소에서 일하는 방식
