import type { LessonTheory } from '../types'

/**
 * 1강 — 좋은 과학 수업은 무엇을 남기는가
 *
 * 지시서 M 의 네 항목(Vision I/II · 과학 정체성 · 학습자 주도성 · PISA 2025)에
 * 「학습의 증거」 카드에 붙일 한 항목을 더했다. 카드마다 이론 배경 탭이 비면 안 된다.
 * 전부 verified:false — 강의자가 원문과 대조한 뒤 켠다.
 */
export const t01: LessonTheory = {
  summary:
    '이 차시가 다루는 문제 — 「과학 수업이 학생에게 무엇을 남겨야 하는가」 — 는 1950년대 말 미국에서 「과학적 소양(scientific literacy)」이라는 말이 교육 목표로 등장하면서 시작됐다. ' +
    '반세기 동안 이 말은 「과학 내용에 숙달하는 것」과 「과학이 걸린 실제 상황에서 판단하는 것」 사이를 오갔고, Roberts 는 2007년 그 둘을 Vision I 과 Vision II 로 갈라 정리했다. ' +
    '지금 이 차시는 Vision II 쪽에 서 있다 — OECD 의 PISA 2025 과학 틀과 Learning Compass 2030 이 같은 자리에 있고, 「누가 과학을 하는 사람으로 인정받는가」를 묻는 과학 정체성 연구가 그 옆에 있다. ' +
    '수업의 결과를 「교사가 말한 것」이 아니라 「학생에게서 관찰되는 것」으로 보는 태도는 형성평가 연구(Black & Wiliam)에서 왔다.',
  entries: [
    {
      id: 't01-vision',
      termKo: '과학적 소양의 두 관점',
      termEn: 'Vision I / Vision II of scientific literacy',
      scholars: [{ nameKo: '더글러스 로버츠', nameEn: 'Douglas A. Roberts', year: '2007' }],
      claim:
        'Roberts 는 과학교육 문헌에서 「과학적 소양」이 두 갈래로 쓰여 왔음을 보였다. ' +
        '**Vision I** 은 과학 그 자체의 산물과 과정 — 개념·법칙·탐구 방법 — 에 숙달하는 것을 소양으로 본다. 의미의 원천이 과학의 정전(canon) 안에 있다. ' +
        '**Vision II** 는 시민이 실제로 만나는, 과학이 한 요소로 들어 있는 상황에서 판단하고 행동하는 능력을 소양으로 본다. 의미의 원천이 상황에 있다. ' +
        '두 관점은 배타적이지 않지만, 교육과정과 평가가 어느 쪽에 무게를 두는지에 따라 수업이 달라진다.',
      bridgeToPlain:
        '이 카드의 「먼저 쉽게」에서 「과학 용어를 많이 아는 능력이 아니라, 과학이 필요한 상황에서 증거를 살펴 판단하는 능력」이라고 한 것이 각각 Vision I 과 Vision II 다. ' +
        '이 강의가 「얼마나 많이 외웠는가」로 수업을 재지 말자고 하는 것은 Vision II 에 서겠다는 선언이다.',
      limits:
        'Vision II 만 강조하면 「상황」이 요구하는 개념 지식이 무엇인지가 흐려진다 — 판단하려면 알아야 할 것이 있다. ' +
        'Roberts 자신도 둘을 대립이 아니라 연속으로 보았고, 이후 Roberts & Bybee(2014)는 둘 사이의 균형을 어떻게 잡을지가 남은 문제라고 썼다. ' +
        '또 Vision II 의 「상황」이 누구의 상황인가 — 어떤 공동체의 문제가 교육과정에 들어오는가 — 는 별도의 정치적 물음이다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 1장',
      readings: [
        {
          title:
            'Roberts, D. A. (2007). Scientific literacy/science literacy. In S. K. Abell & N. G. Lederman (Eds.), Handbook of Research on Science Education (pp. 729–780). Lawrence Erlbaum.',
        },
        {
          title:
            'Roberts, D. A., & Bybee, R. W. (2014). Scientific literacy, science literacy, and science education. In N. G. Lederman & S. K. Abell (Eds.), Handbook of Research on Science Education, Vol. II (pp. 545–558). Routledge.',
        },
      ],
      quotes: [
        {
          original:
            'Vision I gives meaning to SL by looking inward at the canon of orthodox natural science, that is, the products and processes of science itself. … Vision II derives its meaning from the character of situations with a scientific component, situations that students are likely to encounter as citizens.',
          ko:
            'Vision I 은 정통 자연과학의 정전 — 과학 자체의 산물과 과정 — 을 안쪽으로 들여다보며 과학적 소양에 뜻을 준다. … Vision II 는 과학이 한 요소로 든 상황, 학생이 시민으로서 만날 법한 상황의 성격에서 뜻을 끌어낸다.',
          source: 'Roberts (2007), p. 730',
        },
      ],
      linkedConceptId: 'c01-literacy',
      plainTerms: ['과학이 필요한 상황에서 증거를 살펴 판단하는 능력'],
      oneLine: '과학적 소양을 「과학 내용의 숙달」(I)로 볼 것인가 「과학이 걸린 상황에서의 판단」(II)으로 볼 것인가.',
      verified: false,
    },
    {
      id: 't01-pisa',
      termKo: 'PISA 2025 과학 프레임워크',
      termEn: 'PISA 2025 Science Framework',
      scholars: [{ nameKo: 'OECD', nameEn: 'OECD', year: '2023' }],
      claim:
        'OECD 가 만 15세 학생의 과학적 소양을 재는 틀이다. 세 역량을 둔다 — ① 현상을 과학적으로 설명한다 ② 과학적 탐구를 설계·평가하고 자료와 증거를 비판적으로 해석한다 ③ 과학 정보를 조사·평가·사용하여 결정하고 행동한다. ' +
        '2025 회차는 셋째 역량을 크게 넓혔다. 정보의 출처와 이해관계를 따지는 일과, 「인류세의 행위주체성(agency in the Anthropocene)」 — 환경 문제에 대해 행동하는 정체성 — 을 틀 안에 명시했다.',
      bridgeToPlain:
        '「꼭 알아야 할 것」에 적은 세 역량이 이 틀의 세 역량이고, 「정확한 정의」의 세 절이 그것을 풀어 쓴 것이다. ' +
        '「과학 정체성」 카드에서 「태도보다 넓은 개념」이라고 한 것이 이 틀의 행위주체성이다.',
      limits:
        '평가 틀은 「무엇을 잴 수 있는가」에 묶인다. 셋째 역량의 「행동」은 지필 검사로 재기 어렵고, 실제 문항은 여전히 정보 평가에 머문다. ' +
        '또 국제 비교 평가가 각국 교육과정을 끌고 가는 현상(PISA 효과) 자체가 비판의 대상이다 — 틀이 좋은가와 별개로, 틀이 수업을 지배해도 되는가는 다른 문제다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 1장',
      readings: [
        {
          title: 'OECD. PISA 2025 Science Framework.',
          url: 'https://pisa-framework.oecd.org/science-2025/',
        },
      ],
      linkedConceptId: 'c01-literacy',
      plainTerms: ['PISA 2025 의 세 역량'],
      oneLine: 'OECD 가 만 15세의 과학적 소양을 재는 틀. 세 역량과 「인류세의 행위주체성」.',
      verified: false,
    },
    {
      id: 't01-evidence',
      termKo: '학습의 증거와 형성평가',
      termEn: 'evidence of learning / formative assessment',
      scholars: [
        { nameKo: '폴 블랙', nameEn: 'Paul Black' },
        { nameKo: '딜런 윌리엄', nameEn: 'Dylan Wiliam', year: '1998·2009' },
      ],
      claim:
        'Black 과 Wiliam 은 「수업이 잘 됐다」와 「학생이 배웠다」를 가르는 것이 **학생에게서 이끌어 낸 증거**라고 보았다. ' +
        '그들의 2009년 정의에 따르면 형성평가란 학생의 성취에 관한 증거를 교사·학생·동료가 **이끌어 내고, 해석하고, 다음 수업의 결정에 사용**하는 정도만큼 형성적인 실천이다. ' +
        '핵심은 평가 도구가 아니라 증거의 흐름이다 — 증거가 결정을 바꾸지 않으면 형성평가가 아니다.',
      bridgeToPlain:
        '이 카드의 「먼저 쉽게」에서 「활동을 했다는 사실이 아니라, 학생의 말·그림·행동에서 실제로 확인되는 변화」라고 한 것이 이들이 말하는 증거다. ' +
        '이 앱이 응답을 지우지 않고 버전으로 쌓는 것은 그 증거를 남기기 위해서다. 형성평가의 전체 구조는 나중에 따로 배운다.',
      limits:
        '「증거」가 관찰 가능한 산출물로 좁혀지면 산출물로 드러나지 않는 학습 — 아직 말이 되지 않은 이해 — 이 빠진다. ' +
        '또 1998년의 메타 분석이 보고한 큰 효과 크기는 이후 연구에서 조건에 따라 크게 다르다는 것이 드러났다(Kingston & Nash, 2011). 형성평가는 「하면 된다」가 아니라 「어떻게 하느냐」의 문제다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 1장 · 14장',
      readings: [
        {
          title: 'Black, P., & Wiliam, D. (1998). Inside the black box: Raising standards through classroom assessment. Phi Delta Kappan, 80(2), 139–148.',
        },
        {
          title:
            'Black, P., & Wiliam, D. (2009). Developing the theory of formative assessment. Educational Assessment, Evaluation and Accountability, 21(1), 5–31.',
          url: 'https://doi.org/10.1007/s11092-008-9068-5',
        },
      ],
      quotes: [
        {
          original:
            'Practice in a classroom is formative to the extent that evidence about student achievement is elicited, interpreted, and used by teachers, learners, or their peers, to make decisions about the next steps in instruction that are likely to be better, or better founded, than the decisions they would have taken in the absence of the evidence that was elicited.',
          ko:
            '교실의 실천은, 학생 성취에 관한 증거가 교사·학습자·동료에 의해 이끌어 내어지고, 해석되고, 다음 수업 단계에 관한 결정 — 그 증거가 없었을 때 내렸을 결정보다 더 낫거나 더 근거 있는 결정 — 에 쓰이는 정도만큼 형성적이다.',
          source: 'Black & Wiliam (2009), p. 9',
        },
      ],
      linkedConceptId: 'c01-evidence',
      plainTerms: ['학생의 말·그림·행동에서 실제로 확인되는 변화'],
      oneLine: '「배웠다」의 근거는 학생에게서 이끌어 낸 증거이며, 그 증거가 다음 결정을 바꿀 때 형성평가가 된다.',
      verified: false,
    },
    {
      id: 't01-identity',
      termKo: '과학 정체성',
      termEn: 'science identity',
      scholars: [
        { nameKo: '하이디 칼론', nameEn: 'Heidi B. Carlone' },
        { nameKo: '앤절라 존슨', nameEn: 'Angela Johnson', year: '2007' },
      ],
      claim:
        'Carlone 과 Johnson 은 과학 분야에서 성공한 유색인 여성들의 경험을 분석해 과학 정체성을 세 요소로 모형화했다 — **역량(competence)**: 과학 내용을 이해하고 있다는 것, **수행(performance)**: 과학의 사회적 실행 — 말하기·도구 쓰기 — 을 해 보인다는 것, **인정(recognition)**: 자신을 「과학 하는 사람」으로 여기고 의미 있는 타인에게서도 그렇게 인정받는다는 것. ' +
        '셋 중 인정이 빠지면 나머지 둘이 있어도 정체성이 서지 않는다는 것이 핵심 주장이다.',
      bridgeToPlain:
        '이 카드의 「왜 필요한가」에서 「누구의 말이 과학으로 인정받았는가」라고 한 것이 이 모형의 인정(recognition)이다. ' +
        '성적이 오르는데도 과학에서 멀어지는 학생은 역량은 있는데 인정을 받지 못한 경우로 읽을 수 있다.',
      limits:
        '이 모형은 소수의 성공 사례에서 귀납한 것이라 「성공하지 못한」 경로를 설명하는 데는 약하다. ' +
        '또 인정을 주는 「의미 있는 타인」이 누구인가 — 교사인가, 또래인가, 가족인가 — 에 따라 결과가 달라지는데 모형은 그 차이를 다루지 않는다. ' +
        '후속 연구(Hazari 외, 2010)는 여기에 「흥미(interest)」를 넷째 요소로 더했다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 1장 · 13장',
      readings: [
        {
          title:
            'Carlone, H. B., & Johnson, A. (2007). Understanding the science experiences of successful women of color: Science identity as an analytic lens. Journal of Research in Science Teaching, 44(8), 1187–1218.',
          url: 'https://doi.org/10.1002/tea.20237',
        },
      ],
      figure: {
        purpose: '세 요소가 서로 기대어 서 있고 인정이 빠지면 무너진다는 것을 한눈에 보게 한다.',
        mustShow: [
          '삼각형 꼴로 놓인 세 개의 빈 원',
          '세 원을 잇는 선 세 개',
          '위쪽 꼭짓점의 원이 다른 둘보다 조금 크고 굵게 강조됨',
        ],
        mustNotShow: ['그림 안의 어떤 글자도', '사람의 모습', '과학 기호(플라스크·원자 따위)'],
        labels: [
          { text: '역량', position: '왼쪽 아래 원', x: 22, y: 78 },
          { text: '수행', position: '오른쪽 아래 원', x: 78, y: 78 },
          { text: '인정', position: '위쪽 원', x: 50, y: 22 },
        ],
        legend: '위의 「인정」이 빠지면 아래 둘이 있어도 정체성이 서지 않는다.',
        genPrompt:
          'Minimal flat diagram on white background: three empty circles arranged as a triangle, connected by thin black lines. The top circle is slightly larger with a thicker outline than the two bottom circles. Clean vector style, black and one accent color only. No text, no letters, no icons, no people.',
        altText:
          '흰 바탕에 빈 원 세 개가 삼각형 꼴로 놓여 있고 세 원이 선으로 이어져 있다. 위쪽 원이 아래 두 원보다 조금 크고 굵게 그려져 있다. 왼쪽 아래가 역량, 오른쪽 아래가 수행, 위가 인정이다.',
        fallback: '세 낱말 — 역량·수행·인정 — 을 삼각형으로 판서하고 「인정」에 동그라미를 친다.',
        license: '직접 제작',
      },
      linkedConceptId: 'c01-identity',
      plainTerms: ['누구의 말이 과학으로 인정받았는가'],
      oneLine: '과학 정체성 = 역량 + 수행 + 인정. 인정이 빠지면 나머지 둘로는 서지 않는다.',
      verified: false,
    },
    {
      id: 't01-agency',
      termKo: '학습자 주도성',
      termEn: 'student agency',
      scholars: [{ nameKo: 'OECD', nameEn: 'OECD Learning Compass 2030', year: '2019' }],
      claim:
        'OECD 의 「교육 2030」 프로젝트가 내놓은 Learning Compass 2030 은 학생 주도성을 「자기 삶과 주변 세계에 긍정적 영향을 미치기 위해 목표를 세우고, 성찰하고, 책임 있게 행동하는 능력」으로 정의한다. ' +
        '핵심 주장 둘 — 주도성은 혼자 발휘되는 것이 아니라 교사·또래·부모와의 관계 속에서 자라는 **공동 주도성(co-agency)** 이라는 것, 그리고 「학생이 원하는 대로 두는 것」이 아니라 목표·성찰·책임의 세 요소가 있어야 한다는 것.',
      bridgeToPlain:
        '이 카드의 「먼저 쉽게」에서 「목표를 이해하고 선택하고 증거를 점검하며 결과에 책임 있게 참여하는 능력」이라고 한 것이 이 정의의 목표·성찰·책임이다. ' +
        '「왜 필요한가」에서 「교사가 얼마나 물러나는가로 잘못 읽는다」고 한 것이 공동 주도성이 막으려는 오해다.',
      limits:
        'OECD 문서는 정책 언어라 개념의 경계가 느슨하다 — 주도성·자기조절·자율성이 자주 섞여 쓰인다. ' +
        '또 주도성을 개인의 능력으로 두면 그것을 발휘할 수 있는 구조적 조건(자원·배경지식·발언권)의 차이가 가려진다는 비판이 있다. 「선택 앞에서 멈추는 학생」은 능력이 없는 것이 아니라 조건이 없는 것일 수 있다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 1장',
      readings: [
        {
          title: 'OECD (2019). OECD Future of Education and Skills 2030: Conceptual learning framework — Student Agency for 2030.',
          url: 'https://www.oecd.org/education/2030-project/',
        },
      ],
      linkedConceptId: 'c01-agency',
      plainTerms: ['결과에 책임 있게 참여하는 능력'],
      oneLine: '목표를 세우고 성찰하고 책임 있게 행동하는 능력. 혼자가 아니라 관계 속에서 자라는 공동 주도성.',
      verified: false,
    },
  ],
}
