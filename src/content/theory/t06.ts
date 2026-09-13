import type { LessonTheory } from '../types'

/**
 * 6강 — 2022 개정 과학과 교육과정 읽기
 *
 * 지시서 M 의 네 항목(2022 개정 고시 · 핵심 아이디어와 개념 기반 교육과정 · 내용 체계 세 범주 · 학습 진행)에
 * 「깊이 있는 학습」 카드에 붙일 항목(NRC 2012 의 「깊은 학습」)을 더했다.
 * ★ 고시본의 조항 번호·별책 번호는 원문을 대조하기 전이다. verified 를 켜기 전에 반드시 확인한다.
 */
export const t06: LessonTheory = {
  summary:
    '이 차시가 읽는 문서는 2022년 12월 교육부가 고시한 과학과 교육과정이다. 그 문서의 구조 — 영역마다 「핵심 아이디어」를 앞세우고 내용 요소를 지식·이해 / 과정·기능 / 가치·태도 세 범주로 나란히 적는 것 — 는 2000년대 미국의 개념 기반 교육과정(Erickson·Lanning)과 「소수의 큰 아이디어를 깊이」라는 국제적 흐름에서 왔다. ' +
    '성취기준을 학년에 걸쳐 이어지는 사고의 발달로 읽는 눈은 2000년대 후반의 「학습 진행(learning progression)」 연구에서 왔고, 총론이 내세운 「깊이 있는 학습」은 미국 국립연구위원회가 2012년 정리한 「깊은 학습(deeper learning)」과 같은 자리에 있다. ' +
    '이 차시가 성취기준의 동사에 밑줄부터 치는 것은, 이 문서들이 한결같이 「무엇을 아는가」가 아니라 「무엇을 할 수 있는가」로 목표를 적기 때문이다.',
  entries: [
    {
      id: 't06-curriculum',
      termKo: '2022 개정 과학과 교육과정',
      termEn: '2022 Revised National Science Curriculum (Korea)',
      scholars: [{ nameKo: '교육부', nameEn: 'Ministry of Education, Korea', year: '2022' }],
      claim:
        '교육부 고시 제2022-33호로 고시된 국가 교육과정이다. 과학과는 별책으로 묶여 있으며, 「성격·목표·내용 체계 및 성취기준·교수·학습 및 평가」의 순서로 적혀 있다. ' +
        '2015 개정과 견주어 달라진 구조 셋 — ① 영역마다 **핵심 아이디어**가 앞에 오고 내용 요소가 그 아래 매달린다 ② 내용 체계가 **지식·이해 / 과정·기능 / 가치·태도** 세 범주로 나란히 적힌다 ③ 평가가 「도달했는가」에서 **「학습을 움직이는가」** 로 방향을 튼다. ' +
        '적용은 학년별로 순차적이라 2026년 현재 학교에는 두 교육과정이 함께 있다.',
      bridgeToPlain:
        '이 차시 전체가 이 문서를 읽는 연습이다. 「성취기준」 카드의 「2015 의 코드만 바꾼 것이 아니다 — 내용 체계와 평가 방향이 함께 바뀌었다」가 위의 세 가지이고, 첫 단계의 「두 계획서의 발행 연도를 먼저 보라」가 순차 적용 때문이다. ' +
        '이 앱의 교육과정 맵에 있는 성취기준 문장은 전부 「대표 예시」다 — 원문 대조 전에는 코드를 붙이지 않는다.',
      limits:
        '국가 교육과정 문서는 「무엇을」은 적지만 「어떻게」는 거의 적지 않는다. 핵심 아이디어를 앞세운 구조가 실제 교과서와 수업에서 어떻게 구현되는지는 문서 밖의 일이고, 교과서가 여전히 내용 요소 목록 순서로 짜인다는 지적이 있다. ' +
        '또 총론의 「깊이 있는 학습」 「학생 주도성」 같은 말은 정의가 느슨해 학교마다 다르게 읽힌다. 이 차시가 성취기준의 동사에서 시작하는 것은 그 느슨함을 문장 수준에서 붙들려는 것이다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 6장',
      readings: [
        { title: '교육부 (2022). 과학과 교육과정. 교육부 고시 제2022-33호 [별책]. — 국가교육과정정보센터(NCIC)에서 원문 열람', url: 'https://ncic.re.kr' },
      ],
      linkedConceptId: 'c06-standard',
      plainTerms: ['2022 개정 성취기준은 2015 의 코드만 바꾼 것이 아니다'],
      oneLine: '2022년 고시된 국가 교육과정. 핵심 아이디어를 앞세우고, 내용을 세 범주로 적고, 평가의 방향을 튼다.',
      verified: false,
    },
    {
      id: 't06-erickson',
      termKo: '핵심 아이디어와 개념 기반 교육과정',
      termEn: 'big ideas / concept-based curriculum and instruction',
      scholars: [
        { nameKo: '린 에릭슨', nameEn: 'H. Lynn Erickson' },
        { nameKo: '로이스 래닝', nameEn: 'Lois A. Lanning', year: '2014·2017' },
      ],
      claim:
        'Erickson 과 Lanning 은 교육과정을 사실의 목록이 아니라 **지식의 구조(Structure of Knowledge)** 로 그렸다 — 사실(facts) → 주제(topics) → 개념(concepts) → 일반화·원리(generalizations/principles) → 이론(theory). 사실과 주제는 시간과 장소에 묶여 있고, 개념과 일반화는 그것들을 가로질러 **전이**된다. ' +
        '그래서 교육과정은 일반화(=핵심 아이디어) 수준에서 목표를 적어야 하고, 수업은 사실을 통해 개념으로, 개념을 통해 일반화로 올라가는 「시너지적 사고」를 요구해야 한다. 2022 개정의 「핵심 아이디어」가 이 자리의 일반화다.',
      bridgeToPlain:
        '이 카드의 「먼저 쉽게」 — 「여러 사실을 묶어 설명하고 새 현상에도 다시 쓸 수 있는 큰 생각」 — 이 지식의 구조에서 일반화 층이다. 「더 읽기」의 「핵심 아이디어인지 아닌지 가르는 시험」 두 질문(새 현상에 쓰이는가, 여러 학년에 되풀이되는가)이 사실과 일반화를 가르는 Erickson 의 기준이다.',
      limits:
        '「지식의 구조」는 교과에 따라 잘 맞지 않는다. 과학처럼 일반화가 뚜렷한 교과에서는 잘 통하지만, 과정 중심 교과(언어·예술)에는 Lanning 이 따로 「과정의 구조」를 만들어야 했다. ' +
        '또 「개념 기반」이 상품화되면서 실제 수업에서는 일반화 문장을 판서하고 끝내는 형식화가 흔하다 — 이 카드의 「판서로 끝내면 안 되는 이유」가 그 비판이다. Erickson 자신은 일반화는 학생이 도달해야 하는 것이지 교사가 주는 것이 아니라고 했다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 6장',
      readings: [
        { title: 'Erickson, H. L., & Lanning, L. A. (2014). Transitioning to Concept-Based Curriculum and Instruction. Corwin.' },
        { title: 'Erickson, H. L., Lanning, L. A., & French, R. (2017). Concept-Based Curriculum and Instruction for the Thinking Classroom (2nd ed.). Corwin.' },
      ],
      figure: {
        purpose: '핵심 아이디어가 사실의 요약이 아니라 사실 위에 놓인 다른 층이라는 것을 한눈에 보게 한다.',
        mustShow: [
          '위로 갈수록 좁아지는 가로 띠 다섯 개가 쌓인 피라미드',
          '맨 아래 두 띠는 점 무늬로 채워짐(사실·주제), 위 세 띠는 비어 있음',
          '넷째 띠(일반화)가 굵은 테두리로 강조됨',
        ],
        mustNotShow: ['그림 안의 어떤 글자도', '책·전구 같은 아이콘', '사람의 모습'],
        labels: [
          { text: '사실', position: '맨 아래 띠', x: 50, y: 90 },
          { text: '주제', position: '둘째 띠', x: 50, y: 72 },
          { text: '개념', position: '셋째 띠', x: 50, y: 54 },
          { text: '일반화 · 핵심 아이디어', position: '넷째 띠(강조)', x: 50, y: 36 },
          { text: '이론', position: '맨 위', x: 50, y: 16 },
        ],
        legend: '아래 두 층은 시간·장소에 묶여 있고, 위 세 층은 그것을 가로질러 전이된다.',
        genPrompt:
          'Minimal flat diagram on white background: a five-tier pyramid made of horizontal bands that narrow toward the top. The bottom two bands are filled with a fine dot pattern; the upper three bands are empty. The fourth band from the bottom has a noticeably thicker outline. Clean vector style, black lines. No text, no letters, no icons.',
        altText:
          '흰 바탕에 다섯 층으로 쌓인 피라미드가 있다. 아래에서부터 사실, 주제, 개념, 일반화(핵심 아이디어), 이론이며 아래 두 층은 점 무늬로 채워져 있고 위 세 층은 비어 있다. 넷째 층인 일반화가 굵은 테두리로 강조되어 있다.',
        fallback: '다섯 낱말을 아래에서 위로 판서하고 「일반화 = 핵심 아이디어」에 상자를 친다.',
        license: '직접 제작',
      },
      linkedConceptId: 'c06-bigidea',
      plainTerms: ['여러 사실을 묶어 설명하고 새 현상에도 다시 쓸 수 있는 큰 생각'],
      oneLine: '사실 → 주제 → 개념 → 일반화 → 이론. 핵심 아이디어는 사실을 가로질러 전이되는 일반화 층이다.',
      verified: false,
    },
    {
      id: 't06-categories',
      termKo: '내용 체계의 세 범주',
      termEn: 'three categories of content: knowledge·understanding / process·skill / value·attitude',
      scholars: [{ nameKo: '교육부', nameEn: 'Ministry of Education, Korea', year: '2022' }],
      claim:
        '2022 개정 교육과정 총론이 모든 교과의 내용 체계에 도입한 틀이다. 영역마다 핵심 아이디어 아래에 **지식·이해**(개념·원리·모형), **과정·기능**(학생이 수행하는 교과 고유의 사고와 행동), **가치·태도**(참여·책임·정직·협력)를 세 열로 나란히 적는다. ' +
        '이 셋은 학년군마다 따로 채워지며, 성취기준은 세 범주를 **통합해** 진술한다 — 「자료를 수집하여(과정·기능) 생태계 구성 요소의 관계를(지식·이해) 설명한다」. ' +
        '2015 개정의 「핵심 개념·일반화된 지식·내용 요소·기능」 틀을 고쳐, 태도를 정식 내용으로 올린 것이 가장 큰 변화다.',
      bridgeToPlain:
        '이 카드 전체가 이 틀이다. 「먼저 쉽게」의 「한 수업 안에서 함께 다루라는 요구」가 「통합해 진술한다」이고, 「더 읽기」의 「한 실험, 세 범주」가 통합된 성취기준 한 문장을 다시 세 범주로 갈라 읽은 것이다. ' +
        '오늘 모듈의 네 층 해부 가운데 내용·실행·가치의 세 층이 이 세 범주에 대응한다. 인식론 층은 이 강의가 더한 것이다.',
      limits:
        '세 범주가 「무엇을 가르칠 것인가」는 정하지만 「어떻게 통합할 것인가」는 정하지 않는다. 교과서와 평가가 세 열을 따로 다루면 — 지식 문항, 기능 실습, 태도 설문 — 통합은 문서에만 남는다. ' +
        '또 가치·태도를 내용 체계에 넣으면 그것을 **평가**해야 하는가라는 물음이 따라온다. 태도를 점수화하면 학생은 태도를 연기한다. 이 문서는 그 물음에 답하지 않는다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 6장',
      readings: [
        { title: '교육부 (2022). 초·중등학교 교육과정 총론. 교육부 고시 제2022-33호 [별책 1]. — NCIC', url: 'https://ncic.re.kr' },
      ],
      linkedConceptId: 'c06-categories',
      plainTerms: ['한 수업 안에서 함께 다루라는 요구'],
      oneLine: '지식·이해 / 과정·기능 / 가치·태도를 나란히 적고, 성취기준은 셋을 통합해 진술한다.',
      verified: false,
    },
    {
      id: 't06-progression',
      termKo: '학습 진행',
      termEn: 'learning progression',
      scholars: [
        { nameKo: '미국 국립연구위원회', nameEn: 'National Research Council', year: '2007' },
        { nameKo: '얼리샤 알론조', nameEn: 'Alicia C. Alonzo', year: '2012' },
      ],
      claim:
        '학습 진행이란 「한 주제에 대해 학생이 긴 시간에 걸쳐 배우고 탐구하면서 차례로 거칠 수 있는, 점점 더 정교해지는 사고 방식들의 기술」이다(NRC, 2007). 아래 끝(lower anchor)은 학생이 들어올 때 갖는 생각, 위 끝(upper anchor)은 교육과정이 목표로 하는 이해이며, 그 사이의 **중간 단계들**이 경험적으로 확인되어야 한다. ' +
        '핵심 주장은 두 가지 — 성취기준은 학년마다 따로 있는 목록이 아니라 **하나의 사고가 자라는 궤적**으로 읽어야 하고, 그 궤적은 논리적으로 정해지는 것이 아니라 학생 자료로 **검증**되어야 한다는 것.',
      bridgeToPlain:
        '이 카드의 「정확한 정의」 — 「학년이 올라가며 더 정교한 모형과 수량 관계로 발전한다」 — 와 「꼭 알아야 할 것」의 「초등의 「먹고 먹힌다」가 고등의 「영양 단계 사이 에너지 효율」이 된다」가 학습 진행의 눈으로 성취기준을 읽은 것이다. ' +
        '이 앱의 교육과정 맵이 성취기준마다 「앞에 와야 하는 개념」과 「뒤에 오는 개념」을 적어 두는 것이 이 궤적을 붙들려는 시도다.',
      limits:
        '실제로 검증된 학습 진행은 몇 개 주제(물질의 입자성, 유전, 탄소 순환)에만 있다. 대부분의 성취기준은 아직 논리적 순서일 뿐 경험적 궤적이 아니다. ' +
        '또 「진행」이라는 말이 모든 학생이 같은 길을 같은 순서로 간다는 뜻으로 읽히면 안 된다. 연구자들은 궤적이 여럿일 수 있고, 수업에 따라 달라진다고 본다 — 학습 진행은 발달의 지도이지 시간표가 아니다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 6장',
      readings: [
        {
          title: 'National Research Council (2007). Taking Science to School: Learning and Teaching Science in Grades K–8. The National Academies Press.',
          url: 'https://doi.org/10.17226/11625',
        },
        { title: 'Alonzo, A. C., & Gotwals, A. W. (Eds.) (2012). Learning Progressions in Science: Current Challenges and Future Directions. Sense Publishers.' },
      ],
      quotes: [
        {
          original:
            'Learning progressions are descriptions of the successively more sophisticated ways of thinking about a topic that can follow one another as children learn about and investigate a topic over a broad span of time.',
          ko: '학습 진행이란, 아이들이 한 주제에 대해 오랜 시간에 걸쳐 배우고 탐구하면서 차례로 이어질 수 있는, 점점 더 정교해지는 사고 방식들에 대한 기술이다.',
          source: 'NRC (2007), Taking Science to School, p. 219',
        },
      ],
      linkedConceptId: 'c06-bigidea',
      plainTerms: ['학년이 올라가며 더 정교한 모형과 수량 관계로 발전한다'],
      oneLine: '한 주제에 대한 사고가 긴 시간에 걸쳐 정교해지는 궤적. 논리가 아니라 학생 자료로 검증한다.',
      verified: false,
    },
    {
      id: 't06-deeper',
      termKo: '깊은 학습과 21세기 역량',
      termEn: 'deeper learning / transferable knowledge',
      scholars: [
        { nameKo: '미국 국립연구위원회', nameEn: 'National Research Council' },
        { nameKo: '제임스 펠레그리노', nameEn: 'James W. Pellegrino', year: '2012' },
      ],
      claim:
        'Pellegrino 와 Hilton 이 엮은 NRC 보고서 『삶과 일을 위한 교육(Education for Life and Work)』은 「21세기 역량」이라는 느슨한 말을 **전이 가능한 지식(transferable knowledge)** 으로 정의하고, 그것을 만드는 과정을 **깊은 학습(deeper learning)** 이라 불렀다. ' +
        '깊은 학습이란 한 상황에서 배운 것을 새 상황에 적용할 수 있게 되는 과정이며, 그 산물은 내용 지식과 함께 「그것을 언제 어떻게 쓰는가」에 대한 지식이다. 보고서는 역량을 인지·개인 내·대인 세 영역으로 나누고, 세 영역 모두에서 깊은 학습이 가능하다고 보았다.',
      bridgeToPlain:
        '이 카드의 「먼저 쉽게」 — 「핵심 아이디어로 처음 보는 현상을 설명하고 자기 설명을 고칠 수 있는 상태」 — 가 전이 가능한 지식이고, 2022 개정 총론의 「깊이 있는 학습」이 이 보고서와 같은 자리에 있다. ' +
        '「더 읽기」의 「많이 가르치는 것과 깊이는 반대다」가 이 보고서의 처방 — 소수의 핵심 아이디어를 여러 맥락에서 — 이다.',
      limits:
        '「깊은 학습」은 정의보다 이름이 먼저 퍼진 말이라, 실제로는 프로젝트 학습·긴 과제·고차 사고와 자주 혼동된다. 보고서 자신이 그 혼동을 경계했다. ' +
        '또 「전이」의 증거가 가까운 전이에 몰려 있다는 5강의 한계가 여기도 그대로 적용된다. 깊은 학습이 실제로 삶과 일로 전이되는지에 대한 종단 자료는 아직 적다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 6장',
      readings: [
        {
          title:
            'National Research Council (2012). Education for Life and Work: Developing Transferable Knowledge and Skills in the 21st Century (J. W. Pellegrino & M. L. Hilton, Eds.). The National Academies Press.',
          url: 'https://doi.org/10.17226/13398',
        },
      ],
      linkedConceptId: 'c06-deep',
      plainTerms: ['핵심 아이디어로 처음 보는 현상을 설명하고 자기 설명을 고칠 수 있는 상태'],
      oneLine: '깊은 학습 = 한 상황에서 배운 것을 새 상황에 쓸 수 있게 되는 과정. 그 산물이 전이 가능한 지식이다.',
      verified: false,
    },
  ],
}
