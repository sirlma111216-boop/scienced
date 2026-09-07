# 과학교육론·과학교과교수법 18강 수업 웹앱 — 구축 지시서 (v3)

이 문서는 Claude Code에 전달하는 작업 지시서다. 프로젝트 루트에 `SPEC.md`로 저장하고 작업 내내 기준으로 삼는다.

> **이 문서는 처음 받은 지시서 원문이다. 이후 변경분은 여기에 반영하지 않는다** — 무엇을 요구받았는지가 남아 있어야 하기 때문이다.
> 아래와 어긋나는 곳이 있으면 **코드가 맞다.**
>
> | 2차 변경 | 이 문서의 표기 | 지금의 코드 |
> |---|---|---|
> | A — 수강 클래스 | `courses/{courseId}/…` | `lessons/*`(콘텐츠 마스터) + `classes/{classId}/*`(학기별 자료) |
> | B — 용어 | 퇴실표 · `step-exit` · `exit-self-check` | 「이번 수업 정리」 · `step-wrapup` · `wrapup-self-check` (`WRAPUP_LABEL`) |
>
> `npm run verify:wording` 이 옛 이름의 재유입을 막는다.

---

## 0. 먼저 할 일 — 참조 자료를 읽는다

작업을 시작하기 전에 아래를 전부 읽는다. 이 지시서에는 요약만 있고, 실제 문구·개념 설명·사례·활동 규칙은 참조 문서에, 검증된 구현은 참조 저장소에 있다. **읽지 않고 지어내지 않는다.**

| 자료 | 여기서 가져올 것 |
|---|---|
| `과학교육론_과학교과교수법_통합강의_컨텍스트.md` | **설계의 최상위 기준.** 18차시 교수요목(4절), 웹앱 공통 설계(8절), 쉬운 말 번역표(9절), 강의안 제작 규격(11절), 사례 은행(16절), 평가·피드백 체계(18절), 포용성·AI·웹앱 제품 설계서(19절), 활동·게임 카탈로그(20절), 개념 친절 해설(22~23절) |
| `과학교육론과_과학교과교수법_18강_통합교재.docx` | 차시별 중심 질문, 학생의 말, 먼저 한 문장, 친절한 길잡이, 핵심 개념 4개, 학습목표, 현장 사례, 50분 흐름, 활동, 부록 A~E |
| **`github.com/sirlma111216-boop/2022co`** | **검증된 구현.** 사다리타기, 담벼락, Vertex AI 프록시, 보안 규칙, 발표 모드, 검증 스크립트. 2절에서 무엇을 어떻게 가져올지 지정한다 |
| `DESIGN.md` (별도 제공) | 색·타이포·레이아웃. **시각 디자인의 모든 판단보다 우선한다.** 아직 없으면 스타일 결정을 미루고 구조부터 만든다 |

### 참조할 때 지켜야 할 규칙

1. **통합교재의 '심화 읽기'는 화면에 그대로 넣지 않는다.** 교재의 87%를 차지하는 이 부분은 원본 도서 스캔 OCR 원문이며 교정되지 않았다. `히는`(→하는), `시용`(→사용), `결괴`(→결과), `비고츠기`(→비고츠키), `브루L--l`, `대assard`, `spiml curriculum`, `s=1/2gt2` 같은 오독이 문단의 41%에 남아 있다. 심화 읽기는 **첨부 참고자료**로만 다룬다. `npm run verify:content`가 감시한다.
2. **교재의 자동 생성 틀 문구를 그대로 쓰지 않는다.** `○○: 정의를 외우기보다 이 개념이…`(72회 반복), `○○이(가) 학생의 설명과 교사의 선택을 어떻게 바꾸는가?`(72회 반복), 18개 장 동일한 '수업으로 가져가기'가 그것이다. 화면 문구는 컨텍스트 문서 9절·22~23절을 근거로 **차시마다 새로 쓴다.**
3. **컨텍스트 문서와 교재가 어긋나면 컨텍스트 문서를 따른다.**
4. 개념 설명은 컨텍스트 문서 1절의 여섯 층 순서를 따른다: 쉬운 한 문장 → 왜 필요한가 → 교실 장면 → 정확한 정의 → 헷갈리기 쉬운 것 → 직접 써 보기.

---

## 1. 무엇을 만드는가

경희대학교 「과학교육론」·「과학교과교수법」 18차시 강의를 **웹앱 안에서 전부 진행**하기 위한 단일 애플리케이션. 제품명 `Science Lesson Studio`.

수강생은 예비 과학교사다. 한 학기 동안 같은 수업 주제를 발전시키며 자기 생각을 제출하고 → 동료와 비교하고 → 수정하고 → 그 변화를 포트폴리오로 남긴다. 슬라이드 뷰어가 아니라 **학생의 사고 변화를 기록하는 도구**다.

핵심 원칙 (컨텍스트 문서 8.2, 19.11):
- 최초 답을 지우지 않는다. 모든 응답은 버전으로 쌓는다.
- 정답 속도가 아니라 설명의 질, 증거 사용, 근거 있는 수정에 보상한다.
- 학생 순위를 만들지 않는다. 지표는 교수자의 다음 수업 결정과 학생의 자기 확인에 쓴다.

---

## 2. 기존 저장소(`2022co`)에서 가져올 것

사용자가 Claude Code로 만들어 운영 중인 **「거꾸로 설계 연수실」**(`2022back.labbitory.com`)의 코드를 최대한 그대로 이관한다. 이미 실전에서 돌아간 물건을 다시 만들지 않는다.

### 2.1 그대로 복사할 파일 — 손대지 않는다

| 파일 | 무엇 |
|---|---|
| `src/lib/ladder.ts` | 사다리 순수 계산. React도 Firestore도 `Math.random()`도 없다. **씨앗 문자열 하나만 같으면 강사 화면과 모든 학생 화면이 글자 그대로 같은 사다리를 그린다.** FNV-1a 해시 + mulberry32 |
| `scripts/verify-ladder.mjs` | 사다리 검증 5종 (전단사, 가로줄 인접 금지, 발표자 수, 씨앗 재현성, 좌우 이동률 70% 이상) |
| `shared/ai-core.ts` 의 인증부 | 서비스 계정 → RS256 JWT(WebCrypto) → OAuth2 액세스 토큰. **이 코드를 비밀번호 초기화용 Identity Toolkit 호출에도 재사용한다** |

### 2.2 구조를 따라 만들 것

