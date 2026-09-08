# Science Lesson Studio

경희대학교 「과학교육론」·「과학교과교수법」 18차시 강의를 웹앱 안에서 전부 진행하기 위한 단일 애플리케이션.

수강생은 예비 과학교사다. 한 학기 동안 같은 수업 주제를 발전시키며 자기 생각을 제출하고 →
동료와 비교하고 → 수정하고 → 그 변화를 포트폴리오로 남긴다.
**슬라이드 뷰어가 아니라 학생의 사고 변화를 기록하는 도구다.**

## 세 가지 원칙

1. **최초 답을 지우지 않는다.** 모든 응답은 버전으로 쌓인다.
2. **정답 속도가 아니라** 설명의 질, 증거 사용, 근거 있는 수정에 보상한다.
3. **학생 순위를 만들지 않는다.** 지표는 교수자의 다음 수업 결정과 학생의 자기 확인에 쓴다.

## 지금 할 수 있는 일

```bash
npm install
npm run dev          # http://localhost:5173
```

`.env` 가 없어도 뜬다. **로컬 저장 모드**로 떨어져 개인 작성·자동 저장·인쇄가 그대로 동작하고,
실시간 공유만 "내 것"만 보인다. 상단바가 어느 모드인지 항상 표시한다.

## 배포 전 검증

```bash
npm run verify
```

열세 가지를 본다. 하나라도 실패하면 배포하지 않는다.

| 스크립트 | 무엇을 막는가 |
|---|---|
| `verify:ladder` | 전단사 · 가로줄 인접 금지 · 발표자 수 · 씨앗 재현성 · 좌우 이동률 70% |
| `verify:lessons` | 18차시 메타데이터, 개념 카드 여섯 층, 강사 대본이 전부 채워졌는지 |
| `verify:classes` | 학기 간 자료 격리, 실명이 강사 전용 경로에만 있는지 |
| `verify:content` | 교재 OCR 오독과 72회 반복 템플릿 문구가 화면 문구에 새어 들어왔는지 |
| `verify:wording` | 하루짜리 연수의 말(퇴실표·참가자·담벼락)이 남았는지, 이름을 바꾸다 만 단계가 있는지, 화면에 「○분」이 남았는지 |
| `verify:api` | 서버 호출에 인증 토큰이 붙는가, 호출자를 확인하지 않는 서버 함수가 있는가 |
| `verify:tiers` | 50분 판에 빈 차시가 없는지, 절대 빼면 안 되는 넷이 남았는지, 뺀 것이 사라지지 않았는지 |
| `verify:standards` | 원문 대조 전 성취기준에 「대표 예시」 라벨이 붙어 있는지 |
| `verify:games` | 18개 게임 등록, mode 고유, 1강이 ladder, 정답 기준 추첨 없음, **18종 화면이 실제로 구현됐는지** |
| `verify:modules` | 핵심 모듈이 지정된 차시에 붙었는지, **AI가 교사 검토를 우회하는 경로가 없는지** |
| `verify:wall` | 의견 광장이 차시마다 2단계 이상, 인기순 정렬 코드가 없는지 |
| `verify:a11y` | 드래그 전용 없음, 포커스 표시, 대체 텍스트, reduced-motion, 인쇄 활동지 |
| `verify:publish` | 시드에서 1강만 공개, 보안 규칙에 published 조건과 강사 문서 판정이 있는지 |

검증기는 문자열이 아니라 **실제 불변식**을 본다. 예를 들어 `verify:games` 는 손으로 관리하는
목록이 아니라 `PickerVisual.tsx` 의 `case '…':` 를 직접 읽고, `verify:modules` 는
"cluster-responses 라는 낱말이 있는가"가 아니라 "그 taskId 를 실제로 보내는 파일이
`addAiProposal` 을 거치는가"를 본다. `verify:wording` 도 마찬가지로 금지어만 찾지 않고
타임라인이 가리키는 단계가 실제로 있는지 대조한다 — 열여덟 차시 중 하나만 놓쳐도
그 차시의 링크가 죽는데 화면을 열기 전에는 드러나지 않는다.

