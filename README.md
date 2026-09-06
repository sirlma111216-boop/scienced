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

여덟 가지를 본다. 하나라도 실패하면 배포하지 않는다.

| 스크립트 | 무엇을 막는가 |
|---|---|
| `verify:ladder` | 전단사 · 가로줄 인접 금지 · 발표자 수 · 씨앗 재현성 · 좌우 이동률 70% |
| `verify:lessons` | 18차시 메타데이터, 개념 카드 여섯 층, 강사 대본이 전부 채워졌는지 |
| `verify:content` | 교재 OCR 오독과 72회 반복 템플릿 문구가 화면 문구에 새어 들어왔는지 |
| `verify:standards` | 원문 대조 전 성취기준에 「대표 예시」 라벨이 붙어 있는지 |
| `verify:games` | 18개 게임 등록, mode 고유, 1강이 ladder, 정답 기준 추첨 없음 |
| `verify:wall` | 의견 광장이 차시마다 2단계 이상, 인기순 정렬 코드가 없는지 |
| `verify:a11y` | 드래그 전용 없음, 포커스 표시, 대체 텍스트, reduced-motion, 인쇄 활동지 |
| `verify:publish` | 시드에서 1강만 공개, 보안 규칙에 published 조건과 강사 문서 판정이 있는지 |

```bash
npm run build        # tsc + vite build
```

## 구조

```
src/
  lib/ladder.ts          사다리 순수 계산 — React도 Firestore도 Math.random()도 없다
  lib/repo.ts            저장 계층 인터페이스 (Firestore / 로컬 두 구현이 이 모양을 공유)
  lib/auth.tsx           학번 로그인, 강사 판정, 로컬 모드 폴백
  content/lessons/       18차시 시드 데이터 (개념 72개 × 여섯 층)
  content/games.ts       발표자 뽑기 18종
  content/reactions.ts   반응 4종 · 정렬 옵션 (여기만 고치면 되돌릴 수 있다)
  components/            AppShell · ResponseCollector · VersionTimeline · Wall · Ladder · MustSay …
  routes/                수강생 화면과 강사 화면
shared/ai-core.ts        AI 프록시 로직 (Pages Function 은 껍데기만)
functions/api/           Cloudflare Pages Functions
firestore.rules          보안 규칙
scripts/verify-*.mjs     검증 스크립트
SPEC.md                  구축 지시서 (작업 내내 기준)
DESIGN.md                시각 디자인 (모든 시각 판단보다 우선)
```

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

**클라이언트** — Firebase 웹 설정값. 공개되어도 무방하다(보안은 규칙이 한다).
값은 `.env.example` 에 그대로 있으니 복사해 넣으면 된다.

### Firebase 준비

1. Authentication → 이메일/비밀번호 로그인 켜기
2. `firestore.rules` 배포
   ```bash
   npx firebase deploy --only firestore:rules
   ```
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

## 남은 일

**2단계** 모형 캔버스 · 데이터 스튜디오 · 논증 빌더 · 루브릭 스튜디오(9·11·12·16강),
그리고 나머지 17개 게임의 고유 화면(지금은 전부 사다리 엔진을 공유하고 안내 문구만 다르다).

**3단계** 마이크로티칭 영상 주석, 교육과정 메타데이터 검색, 익명 학습 분석.

**4단계** AI 응답 분류·피드백 제안. **교사의 검토·수정·거부 기능이 먼저 완성된 뒤에만 착수한다.**

## 참조

- `SPEC.md` — 구축 지시서
- `DESIGN.md` — 시각 디자인
- `과학교육론_과학교과교수법_통합강의_컨텍스트.md` — 설계의 최상위 기준 (저장소에 넣지 않는다)
- `과학교육론과_과학교과교수법_18강_통합교재.docx` — 차시별 원자료 (저장소에 넣지 않는다)