| 기존 | 새 앱에서 |
|---|---|
| `src/lib/ladder-game.ts` `deriveLadder / startLadder / emergencyLadder / resetLadder` | 그대로. 상태 흐름 `seating → locked → running`, 라운드 증가로 초기화, 사다리가 깨졌을 때의 비상 추첨까지 유지 |
| `src/components/activity/LadderGame.tsx` `LadderBoard.tsx` `teach/LadderPanel.tsx` | 학생용 모달 / 사다리 그림 / 강사 패널. 자리 선점 경합 처리("방금 다른 분이 그 자리를 가져갔습니다")도 그대로 |
| `src/components/wall/Wall.tsx` `ShareBar / WallDialog / WallCard` | 의견 광장의 골격. 활동 하단 `[공유하기] [다른 사람 생각 보기]` → 모달 → 벽돌 배치(masonry) |
| `src/lib/repo.ts` | Firestore/로컬 두 구현을 같은 인터페이스로 감싸는 층. `watchPosts / addPost / toggleLike / addComment / pinPost / joinLadder / claimLadderSeat / setLadder` 이름을 유지 |
| `src/components/layout/AppShell.tsx` | 상단바 + 단계 네비게이션. 우측에 `실시간 공유 / 발표 모드 / 강사 / labbitory.com` |
| `src/components/teach/MustSay.tsx` `elements.tsx`의 진행 팁 | **강사 대본.** 발표 모드에서만 빨간 표식과 "왜 빼면 안 되는가"가 뜬다 |
| `src/content/timeline.ts` | 진행 타임라인. 150분 → 차시별 50분으로 |
| `firestore.rules` | 아래 2.4 |

### 2.3 반드시 지킬 세 가지 — 기존 코드 주석에 적힌 실전 교훈

**① Cloudflare 엣지에서 AI Studio를 쓰지 않는다. Vertex AI를 쓴다.**
`generativelanguage.googleapis.com`은 아웃바운드가 미지원 지역(홍콩 등)을 경유하면 `400 FAILED_PRECONDITION "User location is not supported"`를 간헐적으로 뱉는다. 재시도나 결제로 해결되지 않는다. 그래서 `aiplatform.googleapis.com`(Vertex AI)을 쓴다. 요청/응답 형식은 같고 호출자 위치 검사가 없다.
→ **v2 지시서에는 이 내용이 없었다. 그대로 만들었으면 시연 도중 간헐적으로 AI가 죽었을 것이다.**

**② AI 응답은 실패해도 HTTP 200 + JSON으로 돌려준다.**
함수가 5xx를 던지면 Cloudflare 엣지가 본문을 평문 `error code: 502`로 덮어써 진짜 원인이 화면에서도 로그에서도 보이지 않는다. `{ ok: false, message }` 형태로 200을 반환한다.

**③ 모델명을 하드코딩하지 않는다.** `GEN_AI_MODEL` 환경 변수로 바꾼다. 기본값 `gemini-2.5-flash-lite`.

### 2.4 보안 규칙 관용구 — 그대로 가져온다

- **강사 판정은 클라이언트 boolean이 아니라 `instructors/{uid}` 문서 존재로만 한다.** 그 컬렉션은 콘솔/관리자에서만 쓴다.
- 부분 업데이트는 `changedKeys().hasOnly([...])`로 연다. 예: 다른 사람은 반응 필드만 바꿀 수 있다.
- **선택형 집계는 `pollResults` map 한 곳에 모은다.** 키를 `${pollId}_${option}`으로 만들면 새 활동을 추가해도 보안 규칙을 손대지 않아도 된다. 사다리 자리 잠금(`ladderSeatKey`)도 이 map에 얹는다.
- 마지막에 `match /{document=**} { allow read, write: if false; }`.

### 2.5 살릴 UX 관행

- **로컬 저장 모드 폴백.** Firebase 없이도 개인 작성·자동 저장·인쇄가 동작한다. 실시간 공유만 "내 것"만 보인다. 상단바가 `실시간 공유` / `로컬 저장`을 표시한다.
- **강사가 단계를 옮겨도 학생 화면을 강제로 이동시키지 않는다.** "강사가 ○○로 이동했습니다" 안내와 이동 버튼만 띄운다. (v2에 적었던 '강제 동기화'는 이 방식으로 대체한다)
- **발표 모드**는 글자를 1.35배로 키우고 강사 진행 팁을 드러낸다. 학생 화면에는 진행 팁과 토론 타이머가 뜨지 않는다.
- **개인정보를 묻지 않는다.** 기존 앱은 닉네임·교과·학교급만 받았다. 새 앱은 학기 데이터 누적 때문에 학번 로그인을 쓰지만, **화면에 보이는 이름은 학생이 정한 닉네임**이다.

### 2.6 가져오지 않을 것

- 연수 코드 + 닉네임만으로 입장하는 방식 → **학번 로그인**으로 대체 (3절)
- `LadderGameId = "start" | "question"` 고정 두 판 → **차시별 게임 id**로 일반화 (10절)
- 「150분 뒤 A4 한 장을 가지고 나가시게 됩니다」 형태의 약속 문구 → **쓰지 않는다.** 하루짜리 연수를 한 장으로 압축하니 성립하는 문구다. 한 학기 강의에는 맞지 않는다

---

## 3. 기술 스택 — 이미 결정됨. 다시 검토하지 않는다

| 영역 | 선택 |
|---|---|
| 프론트엔드 | React 18 + TypeScript + Vite + Tailwind (기존 저장소와 동일) |
| 라우팅 | React Router |
| 상태 | 서버 상태는 Firestore 실시간 구독, 로컬 상태는 React 내장 훅. 전역 상태 라이브러리 도입 금지 |
| 드래그 | `@dnd-kit` (기존과 동일). 반드시 키보드 대안 병행 |
| 인증 | Firebase Authentication (이메일/비밀번호를 학번에 매핑) |
| 데이터베이스 | Cloud Firestore |
| 파일 저장 | Firebase Storage |
| 생성형 AI | **Vertex AI 경유 Gemini** (2.3 ①) |
| 서버 로직 | Cloudflare Pages Functions |
| 배포 | **Cloudflare Pages**, `labbitory.com` 하위 도메인 |

Cloudflare가 적절한 이유: 상시 구동 서버가 필요 없다. 실시간 분포와 의견 광장은 Firestore `onSnapshot`으로 처리되고, 서버 로직은 AI 프록시·계정 관리·추첨 시드뿐이다. 기존 앱이 같은 구성으로 이미 운영 중이다.

**`firebase-admin` 패키지는 설치하지 않는다.** Node 전용이라 Workers에서 동작하지 않는다. `shared/ai-core.ts`의 JWT 서명 코드를 재사용해 REST API를 직접 호출한다.

---

## 4. 인증 설계

### 4.1 계정 종류