```bash
npm run build        # tsc + vite build
```

## 구조

```
src/
  lib/ladder.ts            사다리 순수 계산 — React도 Firestore도 Math.random()도 없다
  lib/repo.ts              저장 계층 인터페이스 (Firestore / 로컬 두 구현이 이 모양을 공유)
  lib/auth.tsx             학번 로그인, 강사 판정, 로컬 모드 폴백
  content/lessons/         18차시 시드 데이터 (개념 72개 × 여섯 층)
  content/games.ts         발표자 뽑기 18종
  content/curriculum.ts    교육과정 메타데이터 (판·학교급·학년·영역·성취기준·핵심 아이디어·적용 연도)
  content/reactions.ts     반응 4종 · 정렬 옵션 (여기만 고치면 되돌릴 수 있다)
  components/activity/     PickerVisual(18종 화면) · NodeCanvas · DataStudio · CardSorter
                           RubricStudio · AiAuditBoard · CurriculumMap · ModuleHost
  components/microteaching/ VideoAnnotator (영상은 브라우저 밖으로 나가지 않는다)
  components/teach/        LadderPanel · MustSay · TeacherBranchBar · AiClusterPanel
  routes/                  수강생 화면과 강사 화면
shared/ai-core.ts          AI 프록시 로직 (Pages Function 은 껍데기만)
functions/api/             Cloudflare Pages Functions
firestore.rules            보안 규칙
scripts/verify-*.mjs       검증 스크립트
SPEC.md                    구축 지시서 (작업 내내 기준)
DESIGN.md                  시각 디자인 (모든 시각 판단보다 우선)
```

## 차시별 핵심 모듈

| 차시 | 모듈 | 하는 일 |
|---:|---|---|
| 6 | 교육과정 맵 | 판·학교급·영역으로 성취기준을 찾고 네 층으로 해부한다 |
| 8 | 실험 설계 샌드박스 | 표본·흩어짐·**체계 오차**·효과를 바꾸며 결론의 확실성이 어떻게 달라지는지 본다 |
| 9 | 모형 캔버스 | 요소·관계·경계를 그리고 v1→v2로 고친다. 연결선에 관계어가 없으면 저장되지 않는다 |
| 11 | 표상 번역기(카드 분류) | 비유의 대응/비대응을 가르고 카드마다 이유를 적는다 |
| 12 | 논증 지도 | 주장·증거·추론·반론을 잇는다. 같은 캔버스 부품을 논증 모드로 쓴다 |
| 16 | 루브릭 스튜디오 | 모호한 낱말을 규칙으로 찾고, 수준마다 앵커를 요구하고, 채점이 갈린 자리를 보인다 |
| 17 | AI 응답 검증 보드 | 문장마다 사실/해석/출처 필요/불확실/오류를 표시하고 원출처를 남긴다 |
| 18 | 마이크로티칭 주석 | 관찰 코드로 시간축에 기록하고 1차 수업과 재수업을 나란히 놓는다 |

8강 샌드박스는 "표본을 늘리면 확실해진다"를 가르치지 않는다. 체계 오차를 켜 두면
표본을 열 배로 늘려도 치우친 값으로 수렴한다는 것을 학생이 직접 보게 되어 있다.

## AI는 교사를 지나야 학생에게 간다

지시서 17절이 4단계의 선행 조건으로 못박은 것을 그대로 구현했다.

```
AI 분류 요청  →  addAiProposal (status: pending)  →  /instructor/ai-review
                                                        ├ 읽고 고친다  (원문은 그대로 남는다)
                                                        ├ 채택한다     → 학생 화면에 나간다
                                                        └ 거부한다     → 이유를 적어야 한다
```