| 역할 | 로그인 | 부여 |
|---|---|---|
| `instructor` | 이메일 + 비밀번호 | 계정 생성 후 **`instructors/{uid}` 문서를 콘솔에서 수동 생성** (2.4) |
| `student` | **학번 + 비밀번호** | 강사가 학번 목록을 올려 일괄 생성 |

### 4.2 학번 로그인

```
학번 2024123456  →  2024123456@students.slstudio.local
```

- 학생 화면에는 **학번 입력란만** 보인다. 이메일 형식을 노출하지 않는다.
- 존재하지 않는 도메인을 쓴다. 메일 발송 기능은 사용하지 않는다.
- 로그인 화면은 `강사 로그인` / `수강생 로그인` 탭을 분리한다.

### 4.3 계정 일괄 생성

강사 → `수강생 관리` → CSV(`학번,이름`) 업로드 → `POST /api/admin/students/import`
1. 호출자 ID 토큰 검증 + `instructors/{uid}` 존재 확인
2. 서비스 계정 JWT → OAuth2 토큰 (`shared/ai-core.ts` 코드 재사용)
3. Identity Toolkit REST로 계정 생성, 초기 비밀번호 = **학번**
4. `users/{uid}` 생성, `mustResetPassword: true`

### 4.4 비밀번호 초기화

```
강사 [비밀번호 초기화] → POST /api/admin/students/reset-password { studentId }
  → 강사 확인 → accounts:update 로 비밀번호를 학번으로 되돌림
  → users/{uid}.mustResetPassword = true
  → 강사 화면에 "초기 비밀번호는 학번입니다"

학생이 학번 + 학번으로 로그인
  → mustResetPassword 감지 → /reset-password 강제 이동, 다른 화면 차단
  → 새 비밀번호(8자 이상, 학번과 달라야 함) + 확인 → updatePassword()
  → mustResetPassword = false → 원래 화면으로
```

최초 로그인도 같은 흐름이다. **첫 로그인 때 닉네임도 함께 정한다.**

### 4.5 라우트 보호

- 비로그인 → `/login`
- `mustResetPassword` → `/reset-password` 외 전부 차단
- 학생이 `/instructor/*` → 403
- 학생이 미공개 차시 URL 직접 입력 → 안내 화면. **내용은 절대 전송하지 않는다.** Firestore 규칙에서 차단

---

## 5. Pages Functions

```
functions/api/
  ai/generate.ts                   POST  Vertex AI 프록시
  admin/students/import.ts         POST  계정 일괄 생성
  admin/students/reset-password.ts POST  비밀번호 초기화
  admin/students/remove.ts         POST  수강 종료
  picker/draw.ts                   POST  발표자 추첨 시드 생성
```

- 모든 엔드포인트가 `Authorization: Bearer <Firebase ID token>`을 요구한다.
- ID 토큰은 Google 공개키(`securetoken@system.gserviceaccount.com` JWK)를 캐시해 WebCrypto로 직접 검증한다.
- `/api/admin/*`, `/api/picker/*`는 강사만.
- **모든 응답은 오류여도 HTTP 200 + JSON** (2.3 ②).

### 5.1 AI 프록시

- 로직은 `shared/ai-core.ts`에 두고 Pages Function은 껍데기만 담당한다 (기존 구조 유지).
- 키·서비스 계정은 서버 전용 환경 변수. **`VITE_` 접두사 금지.**
- 요청 본문은 `{ taskId, inputs }`만 받는다. **클라이언트가 프롬프트 원문을 보내지 못하게 한다.** 템플릿은 서버에 `taskId`별로 고정.
- 학생 이름·학번·닉네임을 프롬프트에 넣지 않는다.
- 분당 호출 한도(기본 6~10회). `aiLogs`에 기록.
- 출력 형식은 기존 앱의 `GOOD / THINK / SUGGEST / ASK` 4줄 규약을 이어받는다. **`ASK`는 물음표로 끝나는 한 문장이고 답을 주지 않는다.**

### 5.2 추첨

난수를 클라이언트에서 만들지 않는다. 서버가 시드를 만들고 결과와 함께 저장한다. 강사 화면에서 시드·후보·가중치를 확인할 수 있어야 한다. **씨앗 하나로 모든 화면이 같은 사다리를 그린다**는 기존 설계를 그대로 쓴다.

---

## 6. Firestore 데이터 모델

```
users/{uid}
  role, studentId, displayName(실명·강사만), nickname(공개 표시명)
  mustResetPassword, groupId, createdAt, lastLoginAt

instructors/{uid}                              // 존재 자체가 강사 권한 (콘솔에서만 생성)

courses/{courseId}
  title, term, schedule, assessmentWeights

courses/{c}/lessons/{lessonId}                 // "01" ~ "18"
  order, title, centralQuestion, studentVoice
  firstSentence, guide, objectives
  keyConcepts: [{ id, term, plainOneLiner, whyItMatters, classroomScene,
                  formalDefinition, notToConfuseWith, applyQuestion }]
  instructorScript: [{ stepId, cue, sayThis, whyNotSkip, watchFor }]
  timeline: [{ minutes, label, stepId }]
  published: boolean                            // 1강만 true
  publishedAt

courses/{c}/lessons/{l}/steps/{stepId}
  order, type, title, durationMinutes, config
  aiTasks: string[]
  wall: { enabled, prompt, anonymous, opensAfterSubmit }
  picker: { enabled, gameId, candidateRule } | null

courses/{c}/lessons/{l}/steps/{s}/responses/{uid}
  versions: [{ v, payload, confidence, createdAt, changedReason }]
  draft: { payload, savedAt }                   // 입력 중 자동 저장
  latestV, submittedAt                          // 이전 버전은 절대 덮어쓰지 않는다

courses/{c}/lessons/{l}/steps/{s}/posts/{postId}      // 의견 광장
  uid, nickname, groupId
  versions: [{ v, content, changedReason, createdAt }]
  latestV
  reactions: { agreed, wantEvidence, disagree, learned }   // 각 uid 배열
  comments: [{ uid, nickname, text, createdAt }]
  isPinned, isHidden, createdAt

courses/{c}/aggregates/{stepId}                 // 익명 집계
courses/{c}/sessions/{lessonId}
  currentStepId, stepOpen, timerEndsAt
  pollResults: Record<string, number>           // 선택형 집계 + 사다리 자리 잠금 (2.4)
  ladders: Partial<Record<GameId, LadderState>>
  pinnedPostRef | null

courses/{c}/groups/{groupId}                    { name, memberUids }
courses/{c}/groupWork/{groupId}_{stepId}        { versions, editedBy }
courses/{c}/picks/{pickId}
  lessonId, stepId, gameId, candidateUids, excludedUids, weights
  winnerUids, seed, runBy, runAt, redrawOf
courses/{c}/participation/{uid}
  presentCount, lastPresentedLessonId, postCount, commentCount

portfolios/{uid}  conceptMaps/{uid}  microteaching/{uid}/sessions/{n}
feedback/{id}  aiLogs/{id}
```

### 보안 규칙 요점

- 학생은 `published === true`인 차시만 읽는다.
- 학생은 자기 `responses`만 읽고 쓴다. `versions`는 **추가만**, 기존 요소 수정·삭제 금지.
- **본인이 제출하기 전에는 `posts`와 `aggregates`를 읽을 수 없다** (컨텍스트 15.2).
- 다른 사람 글은 `changedKeys().hasOnly(['reactions'])` 또는 `hasOnly(['comments'])`로만 건드린다.
- 글 삭제는 작성자와 강사만. 강사의 숨김은 `isHidden`으로.
- 강사만 `published`, `sessions`, `groups`, `picks`를 쓴다.
- 에뮬레이터 기반 규칙 테스트를 함께 작성한다.

---

## 7. 화면 구조

### 7.1 수강생
```
/login  /reset-password
/                    학기 홈 — 공개된 차시, 포트폴리오 진행, 내 개념 지도
/lesson/:id          차시 진행 (상단 단계 네비게이션)
/portfolio  /concept-map  /microteaching
```

### 7.2 강사
```
/instructor                      대시보드
/instructor/lessons              18개 차시 (공개 토글, 미공개 배지)
/instructor/lesson/:id           차시 편집
/instructor/lesson/:id/live      진행 콘솔 (분포, 유형 묶기, 의견 조정, 추첨, 분기)
/instructor/students             CSV 가져오기, 비밀번호 초기화, 모둠 편성, 발표 횟수
/instructor/portfolios  /instructor/microteaching  /instructor/ai-logs
```
발표 모드는 별도 경로가 아니라 상단바 토글이다 (2.5).

### 7.3 재사용 컴포넌트

| 컴포넌트 | 출처 | 역할 |
|---|---|---|
| `LadderGame` `LadderBoard` `LadderPanel` | **기존 이관** | 발표자 뽑기 |
| `ShareBar` `WallDialog` `WallCard` | **기존 이관 + 개조** | 의견 광장 |
| `MustSay` `TeachTip` | **기존 이관** | 강사 대본 |
| `AppShell` | **기존 이관** | 상단바 + 단계 네비게이션 + 발표 모드 |
| `ResponseCollector` | 신규 | 답 + **이유** + **확신도**. 입력 중 자동 저장. 제출 전 타인 응답 비공개 |
| `DistributionView` | 신규 | 익명 분포 (막대 / 2차원 / 워드클라우드) |
| `VersionTimeline` | 신규 | v1→v2→v3와 "무엇을 왜 바꿨는가" |
| `CardSorter` | 신규(dnd-kit) | 정렬·순위·예산 배분. **키보드/숫자 입력 대안 필수** |
| `FourQuadrant` | 신규 | 4칸 분석표 |
| `NodeCanvas` | 신규 | 모형·논증 지도·개념 지도 공용 |
| `RubricScorer` | 기존 `RubricBuilder` 확장 | 수준별 기술어 + 앵커 + 채점자 간 차이 |
| `AiAssistPanel` | 기존 `AiCoach` 확장 | GOOD/THINK/SUGGEST/ASK + 근거·한계 배지 |
| `TeacherBranchBar` | 신규 | 설명 추가 / 짝 토론 / 재응답 요청 푸시 |

---

## 8. 차시 페이지 공통 구조

컨텍스트 문서 11절의 14요소를 아래 흐름으로 구현한다.

```
① 오늘의 문      중심 질문 + '학생의 말' 카드
② 시작 현상      영상/사진/자료 + 관찰과 해석 분리 입력
③ 내 생각 먼저   개인 예측 + 이유 + 확신도  (제출 전 타인 답 비공개)
④ 의견 광장      ③을 제출한 사람에게만 열린다                    ← 9절
⑤ 개념 카드      쉬운 한 문장 → 왜 필요한가 → 교실 장면 → 정확한 정의 → 헷갈리지 말자 → 적용 질문
⑥ 핵심 활동      차시별 모듈                                      ← 12절
⑦ 발표자 뽑기    생각이 갈린 지점에서                             ← 10절
⑧ 형성평가       수집 → 해석 → 교사 분기 → 학생 수정 → 재확인
⑨ 퇴실표         오늘 바뀐 생각 한 줄 + 확신도
⑩ 포트폴리오로   이 차시 산출물 저장
```

---

## 9. 의견 광장 (요구사항 2)

기존 담벼락(`Wall.tsx`)의 골격을 그대로 쓴다. **모든 차시의 최소 두 단계에 배치한다.**

### 9.1 그대로 가져오는 것

- 활동 하단의 `[공유하기] [다른 사람 생각 보기 (N)]` 버튼 줄 (`ShareBar`)
- 모달 + 벽돌 배치(1/2/3열 반응형)
- 카드에 닉네임 · 상대 시각 · 작성 내용을 `dt/dd`로 나열
- 한 줄 댓글 입력 + 최근 4개 표시
- 강사 모드에서 `함께 보기(고정)` / `숨김`
- 실시간 구독 (`repo.watchPosts`)

### 9.2 바꾸는 것

| 기존 | 새 앱 | 이유 |
|---|---|---|
| 언제든 공유 가능 | **본인이 그 단계 응답을 제출한 뒤에만 열린다** | 남의 답을 먼저 보고 자기 생각을 정하는 일을 막는다 (컨텍스트 15.2) |
| 하트 공감 1종 + `공감순` 정렬 | **반응 4종, 인기순 정렬 없음** | 아래 9.3 |
| 글 수정이 덮어쓰기 | **새 버전으로 쌓기** | 1절 원칙 |
| 댓글 60자 | 200자 + 문장 틀 버튼 | 아래 9.4 |
| 강사가 삭제 | 강사는 `숨김`(작성자에게 사유 표시), 삭제는 작성자만 | 기록 보존 |

### 9.3 반응 — 좋아요를 쓰지 않는다

컨텍스트 문서 19.7이 "좋아요 중심 인기 평가"를 금지한다. 하루짜리 연수에서는 하트가 무해하지만, 같은 30명이 18주를 함께 가는 강의에서는 인기 순위가 굳는다. 14강이 다루는 참여 형평성과도 정면으로 부딪힌다.