- 제안은 언제나 `pending` 으로 들어온다. Firestore 규칙이 그것을 강제한다.
- `original` 은 규칙에서 잠겨 있다. 무엇이 AI 원문이었는지 나중에 확인할 수 있다.
- 거부한 제안도 지우지 않는다 (`allow delete: if false`).
- 학생용 AI 패널은 교사용 분류 작업을 **타입에서** 받지 못한다(`Exclude<AiTaskId, 'cluster-responses'>`).

## 배포 (Cloudflare Pages)

빌드 명령 `npm run build`, 출력 디렉터리 `dist`.

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

#### ① 구글 클라우드에서 API 를 켠다

역할만 주면 되는 줄 알았다가 막혔다. **역할과 별개로 API 자체를 켜야 한다.**
켜지 않으면 403 `... API has not been used in project ... or it is disabled` 가 돌아온다.

| API | 무엇이 막히는가 | 어디서 켜는가 |
|---|---|---|
| `aiplatform.googleapis.com` (Vertex AI) | AI 도움 전부 | [사용 설정](https://console.developers.google.com/apis/api/aiplatform.googleapis.com/overview?project=scienced-e721d) |
| `identitytoolkit.googleapis.com` | 학생 계정 만들기·비밀번호 초기화 | Firebase 프로젝트면 기본으로 켜져 있다 |
| `firestore.googleapis.com` | 명단 문서 저장 | Firestore 를 만들면 함께 켜진다 |

**Vertex AI 는 무료 등급이 없다.** 프로젝트에 결제 계정이 연결되어 있어야 하고,
없으면 API 를 켜도 호출이 실패한다. 켠 뒤 반영까지 몇 분 걸린다 — 바로 눌러 보고 안 되면 잠시 뒤 다시 한다.

#### ② IAM 역할

서비스 계정 하나로 세 가지를 한다. IAM 역할도 셋 다 있어야 한다.

| 하는 일 | 필요한 역할 |
|---|---|
| AI 프록시 (Vertex AI) | `Vertex AI 사용자` |
| 학생 계정 만들기 | `Firebase 인증 관리자` |
| 명단 문서 저장 (Firestore) | `Cloud Datastore 사용자` |

하나라도 빠지면 그 기능만 조용히 막힌다. 서버는 5xx 를 던지지 않고 200 + ok:false 로 돌려주므로
화면에는 안내 문구로만 보인다. 「계정 만들기」가 0명으로 끝나면 이 표부터 확인한다.

**클라이언트** — Firebase 웹 설정값. 공개되어도 무방하다(보안은 규칙이 한다).
값은 `.env.example` 에 그대로 있으니 복사해 넣으면 된다.

### Firebase 준비

1. Authentication → 이메일/비밀번호 로그인 켜기
2. `firestore.rules` 배포
   ```bash
   npm run firebase:login
   ```
   ```bash
   npm run deploy:rules
   ```

   > `npx firebase …` 는 쓰지 않는다. 이 저장소에는 클라이언트 SDK 인 `firebase` 패키지가
   > 이미 설치돼 있어서 npx 가 그것을 찾고 `could not determine executable to run` 으로 멈춘다.
   > CLI 패키지 이름은 `firebase-tools` 이고, 위 스크립트가 `--package=firebase-tools` 로 못박아 둔다.
3. **강사 계정을 만든 뒤 콘솔에서 `instructors/{uid}` 문서를 손으로 만든다.**
   이 문서의 존재가 강사 권한의 유일한 근거다. 어떤 클라이언트도 이 컬렉션에 쓸 수 없다.
4. 강사로 로그인 → `수강생 관리` → CSV(`학번,이름`) 업로드. 초기 비밀번호는 학번이다.

## 지시서에서 벗어난 판단 세 가지

각각 컨텍스트 문서를 근거로 정했고, 되돌리기 쉽게 한 곳에 모아 두었다.

1. **`toggleLike` → `toggleReaction`** (`src/lib/repo.ts`)
   지시서 2.2는 기존 저장소의 이름을 유지하라고 했지만, 9.3이 좋아요 하나를 반응 4종으로 바꾼다.
   이름을 그대로 두면 하는 일과 이름이 어긋난다. 나머지 이름은 전부 그대로다.

2. **한글 서체로 Pretendard 추가** (`index.html`)
   DESIGN.md 는 figmaSans 대체로 Inter 를 지정했지만 Inter 에는 한글이 없다.
   Pretendard 는 Inter 와 같은 굵기 축을 목표로 만든 한국어 서체라 320~700 미세 단계를 그대로 쓴다.

3. **성취기준 코드를 아직 넣지 않았다**
   18차시 모두 `curriculumLink.verified: false` 이고 화면에 「대표 예시」로 표시된다.
   NCIC 원문과 대조한 뒤 코드를 넣고 `verified` 를 켠다. `verify:standards` 가 이 순서를 강제한다.

## 하지 않은 것

지시서 16절의 금지 항목은 코드로 막았다. 특히:

- 교재 '심화 읽기' OCR 원문을 화면 텍스트로 복사하지 않았다 (`verify:content`)
- Cloudflare 에서 `generativelanguage.googleapis.com` 을 부르지 않는다 — Vertex AI 를 쓴다
- AI 실패를 5xx 로 던지지 않는다 — 오류여도 HTTP 200 + JSON
- `firebase-admin` 을 설치하지 않았다 — WebCrypto 로 JWT 를 직접 서명한다
- 의견 광장에 좋아요·인기순·베스트 글이 없다
- 틀린 답을 고른 사람을 발표자로 지목하는 추첨이 없다
- 강사가 단계를 옮겨도 학생 화면이 강제로 이동하지 않는다 — 안내와 이동 버튼만 뜬다
- 드래그 전용 인터랙션이 없다 — 배분은 숫자 입력, 순위는 버튼

## 진행 상황

지시서 17절의 네 단계를 전부 구현했다.

| 단계 | 상태 |
|---|---|
| 1단계 최소 기능 제품 | 완료 — 사다리, 인증, 스키마·규칙, 1강 전체, 진행 콘솔, 18차시 시드, 검증 |
| 2단계 | 완료 — 모형 캔버스, 데이터 스튜디오, 논증 지도, 루브릭 스튜디오, **18종 게임 화면** |
| 3단계 | 완료 — 마이크로티칭 영상 주석, 교육과정 메타데이터 검색, 익명 학습 분석 |
| 4단계 | 완료 — AI 응답 분류. **교사 검토·수정·거부 관문을 먼저 만들고 그 뒤에 붙였다** |

### 아직 남은 것

- **성취기준 원문 대조.** `content/curriculum.ts` 와 18차시 모두 `verified: false` 다.
  NCIC 원문과 맞춰 코드를 넣고 `verified` 를 켜야 「대표 예시」 라벨이 없어진다.
- **Firestore 규칙 에뮬레이터 테스트.** 규칙은 썼고 `verify:publish` 가 형태를 검사하지만,
  에뮬레이터로 실제 읽기·쓰기를 돌려 보는 테스트는 아직 없다.
- **실기기 확인.** 모바일 375px 은 CSS 로 대응했으나 실제 기기에서 재 보지 않았다.
- **AI 피드백 제안.** 분류(`cluster-responses`)는 붙였다. 개별 학생 피드백 제안은
  같은 검토 관문을 쓰면 되지만 아직 만들지 않았다.

## 참조

- `SPEC.md` — 구축 지시서
- `DESIGN.md` — 시각 디자인
- `과학교육론_과학교과교수법_통합강의_컨텍스트.md` — 설계의 최상위 기준 (저장소에 넣지 않는다)
- `과학교육론과_과학교과교수법_18강_통합교재.docx` — 차시별 원자료 (저장소에 넣지 않는다)