| 반응 | 뜻 |
|---|---|
| 나도 그렇게 생각했다 | 같은 결론 |
| 근거가 궁금하다 | 더 듣고 싶다 |
| 나는 다르게 본다 | 다른 결론 |
| 새로 알았다 | 내 생각이 움직였다 |

한 사람이 글 하나에 하나만. 취소·변경 가능.

**정렬 기본값은 `아직 반응이 없는 글 먼저`**, 그다음 최신순. 선택으로 `강사 추천(고정)` / `최신순` / `내가 반응한 것` / `우리 모둠`. **인기순은 만들지 않는다.**

> 이 항목은 컨텍스트 문서를 근거로 한 판단이다. 기존 앱대로 하트를 쓰고 싶으면 되돌리기 쉽게, 반응 종류를 상수 한 곳(`REACTIONS`)에 모아 둔다.

### 9.4 댓글 문장 틀

버튼 3개로 제공하고 강제하지는 않는다 (컨텍스트 17.3 쓰기 비계).
- `이 부분이 ___와(과) 연결된다고 봅니다`
- `이 주장에 필요한 증거는 ___라고 생각합니다`
- `저는 ___ 때문에 다르게 봅니다`

### 9.5 강사 기능

고정(발표 모드 대형 화면에 띄움) / 숨김 / 유형 묶기(`cluster-responses` AI 제안 + 수동 수정) / **반응이 갈린 글 자동 표시 → 10절 추첨의 후보 풀로 넘김**.

---

## 10. 발표자 뽑기 게임 (요구사항 3)

생각이 갈리거나 논쟁적인 지점에서 누가 설명할지 정하는 짧은 게임을 **각 차시에 1개씩** 넣는다.

### 10.1 엔진 — 기존 사다리 코드를 일반화한다

`LadderGameId`를 고정 두 값에서 **차시별 id**로 바꾼다. 그 외 `deriveLadder / startLadder / emergencyLadder / resetLadder`와 상태 흐름(`seating → locked → running`), 라운드 초기화, 자리 선점 경합 처리는 그대로다.

```ts
type GameId = `${LessonId}-${string}`      // 예: "01-auction", "05-survival"

interface GameDef {
  id: GameId
  mode: PickerMode                 // 18종, 각각 다른 값
  tab: string                      // 강사 화면 탭 이름
  lead: string                     // 학생 화면 안내 (2줄)
  hint: string
  choiceField: string              // 결과 카드에 다시 보여 줄 응답
  reasonField: string
  askLine: string                  // 발표자에게 무엇을 말하라고 할 것인가
  presenterAsk: string             // 강사 화면 결과 아래
  candidateRule: "all" | "byResponseType" | "splitOpinion"
  weightByFewPresentations: boolean
  winnerCount: number              // 기본 2
}
```

`ladderGames.ts`의 `LadderGameDef` 구조를 그대로 확장한 형태다. 콘텐츠 파일 하나에 18개를 정의한다.

**규칙**
- 실행은 강사만. 시드는 서버가 만든다. 씨앗이 같으면 모든 화면이 같은 결과를 본다.
- **정답·오답을 기준으로 뽑지 않는다.** 틀린 답을 고른 사람을 지목하는 용도로 쓰지 않는다.
- `participation.presentCount`가 적은 사람의 확률을 높인다(기본 켬).
- 강사는 추첨 전 제외, 추첨 후 재추첨, 수동 지정이 가능하다.
- 사다리가 깨졌을 때를 대비한 **비상 추첨**을 유지한다(기존 `emergencyLadder`).
- **접근성:** `prefers-reduced-motion`이면 애니메이션을 건너뛰고 결과를 즉시 보여준다. 결과는 `aria-live`로 알린다. 마우스 없이 실행·확인이 가능해야 한다.
- 결과는 `picks`에 시드·후보·가중치와 함께 남는다.

### 10.2 차시별 게임

| 차시 | 게임 | 뽑는 방식 | 발표 내용 |
|---:|---|---|---|
| **1** | **사다리타기** | **기존 구현 그대로. 자리를 고르고, 하단 「발표!」 두 칸에 도착한 2명** | 우리가 그 카드에 가장 많이 준 이유 |
| 2 | 봉인된 증거 봉투 | 봉투 중 하나에 표시. 열기 전 "내가 걸릴 확률"을 적고, 연 뒤 예상과 결과의 차이를 한 줄 | 관찰과 추론을 어떻게 갈랐는지 |
| 3 | 학생 발화 카드 뒤집기 | 카드 앞면에 학생 발화, 한 장 뒤에 발표 표시 | 그 발화 뒤의 사고모형 진단 |
| 4 | 비계 계단 | 말이 계단을 오르다 무작위 칸에서 멈춤 | 이 도움을 언제 어떤 증거를 보고 줄일 것인가 |
| 5 | 설명 생존 | 증거가 한 장씩 공개될 때마다 후보가 한 명씩 빠지고 마지막 1명 | 어떤 증거에서 설명을 바꿨는가 |
| 6 | 교육과정 지도 핀 | 영역 지도 위 핀이 돌다 멈춤 | 그 영역 성취기준의 세 범주 해부 |
| 7 | 목표·증거·활동 스피너 | 세 칸 룰렛 | 멈춘 칸에서 내 설계가 어긋난 곳 |
| 8 | 변인 주사위 | 주사위 두 개(변인 / 조건) 조합 | 그 조합의 공정한 비교 설계 |
| 9 | 모형 대진 추첨 | 무작위 대진표로 모형 두 개를 맞붙임 | 두 모형의 설명 범위 비교 |
| 10 | 드래프트 순번 | 추첨 순번대로 수업 상황 카드를 고름. 마지막 순번이 먼저 발표 | 이 상황에 그 모형을 고른 이유 |
| 11 | 표상 룰렛 | 현상 / 입자 그림 / 그래프 / 수식 4칸 | 멈춘 표상으로 번역하고 사라진 정보 말하기 |
| 12 | 배심원 역할 추첨 | 주장자·반론자·증거 검토자·요약자를 동시에 | 각자 맡은 역할의 담화 이동 |
| 13 | 이해당사자 제비 | 연구자·주민·기업·지자체·학생 역할 카드 배분 | 그 입장의 기준과 우려 |
| 14 | 침묵 데이터 | **발표 기회가 적었던 사람의 확률을 크게 준다. 가중치를 화면에 공개한다** | 우리 모둠에서 누구의 생각이 기록에 남았는가 |
| 15 | 응답 유형별 한 명 | 형성평가 응답 유형 묶음마다 무작위 1명 | 같은 답을 고른 서로 다른 이유 |
| 16 | 경계 사례 짝 | 같은 산출물에 다른 점수를 준 두 사람을 짝으로 | 기준 문구의 어느 말에서 갈렸는가 |
| 17 | 문장 감사 배정 | AI 응답의 문장 번호를 무작위 배정 | 맡은 문장의 사실·해석·출처 필요·오류 판정 |
| 18 | 재수업 순번 | 마이크로티칭 순서 추첨. **1강 사다리 결과와 겹치는 사람은 제외** | 수정 전후 학생 반응의 차이 |

14강은 규칙 자체가 그날의 학습 내용(참여 형평성)이므로 가중치를 숨기지 말고 드러낸다.

---

## 11. 1강 상세 명세 — **여기에 가장 많은 공을 들인다**

**1강「좋은 과학 수업은 무엇을 남기는가」**
중심 질문: *과학 수업의 성과를 지식의 양만으로 판단할 수 있는가?*
학생의 말: *"실험도 재미있었고 선생님 설명도 잘 들었는데, 무엇을 배웠는지는 잘 모르겠어요."*
핵심 개념: 과학적 소양 · 학습의 증거 · 과학 정체성 · 학생 주도성
50분: 5분 회상 → 10분 목표 → 15분 두 수업 비교 → 15분 증거 만들기 → 5분 퇴실표

### 단계 1 — 내가 기억하는 과학 수업 (5분) · `step-recall`

- 입력 ①: 기억에 남는 과학 수업 장면을 2~3문장으로.
- 입력 ②: "그 수업에서 **나에게 남은 것**" — 사실 지식 / 실험 장면의 인상 / 설명할 수 있게 된 것 / 스스로 질문했던 경험 / 잘 모르겠다 (복수 선택).
- 제출 전 타인 응답 비공개. 제출 후 익명 분포 + **의견 광장 열림**.
- **18강에서 다시 꺼내 비교하므로 반드시 보존한다.**

### 단계 2 — 과학 수업이 남겨야 하는 것 (10분) · `step-concepts`

개념 카드 4장, 각 카드에 탭 4개.

| 카드 | 먼저 쉽게 (방향) | 헷갈리지 말자 |
|---|---|---|
| 과학적 소양 | 용어를 많이 아는 능력이 아니라, 과학이 필요한 상황에서 증거를 살펴 판단하는 능력 | 생활상식·재미있는 과학 이야기와 다르다 / 교과 개념을 많이 아는 것만으로도 부족하다 |
| 학습의 증거 | 활동을 했다는 사실이 아니라, 학생의 말·그림·행동에서 확인되는 변화 | '수업을 했다'와 '학습이 일어났다'는 다르다 |
| 과학 정체성 | 학생이 자신을 과학을 쓸 수 있는 사람으로 여기는지 | 과학 성적·흥미도와 같지 않다 |
| 학생 주도성 | 목표를 이해하고 선택하고 증거를 점검하며 책임 있게 참여하는 능력 | 교사가 물러나 자유롭게 두는 것과 다르다 |

문구는 컨텍스트 문서 22.1, 23.12, 9절을 근거로 **새로 쓴다.**

- 옆 패널: **PISA 2025 세 역량**(현상 설명 / 탐구 설계와 증거의 비판적 해석 / 과학정보를 조사·평가·사용해 결정하고 행동하기)과 2022 개정의 세 범주(지식·이해, 과정·기능, 가치·태도)를 나란히 놓고 겹치는 부분 표시.
- 카드마다 '잠깐 확인' 1문항: 선택 + **이유 한 줄**. 이유 없이 제출되지 않는다.

### 단계 3 — 두 수업 비교 (15분) · `step-compare`

- 수업 A: 드라이아이스 시범이 성공적으로 끝났지만 학생에게 남은 말이 "연기가 신기했다"뿐인 수업.
- 수업 B: 같은 소재로 학생 예측을 먼저 모으고, 관찰과 해석을 분리하고, 마지막에 학생이 설명을 수정한 수업.
- 두 기록은 **교사 발화와 학생 발화가 섞인 대본 형태**로 쓴다. 요약문이 아니라 실제 수업처럼 읽혀야 한다.

작업: `FourQuadrant`에 각 수업의 **현상 / 목표 / 학생 사고 / 학습의 증거**를 채운 뒤, "수업 A에 빠진 것"을 고르고 이유를 쓴다.
→ 제출 후 **의견 광장 열림.** 반응이 갈린 글이 단계 4 추첨의 후보가 된다.

**AI `recall-probe`** — 학생이 쓴 이유를 받아 되묻는 질문 한 개(`ASK` 형식). 정답 금지, 판정 금지, 점수 금지. "AI가 만든 제안입니다. 최종 판단은 본인이 합니다" 배지 필수. 학생은 이 질문에 답해 이유를 v2로 고칠 수 있고 v1은 남는다.

### 단계 4 — 좋은 수업 경매 + 사다리타기 (15분) · `step-auction` ← **핵심**

요소 카드 8장: 재미있는 현상 / 정확한 설명 / 학생의 질문 / 협력 / **학습의 증거** / 실생활 연계 / 안전 / 모두의 참여

```
4-1  개인 배분     100포인트를 8장에 나눈다 (합계 100 강제). 제출 전 비공개
4-2  모둠 협상     모둠원 배분 공개. 공동 배분 1개 합의
4-3  변호 문장     "우리 모둠이 ___에 가장 많이 준 이유는 ___이다"
4-4  전체 공개     모둠별 배분을 나란히. 가장 갈린 카드를 자동 강조
4-5  사다리타기 ★  자리를 고르고 → 강사가 결과 보기 → 하단 「발표!」 두 칸에 도착한 2명이 4-3을 발표
4-6  재배분        바꾸고 싶으면 바꾼다. 안 바꿔도 된다
4-7  변경 기록     "무엇을 왜 바꿨는가" 또는 "왜 유지했는가"
```

- **4-5는 기존 구현을 그대로 쓴다.** 발표자 수는 기존 동작대로 **2명**이다(`pickPresentSlots`). 인원이 2명 이하면 전원. 모둠마다 1명씩 뽑는 방식은 코드를 고쳐야 하므로 쓰지 않는다.
- 학생 화면 안내 문구는 `ladderGames.ts`의 `lead` 형식을 따른다. 예: *"같은 수업을 두고도 무엇이 가장 중요한지는 갈립니다. 두 분의 이유를 직접 들어보겠습니다."*
- 4-1 배분은 **삭제하지 않고** v1로 남는다. 4-6은 v2. `VersionTimeline`으로 비교.
- 정답 배분은 없다. "정답 표시" 기능을 만들지 않는다.
- 18강에서 같은 배분을 다시 하고 1강과 비교하는 화면을 미리 만들어 둔다.

### 단계 5 — 퇴실표 (5분) · `step-exit`

- 문항 1: "좋은 과학 수업이 남긴 것을 **학생 산출물 하나**로 말한다면?"
- 문항 2: 오늘 바뀐 생각 한 줄
- 문항 3: 확신도 슬라이더

**AI `exit-self-check`** — 학생이 요청할 때만. 자기 문장이 '증거'인지 판단할 **기준 3개**를 제시한다. 학생 문장을 평가하거나 고쳐 쓰지 않는다.

### 강사 콘솔 — `/instructor/lesson/01/live`

진행 제어(단계 열기/닫기, 타이머, 발표 모드) · 강사 대본(`MustSay` 형식, 빼면 안 되는 말과 그 이유) · 제출/미제출 명단 · 의견 광장 조정(고정/숨김/유형 묶기/갈린 글 표시) · 4칸 히트맵 · 모둠별 배분 비교 · 사다리 실행(제외·재추첨·비상 추첨) · 분기 버튼 · 익명 인용함.

**학생 순위, 정답률 랭킹, 개인 점수 비교를 넣지 않는다.**

---

## 12. 2~18강 명세

각 차시의 중심 질문·학습목표·핵심내용·현장 사례·50분 흐름·활동은 **컨텍스트 문서 4절**에 있다. 데이터로 옮기고 아래 모듈과 10.2절 게임을 붙인다.

| 차시 | 제목 | 핵심 모듈 | 재사용 |
|---:|---|---|---|
| 2 | 과학지식은 어떻게 만들어지고 믿을 만해지는가 | 주장－증거－확실성 슬라이더 | ResponseCollector, VersionTimeline |
| 3 | 학생은 빈 그릇이 아니다 | 오개념 분기 면담 | 분기 시나리오 엔진 |
| 4 | 학습이론을 수업 언어로 바꾸기 | 비계 조절 시뮬레이터 | 슬라이더 + 시뮬레이션 |
| 5 | 개념변화는 어떻게 일어나는가 | 예상－관찰－설명 타임라인 | VersionTimeline |
| 6 | 2022 개정 과학과 교육과정 읽기 | 교육과정 맵 | NodeCanvas |
| 7 | 성취기준을 한 차시 수업으로 바꾸기 | 수업 정렬 검사기 | FourQuadrant |
| 8 | 탐구는 실험 순서를 따라 하는 것인가 | 실험 설계 샌드박스 | 파라미터 패널 + 차트 |
| 9 | 과학·공학 실행과 모형 기반 탐구 | 모형 버전 관리 | NodeCanvas, VersionTimeline |
| 10 | 교수·학습 모형을 선택하고 변형하기 | 모형 선택 의사결정 트리 | 분기 시나리오 엔진 |
| 11 | 설명·비유·모형·표상으로 이해시키기 | 표상 번역기 | CardSorter, NodeCanvas |
| 12 | 질문·토론·과학적 논증 | 논증 지도 | NodeCanvas, 동료 피드백 |
| 13 | SSI·기후위기·의사결정 | 의사결정 매트릭스와 결과도 | CardSorter + 차트 |
| 14 | 협동적이고 포용적인 과학 교실 | 참여 균형 대시보드 (**기여 유형**, 발언 횟수 아님) | 참여 네트워크 뷰 |
| 15 | 학습을 움직이는 형성평가 | 실시간 진단과 재응답 | ResponseCollector, DistributionView |
| 16 | 수행평가·루브릭·포트폴리오 | 루브릭 스튜디오 | RubricScorer |
| 17 | 디지털·AI·시뮬레이션을 이용한 과학 수업 | AI 응답 검증 보드 | AiAssistPanel |
| 18 | PCK 기반 수업 설계와 마이크로티칭 | 마이크로티칭 코치 (관찰 코드 E·P·R·W·F·A·C) | 영상 주석기, RubricScorer |

**작성 수준:** 메타데이터·개념 카드의 '먼저 쉽게'와 '헷갈리지 말자'·강사 대본은 **전부 채운다.** 의견 광장은 차시마다 최소 2개 단계에, 게임은 1개씩. 핵심 모듈은 **작동하는 최소 형태**까지. 완성도는 1강보다 낮아도 되지만 화면이 비어 있으면 안 된다.

---

## 13. 공개 제어 (요구사항 6)

- 시드에서 **1강만 `published: true`**, 2~18강은 `false`.
- `/instructor/lessons`에서 행마다 공개 토글. 토글 시 `publishedAt` 기록.
- 공개를 끌 때 "이미 제출한 응답은 남습니다. 학생 화면에서만 숨겨집니다" 확인.
- 학생 홈에는 공개된 차시만. 미공개 차시는 **개수도 제목도 노출하지 않는다.**
- Firestore 규칙에서도 막는다. 프론트 필터링만으로 처리하지 않는다.

---

## 14. AI 사용 규칙

허용 `taskId`를 서버 화이트리스트로 고정한다. 목록에 없으면 거부.

| taskId | 쓰는 곳 | 출력 제약 |
|---|---|---|
| `recall-probe` | 되묻는 질문 | `ASK` 형식 — 물음표로 끝나는 한 문장. 정답·판정 금지 |
| `cluster-responses` | 교사용 응답·의견 유형 묶기 | 묶음 이름 + 대표 문장. **제안일 뿐, 교사가 수정 가능** |
| `exit-self-check` | 학생 자기 점검 기준 | 판단 기준 3개. 학생 문장 평가·수정 금지 |
| `ai-audit-source` | 17강 AI 검증 보드 | 검증할 주장 단위로 쪼개기만 |
| `rubric-language-check` | 16강 루브릭 모호 표현 | 모호한 구절 표시 + 대안 예시 |

공통 금지: 개인정보·닉네임을 프롬프트에 넣지 않는다 / AI가 점수를 매기지 않는다 / 출력에 모델명·시각·"사람이 최종 판단합니다" 표시 / 채택했을 때만 저장하고 채택 여부를 기록한다.

---

## 15. 접근성과 저기술 대안 (컨텍스트 19.10) — 타협 불가

드래그 전용 금지(정렬·배분·자리 고르기 전부 키보드/숫자 입력 대안) / 색만으로 상태 구분 금지 / 키보드만으로 전체 조작 + 포커스 표시 / 영상 자막·대본, 이미지 대체 설명 / 200% 확대에서 정보 유지 / 제한 시간 연장 가능 / `prefers-reduced-motion` 존중(추첨 애니메이션 포함) / 차시별 **인쇄 가능한 동일 목표 활동지** / 저용량 모드 / **모바일 375px 실측**.

---

## 16. 하지 말 것

1. 교재 '심화 읽기'의 OCR 원문을 화면 텍스트로 복사하기
2. 교재의 72회 반복 템플릿 문구를 그대로 쓰기
3. **Cloudflare에서 `generativelanguage.googleapis.com` 호출하기** (2.3 ①)
4. **AI 실패를 5xx로 던지기** (2.3 ②)
5. API 키·서비스 계정을 `VITE_` 변수나 클라이언트 코드에 넣기
6. `firebase-admin` 패키지 설치
7. 클라이언트가 보낸 프롬프트 문자열을 그대로 모델에 전달하기
8. 의견 광장에 좋아요·인기순 정렬·베스트 글 만들기
9. 학생 순위표, 정답 속도 경쟁, 배지 남발
10. 틀린 답을 고른 사람을 발표자로 지목하는 추첨
11. 학생의 최초 응답이나 의견 원문을 덮어쓰기
12. 강사 단계 이동 시 학생 화면을 강제로 옮기기
13. 미공개 차시 내용을 클라이언트로 보낸 뒤 CSS로만 숨기기
14. AI 판단을 확정으로 표시하기
15. 드래그 전용 인터랙션
16. 강사 권한을 클라이언트 boolean으로 판정하기
17. 「○○분 뒤 ___를 가지고 나가시게 됩니다」 형태의 약속 문구 쓰기
18. `DESIGN.md`를 받기 전에 시각 스타일 확정하기

---

## 17. 개발 순서

각 단계 끝에서 멈추고 사용자 확인을 받는다.

**1단계 — 최소 기능 제품 (이번 주 목표)**
1. 프로젝트 초기화. **기존 저장소에서 `ladder.ts`, `verify-ladder.mjs`, `ai-core.ts` 인증부, `AppShell`, `Wall`, `MustSay` 이관**
2. Cloudflare Pages 배포 파이프라인 + Firebase 연결 + **로컬 저장 모드 폴백**
3. 인증 전체 (학번 로그인, 닉네임 설정, CSV 가져오기, 비밀번호 초기화, 강제 재설정)
4. Firestore 스키마 + 보안 규칙 + 규칙 테스트
5. 재사용 컴포넌트 골격
6. **1강 전체 5단계 완성 (사다리타기 포함)**
7. 강사 실시간 콘솔 + 발표 모드 + 강사 대본
8. 18개 차시 메타데이터 시드 + 공개 토글
9. 검증 스크립트 세트

**2단계** — 모형 캔버스, 데이터 스튜디오, 논증 빌더, 루브릭 스튜디오(9·11·12·16강) + 나머지 17개 게임
**3단계** — 마이크로티칭 영상 주석, 교육과정 메타데이터 검색, 익명 학습 분석(18강)
**4단계** — AI 응답 분류·피드백 제안. **교사의 검토·수정·거부 기능이 먼저 완성된 뒤에만 착수**

---

## 18. 검증 스크립트

기존 `verify:ladder` / `verify:subjects` 방식을 확장한다. 배포 전에 전부 통과해야 한다.

```
npm run verify:ladder      기존 이관 — 전단사·가로줄 인접 금지·발표자 수·씨앗 재현성·좌우 이동률
npm run verify:lessons     18개 차시 메타데이터 스키마 충족, 빈 필드 없음,
                           강사 대본·핵심 개념 4개가 모두 채워졌는지
npm run verify:content     교재 OCR 오독 문자열과 72회 반복 템플릿 문구가
                           소스·시드 데이터에 섞이지 않았는지
npm run verify:standards   원문 대조를 마치지 않은 성취기준에 「대표 예시」 라벨이 있는지
npm run verify:games       18개 게임이 모두 등록되어 있고 mode 값이 서로 다른지,
                           1강이 ladder 모드인지
npm run verify:wall        의견 광장이 각 차시 2개 이상 단계에 붙어 있는지,
                           인기순 정렬 코드가 없는지
npm run verify:a11y        드래그 전용 없음, 포커스 표시, 대체 텍스트, reduced-motion 분기
npm run verify:publish     시드 상태에서 1강만 published:true 인지
```

매 배포마다: `tsc` · `eslint` · `build` 통과, 콘솔 오류 0, 모바일 375px 실측, 배포 커밋 해시와 번들 파일명 기록.

---

## 19. 완료 판정 기준 (컨텍스트 19.13)

커밋 메시지나 PR 설명에 답을 적는다.

1. 어떤 학습목표와 학생 행동을 지원하는가?
2. 그 행동이 저장된 자료에서 확인되는가?
3. 교수자가 그 자료로 수업을 바꿀 수 있는가?
4. 학생이 자신의 생각을 수정할 기회가 있는가?
5. 기기·언어·장애 때문에 생기는 불필요한 장벽을 줄였는가?
6. 개인정보 최소 수집과 삭제가 가능한가?
7. AI가 포함되면 결과의 근거와 한계를 사람이 검토할 수 있는가?

---

## 20. 환경 변수

```
# Cloudflare Pages — 서버 전용 (VITE_ 접두사 금지)
GCP_SERVICE_ACCOUNT           # Vertex AI + Identity Toolkit 공용
GEN_AI_MODEL                  # 기본 gemini-2.5-flash-lite
AI_RATE_PER_MIN               # 기본 6
FIREBASE_PROJECT_ID

# 클라이언트 (Firebase 웹 설정값 — 공개되어도 무방, 보안은 규칙으로)
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_APP_ID
VITE_STUDENT_EMAIL_DOMAIN
```

`.env.example`을 만들고 `.env`는 `.gitignore`에 넣는다.

---

## 21. 시작하기 전에 사용자에게 물어볼 것

1. `DESIGN.md`를 지금 받을 수 있는가, 아니면 구조부터 만들고 나중에 입힐까?
2. 기존 저장소를 새로 포크해서 시작할까, 빈 프로젝트에 파일만 옮길까?
3. 수강생 인원과 모둠 크기
4. Firebase 프로젝트와 Cloudflare Pages 프로젝트를 기존 것과 공유할까, 새로 만들까
5. 1강 강의 예정일 (1단계 범위를 조정한다)
6. 배포 도메인 (`slstudio.labbitory.com` 같은 형태)
7. 학생 응답·의견 데이터를 학기 종료 후 얼마나 보관하고 언제 삭제할 것인가

---

판단이 갈리면 **컨텍스트 문서를 근거로 결정하고 어떤 절을 근거로 삼았는지 밝힌다.** 구현이 갈리면 **기존 저장소에서 이미 검증된 방식을 따른다.**
