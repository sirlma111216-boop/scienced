import type { LessonTheory } from '../types'

/**
 * 5강 — 개념변화는 어떻게 일어나는가
 *
 * 지시서 M 의 여섯 항목(Posner 네 조건 · 개념적 지위/개념 생태 · CLIS 수업 순서 · 생성학습 · POE · 인지갈등의 한계).
 * 「인지갈등의 한계」는 Limón(2001)과 Chinn & Brewer(1993)를 함께 세운다 —
 * 학생이 반례 앞에서 실제로 하는 일곱 가지가 후자에 있다.
 */
export const t05: LessonTheory = {
  summary:
    '「놀라운 실험 하나로 학생 생각이 바뀐다」는 믿음이 무너진 자리에서 개념변화 연구가 시작됐다. Posner·Strike·Hewson·Gertzog 는 1982년 Kuhn 의 과학혁명을 학생 한 사람의 머릿속에 옮겨, 새 설명이 받아들여지는 네 조건 — 불만족·이해 가능성·그럴듯함·유용성 — 을 적었다. ' +
    '같은 시기 영국의 Driver 와 Oldham 은 그 조건을 수업 순서(관념 표현－재구성－응용－변화 검토)로 바꿨고, 뉴질랜드의 Osborne 과 Wittrock 은 학습자가 설명을 스스로 「생성」한다는 쪽에서 같은 결론에 닿았으며, White 와 Gunstone 은 예상－관찰－설명이라는 가장 작은 단위를 만들었다. ' +
    '1990년대 이후의 반성 — Chinn 과 Brewer 의 「반례에 대한 일곱 반응」, Limón 의 인지갈등 비판 — 은 이 차시가 「봤지? 틀렸지?」 대신 측정 확인과 옛 설명의 인정에서 시작하는 이유다.',
  entries: [
    {
      id: 't05-posner',
      termKo: '개념변화의 네 조건',
      termEn: 'conditions for conceptual change: dissatisfaction, intelligibility, plausibility, fruitfulness',
      scholars: [
        { nameKo: '조지 포스너', nameEn: 'George J. Posner' },
        { nameKo: '케네스 스트라이크', nameEn: 'Kenneth A. Strike' },
        { nameKo: '피터 휴슨', nameEn: 'Peter W. Hewson' },
        { nameKo: '윌리엄 거트조그', nameEn: 'William A. Gertzog', year: '1982' },
      ],
      claim:
        '이들은 Kuhn 과 Lakatos 의 과학철학을 빌려 학생의 개념변화를 「합리적 활동」으로 그렸다. 학생이 기존 개념을 새 개념으로 **조절(accommodation)** 하려면 네 조건이 필요하다 — ' +
        '① 기존 개념에 대한 **불만족**이 있어야 한다. 풀리지 않는 변칙이 쌓여야 한다. ② 새 개념이 **이해 가능**해야 한다. 무슨 뜻인지 알아야 한다. ③ 새 개념이 처음부터 **그럴듯**해야 한다. 내가 아는 다른 것과 어긋나지 않아야 한다. ④ 새 개념이 **생산적(fruitful)** 이어야 한다. 새 문제를 열어 주어야 한다. ' +
        '이 조건들은 학생의 「개념 생태(conceptual ecology)」 — 변칙, 비유, 인식론적 신념, 형이상학적 신념, 다른 지식 — 안에서 판정된다.',
      bridgeToPlain:
        '이 카드의 「꼭 알아야 할 것」 둘째 줄 — 「새 설명이 채택되는 네 조건 — ① 불만 ② 이해 ③ 그럴듯 ④ 쓸모」 — 와 「더 읽기」의 「네 조건 — 1982년의 논문 한 편」이 이 논문이다. ' +
        '오늘 모듈의 증거 카드 세 장이 ①을 쌓는 장치이고, 수업 정리의 「두 번째 상황」이 ④를 확인하는 장치다.',
      limits:
        '가장 큰 비판은 학생을 너무 「합리적」으로 그렸다는 것이다. 동기·정서·정체성이 빠져 있고, 학생이 반례 앞에서 하는 일은 대개 합리적 조절이 아니라 회피다(Chinn & Brewer). 저자들 자신이 1992년 「수정주의적 이론」에서 이것을 인정하고 개념 생태에 동기와 사회적 요인을 넣었다. ' +
        '또 「조절」을 극적인 한 사건으로 그리는 것이 실제와 다르다 — 변화는 점진적이고, 옛 개념은 사라지지 않고 범위가 좁아진다(「따뜻한 개념변화」 논의, Pintrich 외 1993).',
      textbookRef: '『과학 교육론과 지도법』 제2판 5장',
      readings: [
        {
          title:
            'Posner, G. J., Strike, K. A., Hewson, P. W., & Gertzog, W. A. (1982). Accommodation of a scientific conception: Toward a theory of conceptual change. Science Education, 66(2), 211–227.',
          url: 'https://doi.org/10.1002/sce.3730660207',
        },
        {
          title: 'Pintrich, P. R., Marx, R. W., & Boyle, R. A. (1993). Beyond cold conceptual change. Review of Educational Research, 63(2), 167–199.',
        },
      ],
      quotes: [
        {
          original:
            'There must be dissatisfaction with existing conceptions. … A new conception must be intelligible. … A new conception must appear initially plausible. … A new conception should suggest the possibility of a fruitful research program.',
          ko: '기존 개념에 대한 불만족이 있어야 한다. … 새 개념은 이해 가능해야 한다. … 새 개념은 처음부터 그럴듯해 보여야 한다. … 새 개념은 생산적인 연구 프로그램의 가능성을 열어 주어야 한다.',
          source: 'Posner et al. (1982), p. 214',
        },
      ],
      figure: {
        purpose: '네 조건이 순서대로 놓이고, 어느 하나라도 빠지면 옛 설명으로 돌아간다는 것을 한눈에 보게 한다.',
        mustShow: [
          '왼쪽에서 오른쪽으로 이어진 빈 둥근 사각형 네 개와 그 사이의 화살표 세 개',
          '넷째 사각형 오른쪽에 채워진 원 하나(새 설명이 자리 잡음)',
          '각 사각형 아래에서 왼쪽 맨 처음으로 되돌아가는 가는 점선 화살표',
        ],
        mustNotShow: ['그림 안의 어떤 글자도', '사람의 모습', '전구·물음표 같은 아이콘'],
        labels: [
          { text: '불만족', position: '첫째 사각형', x: 13, y: 40 },
          { text: '이해 가능', position: '둘째 사각형', x: 36, y: 40 },
          { text: '그럴듯함', position: '셋째 사각형', x: 59, y: 40 },
          { text: '쓸모', position: '넷째 사각형', x: 82, y: 40 },
          { text: '하나라도 빠지면 옛 설명으로', position: '아래 점선', x: 50, y: 80 },
        ],
        genPrompt:
          'Minimal flat diagram on white background: four empty rounded rectangles in a horizontal row connected by three solid arrows pointing right, then a small filled circle at the far right. Beneath the row, a thin dashed arrow loops from under each rectangle back to the far left. Clean vector style, black lines, one accent color for the filled circle. No text, no letters, no icons.',
        altText:
          '흰 바탕에 빈 둥근 사각형 네 개가 가로로 이어져 있고 사이사이 화살표가 오른쪽을 가리킨다. 왼쪽부터 불만족, 이해 가능, 그럴듯함, 쓸모이며 맨 오른쪽에 채워진 원이 새 설명이 자리 잡은 것을 뜻한다. 각 사각형 아래에서 맨 왼쪽으로 되돌아가는 점선 화살표가 있어, 어느 조건이 빠져도 옛 설명으로 돌아감을 나타낸다.',
        fallback: '네 낱말을 가로로 판서하고 화살표로 잇는다. 아래에 「하나라도 빠지면 →」 되돌아가는 화살표.',
        license: '직접 제작',
      },
      linkedConceptId: 'c05-change',
      plainTerms: ['새 설명이 채택되는 네 조건'],
      oneLine: '불만족 · 이해 가능 · 그럴듯함 · 쓸모. 넷이 다 있어야 학생이 새 개념으로 조절한다.',
      verified: false,
    },
    {
      id: 't05-status',
      termKo: '개념적 지위와 개념 생태',
      termEn: 'conceptual status / conceptual ecology',
      scholars: [
        { nameKo: '피터 휴슨', nameEn: 'Peter W. Hewson', year: '1981' },
        { nameKo: '스트라이크·포스너', nameEn: 'Kenneth A. Strike & George J. Posner', year: '1992' },
      ],
      claim:
        'Hewson 은 네 조건을 학생 쪽에서 다시 읽었다. 학생은 여러 개념을 동시에 갖고 있고, 각 개념은 이해 가능·그럴듯·생산적이라는 세 눈금에서 **지위(status)** 를 갖는다. 개념변화란 옛 개념을 지우는 것이 아니라 **지위가 바뀌는 것**이다 — 새 개념의 지위가 오르고 옛 개념의 지위가 내려간다. 그래서 옛 개념은 남는다. ' +
        'Strike 와 Posner 는 1992년 「개념 생태」를 넓혀, 개념의 지위를 정하는 것에 인식론적·형이상학적 신념뿐 아니라 동기·목표·사회적 관계도 들어간다고 고쳤다.',
      bridgeToPlain:
        '이 카드의 「헷갈리지 말자」 — 「기존 생각이 삭제되는 것이 아니다 — 사용 범위가 좁아지는 쪽에 가깝다」 — 와 「더 읽기」의 「옛 설명은 지워지지 않는다 — 범위가 좁아진다」가 지위 개념이다. ' +
        '이 앱이 첫 답을 지우지 않는 것은 지위의 변화를 학생이 스스로 볼 수 있게 하려는 것이다.',
      limits:
        '「지위」를 어떻게 재는가가 문제다. Hewson 은 면담으로 학생이 쓰는 말(「말이 된다」 「믿을 만하다」 「쓸모 있다」)에서 지위를 읽었는데, 그 방법은 시간이 많이 들고 교실에서 쓰기 어렵다. ' +
        '또 지위가 낮아진 옛 개념이 왜 특정 상황에서 다시 살아나는지 — 시험용 답과 일상용 답의 공존 — 는 이 틀만으로 설명되지 않는다. diSessa 의 「조각」 관점이 그 자리를 채운다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 5장',
      readings: [
        {
          title: 'Hewson, P. W. (1981). A conceptual change approach to learning science. European Journal of Science Education, 3(4), 383–396.',
          url: 'https://doi.org/10.1080/0140528810304004',
        },
        {
          title:
            'Strike, K. A., & Posner, G. J. (1992). A revisionist theory of conceptual change. In R. A. Duschl & R. J. Hamilton (Eds.), Philosophy of Science, Cognitive Psychology, and Educational Theory and Practice (pp. 147–176). SUNY Press.',
        },
      ],
      linkedConceptId: 'c05-change',
      plainTerms: ['사용 범위가 좁아지는 쪽에 가깝다'],
      oneLine: '개념변화는 삭제가 아니라 지위의 변화. 옛 개념은 남고 지위만 내려간다.',
      verified: false,
    },
    {
      id: 't05-clis',
      termKo: '관념 표현－재구성－응용－변화 검토 (CLIS 수업 순서)',
      termEn: 'elicitation – restructuring – application – review of change (CLIS constructivist teaching sequence)',
      scholars: [
        { nameKo: '로절린드 드라이버', nameEn: 'Rosalind Driver' },
        { nameKo: '밸러리 올덤', nameEn: 'Valerie Oldham', year: '1986' },
      ],
      claim:
        '영국 리즈대학의 「과학에서의 아동 학습(CLIS)」 프로젝트가 개념변화 이론을 수업 단위의 순서로 옮긴 것이다. ' +
        '**오리엔테이션** → **관념 표현(elicitation)**: 학생이 자기 생각을 꺼내 놓는다 → **관념 재구성(restructuring)**: 명료화와 교환, 갈등 상황에 노출, 새 관념의 구성, 평가 → **관념 응용(application)**: 새 관념을 다른 상황에 쓴다 → **변화 검토(review)**: 처음 생각과 지금 생각을 나란히 놓고 무엇이 바뀌었는지 본다. ' +
        '핵심은 마지막 단계다. 학생이 자기 변화를 스스로 보지 않으면 변화는 교사의 것으로 남는다.',
      bridgeToPlain:
        '이 강의의 모든 차시가 이 순서로 짜여 있다 — 「내 생각 먼저」가 관념 표현, 개념 카드와 핵심 모듈이 재구성, 형성평가의 「다시 고르기」와 수업 정리의 「바뀐 생각 한 줄」이 응용과 변화 검토다. ' +
        '이 카드의 「적용 질문」 — 「학생이 새 설명을 만들고 시험할 시간이 실제로 있는가」 — 가 재구성 단계에 시간을 배정하라는 이 순서의 요구다.',
      limits:
        '순서가 한 차시에 다 들어가지 않는다. 실제 CLIS 자료는 한 주제에 여러 주를 썼고, 그것을 한 시간으로 줄이면 재구성 단계가 「교사가 정답을 말하는 짧은 시간」이 된다. ' +
        '또 「갈등 상황에 노출」이 자동으로 재구성을 낳지 않는다는 것(Limón)과, 학생이 꺼내 놓은 관념을 교사가 어떻게 다루느냐에 따라 관념 표현이 오히려 옛 생각을 굳힐 수 있다는 것이 뒤에 지적됐다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 5장',
      readings: [
        {
          title: 'Driver, R., & Oldham, V. (1986). A constructivist approach to curriculum development in science. Studies in Science Education, 13(1), 105–122.',
        },
      ],
      figure: {
        purpose: '이 강의의 모든 차시가 밟는 다섯 단계의 순서와, 마지막 단계가 처음으로 되돌아보는 구조를 보게 한다.',
        mustShow: [
          '위에서 아래로 이어진 빈 둥근 사각형 다섯 개와 사이의 아래 방향 화살표',
          '셋째 사각형이 다른 넷보다 세로로 길게 그려짐',
          '다섯째 사각형에서 둘째 사각형으로 되돌아가는 곡선 화살표 하나(오른쪽 바깥으로)',
        ],
        mustNotShow: ['그림 안의 어떤 글자도', '사람의 모습', '교실 장면'],
        labels: [
          { text: '오리엔테이션', position: '첫째', x: 50, y: 8 },
          { text: '관념 표현', position: '둘째', x: 50, y: 26 },
          { text: '관념 재구성', position: '셋째(긴 것)', x: 50, y: 50 },
          { text: '관념 응용', position: '넷째', x: 50, y: 74 },
          { text: '변화 검토', position: '다섯째', x: 50, y: 92 },
        ],
        legend: '오른쪽 곡선 화살표: 마지막 단계에서 둘째 단계의 「처음 생각」으로 돌아가 비교한다.',
        genPrompt:
          'Minimal flat diagram on white background: five empty rounded rectangles stacked vertically and connected by short downward arrows. The third rectangle is noticeably taller than the others. A single thin curved arrow on the right side loops from the bottom rectangle back up to the second rectangle. Clean vector style, black lines. No text, no letters, no icons.',
        altText:
          '흰 바탕에 빈 둥근 사각형 다섯 개가 위아래로 쌓여 화살표로 이어져 있다. 위에서부터 오리엔테이션, 관념 표현, 관념 재구성, 관념 응용, 변화 검토이며 셋째 것이 다른 것보다 길다. 오른쪽에 맨 아래 사각형에서 둘째 사각형으로 되돌아가는 곡선 화살표가 있다.',
        fallback: '다섯 낱말을 세로로 판서하고, 「변화 검토」에서 「관념 표현」으로 되돌아가는 화살표를 그린다.',
        license: '직접 제작',
      },
      linkedConceptId: 'c05-change',
      plainTerms: ['학생이 새 설명을 만들고 시험할 시간이 실제로 있는가'],
      oneLine: '관념 표현 → 재구성 → 응용 → 변화 검토. 학생이 자기 변화를 스스로 보는 마지막 단계가 핵심.',
      verified: false,
    },
    {
      id: 't05-generative',
      termKo: '생성학습',
      termEn: 'generative learning',
      scholars: [
        { nameKo: '로저 오즈번', nameEn: 'Roger Osborne' },
        { nameKo: '멀린 위트록', nameEn: 'Merlin C. Wittrock', year: '1983' },
      ],
      claim:
        'Wittrock 의 생성학습 이론을 과학교육에 옮긴 것이다. 학습자는 감각 정보를 받아 적는 것이 아니라 자기 기억과 이어 **뜻을 생성**한다. 그래서 같은 실험을 보고도 학생마다 다른 것을 「본다」 — 무엇에 주의를 두는가, 그것을 어떤 기억과 잇는가, 생성한 뜻을 어떻게 시험하는가, 시험을 통과한 뜻을 기억에 어떻게 넣는가가 모두 학습자의 일이다. ' +
        '교사가 할 일은 정보를 전달하는 것이 아니라 학생이 뜻을 생성하고 **시험할 기회**를 만드는 것이다. 이 점에서 개념변화 이론과 같은 결론에 다른 길로 닿았다.',
      bridgeToPlain:
        '이 차시의 「친절한 길잡이」 — 「학생은 측정을 의심하거나 예외로 처리하거나 그냥 두 개의 답을 따로 갖는다」 — 가 생성학습이 설명하는 현상이다. 학생은 받아 적지 않고 자기 기억에 이어 뜻을 만든다. ' +
        '오늘 모듈이 「v1 → v2 → v3」로 학생 자신의 설명을 적게 하는 것이 「생성하고 시험할 기회」다.',
      limits:
        '생성학습은 학습이 학습자 안에서 일어난다는 것을 잘 보이지만, **무엇을** 생성하게 할 것인지 — 과학적으로 더 나은 설명으로 가게 하는 조건 — 에 대해서는 개념변화 이론만큼 구체적이지 않다. ' +
        '또 「생성」을 강조하면 안내 없는 발견학습으로 미끄러질 수 있다는 지적이 있다. Osborne 과 Wittrock 자신은 교사의 역할을 작게 보지 않았다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 5장',
      readings: [
        {
          title: 'Osborne, R. J., & Wittrock, M. C. (1983). Learning science: A generative process. Science Education, 67(4), 489–508.',
          url: 'https://doi.org/10.1002/sce.3730670406',
        },
      ],
      linkedConceptId: 'c05-power',
      plainTerms: ['학생이 직접 비교할 기준'],
      oneLine: '학습자는 받아 적지 않고 자기 기억에 이어 뜻을 생성한다. 교사의 일은 생성하고 시험할 기회를 만드는 것.',
      verified: false,
    },
    {
      id: 't05-poe',
      termKo: '예상－관찰－설명',
      termEn: 'Predict–Observe–Explain (POE)',
      scholars: [
        { nameKo: '리처드 화이트', nameEn: 'Richard T. White' },
        { nameKo: '리처드 건스톤', nameEn: 'Richard F. Gunstone', year: '1992' },
      ],
      claim:
        'White 와 Gunstone 이 『이해 탐색(Probing Understanding)』에서 정리한 가장 작은 진단·수업 단위다. 학생이 어떤 상황의 결과를 **예상**하고 이유를 적은 뒤, 실제로 **관찰**하고, 예상과 관찰 사이의 차이를 **설명**한다. ' +
        '순서가 전부다. 이유를 결과 **전에** 적어야 예상이 진단 자료가 되고, 관찰이 예상과 어긋나야 설명할 것이 생긴다. 결과를 본 뒤 적은 이유는 사후 합리화라 아무것도 진단하지 못한다.',
      bridgeToPlain:
        '이 카드의 「꼭 알아야 할 것」 마지막 줄 — 「**POE** — 예상·관찰·설명. 이유를 먼저 적어야 결과와 비교할 것이 생긴다」 — 가 이 단위이고, 오늘 첫 단계의 뜨거운 물과 찬물이 POE 그대로다. ' +
        '측정 결과를 강사가 공개해야 열리게 잠가 둔 것이 「순서가 전부다」의 앱 구현이다.',
      limits:
        'POE 는 예상이 갈릴 만한 상황에서만 일한다. 모두가 같은 예상을 하거나 결과가 모호하면 설명할 것이 없다. 좋은 POE 상황을 고르는 것이 기술이고, 그 기술은 학생의 대안적 개념을 미리 알아야 생긴다(3강). ' +
        '또 「설명」 단계가 실제로는 「교사가 설명함」이 되기 쉽다. 학생이 자기 예상과 관찰의 차이를 설명하는 시간이 없으면 POE 가 아니라 시범 실험이다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 5장',
      readings: [
        { title: 'White, R. T., & Gunstone, R. F. (1992). Probing Understanding. Falmer Press.' },
      ],
      linkedConceptId: 'c05-conflict',
      plainTerms: ['결과를 보기 전에'],
      oneLine: '예상하고 이유를 적은 뒤 관찰하고 차이를 설명한다. 이유는 반드시 결과 전에.',
      verified: false,
    },
    {
      id: 't05-anomaly',
      termKo: '인지갈등의 한계 — 반례에 대한 반응',
      termEn: 'limits of cognitive conflict / responses to anomalous data',
      scholars: [
        { nameKo: '클라크 친', nameEn: 'Clark A. Chinn' },
        { nameKo: '윌리엄 브루어', nameEn: 'William F. Brewer', year: '1993' },
        { nameKo: '마르가리타 리몬', nameEn: 'Margarita Limón', year: '2001' },
      ],
      claim:
        'Chinn 과 Brewer 는 과학사와 학생 연구를 훑어, 사람이 자기 이론과 어긋나는 자료(anomalous data) 앞에서 하는 반응을 일곱 가지로 정리했다 — **무시**, **거부**(자료가 틀렸다), **예외 처리**(내 이론의 범위 밖이다), **보류**(나중에 설명될 것이다), **재해석**(자료를 내 이론에 맞게 읽는다), **주변부 수정**(이론의 곁가지만 고친다), **이론 변경**. 일곱 중 여섯이 이론을 지키는 길이고, 마지막 하나만 변화다. ' +
        'Limón 은 2001년 인지갈등 전략의 연구들을 다시 살펴, 갈등이 변화로 이어지려면 학생 쪽에 이미 갖춰져 있어야 하는 것 — 자기 이론을 알아차릴 만큼의 명료함, 새 설명을 이해할 배경지식, 바꿀 동기 — 이 많으며, 그것이 없는 학생에게 갈등은 「이상한 실험」일 뿐이라고 결론지었다.',
      bridgeToPlain:
        '이 카드의 「더 읽기」 — 「갈등 뒤에 학생이 실제로 하는 세 가지: 측정 의심 · 예외 처리 · 회피」 — 가 Chinn 과 Brewer 의 일곱 가지를 교실에서 자주 보이는 셋으로 줄인 것이고, 「인지갈등이 생각만큼 안 통하는 이유」가 Limón 이다. ' +
        '오늘 모듈의 증거 카드 세 장이 그 세 길을 하나씩 막는 순서로 놓인 것이 이 두 연구의 처방이다.',
      limits:
        '일곱 반응은 서술적 분류이지 예측 이론이 아니다 — 어떤 학생이 어떤 자료에 어느 반응을 할지는 말해 주지 않는다. Chinn 과 Brewer 는 자료의 신뢰성, 이론의 견고함, 대안 이론의 유무 등 조건을 들었지만 그것으로 예측이 되지는 않는다. ' +
        '또 인지갈등 비판이 「갈등을 주지 말라」로 읽히면 안 된다. Limón 의 결론은 갈등이 소용없다가 아니라, 갈등 **앞에** 준비시켜야 할 것이 있다는 것이다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 5장',
      readings: [
        {
          title:
            'Chinn, C. A., & Brewer, W. F. (1993). The role of anomalous data in knowledge acquisition: A theoretical framework and implications for science instruction. Review of Educational Research, 63(1), 1–49.',
          url: 'https://doi.org/10.3102/00346543063001001',
        },
        {
          title: 'Limón, M. (2001). On the cognitive conflict as an instructional strategy for conceptual change: A critical appraisal. Learning and Instruction, 11(4–5), 357–380.',
          url: 'https://doi.org/10.1016/S0959-4752(00)00037-2',
        },
      ],
      linkedConceptId: 'c05-conflict',
      plainTerms: ['측정 의심·예외 처리·회피'],
      oneLine: '반례 앞에서 사람은 일곱 가지로 반응하고 그중 여섯은 이론을 지킨다. 갈등 앞에 준비시킬 것이 있다.',
      verified: false,
    },
    {
      id: 't05-transfer',
      termKo: '전이 — 표면 구조와 심층 구조',
      termEn: 'transfer / surface vs. deep structure',
      scholars: [
        { nameKo: '미셸린 치', nameEn: 'Michelene T. H. Chi' },
        { nameKo: '커트 반린', nameEn: 'Kurt VanLehn', year: '2012' },
      ],
      claim:
        '전이 연구의 오랜 발견은 학습자가 문제의 **표면 구조**(도르래인가 경사면인가)로 문제를 분류하고 전문가는 **심층 구조**(에너지 보존인가 힘의 평형인가)로 분류한다는 것이다(Chi, Feltovich & Glaser, 1981). 전이가 안 되는 이유는 배운 것을 잊어서가 아니라 새 문제가 「같은 문제」임을 알아보지 못해서다. ' +
        'Chi 와 VanLehn 은 2012년 이것을 「전이의 핵심은 심층 구조를 보는 것」으로 정리하고, 그 능력이 표면이 다르고 구조가 같은 사례를 **비교**할 때 자란다고 했다.',
      bridgeToPlain:
        '이 카드의 「꼭 알아야 할 것」 둘째 줄 — 「표면이 다른 상황을 준다 — 숫자만 바꾼 문제가 아니라 겉모습이 다르고 속 구조가 같은 문제」 — 와 「더 읽기」의 「전이가 안 되는 이유는 「같은 문제」라는 것을 모르기 때문」이 이 연구다. ' +
        '수업 정리의 「두 번째 상황」이 겉이 다르고 속이 같아야 하는 이유가 여기 있다.',
      limits:
        '「심층 구조」가 무엇인지는 영역마다 다르고, 초보자에게 그것을 어떻게 보게 하는가는 아직 열린 문제다. 비교 학습이 효과적이라는 결과는 있지만, 비교할 사례를 잘못 고르면 표면적 유사성만 배운다. ' +
        '또 「먼 전이」 — 학교에서 배운 것이 삶에서 쓰이는가 — 에 대한 증거는 가까운 전이보다 훨씬 약하다. 전이가 일어난다는 것 자체를 의심하는 연구자(Detterman)도 있다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 5장',
      readings: [
        {
          title: 'Chi, M. T. H., & VanLehn, K. A. (2012). Seeing deep structure from the interactions of surface features. Educational Psychologist, 47(3), 177–188.',
          url: 'https://doi.org/10.1080/00461520.2012.695709',
        },
        {
          title: 'Chi, M. T. H., Feltovich, P. J., & Glaser, R. (1981). Categorization and representation of physics problems by experts and novices. Cognitive Science, 5(2), 121–152.',
        },
      ],
      linkedConceptId: 'c05-transfer',
      plainTerms: ['겉모습이 다르고 속 구조가 같은 문제'],
      oneLine: '초보자는 표면으로, 전문가는 심층 구조로 문제를 본다. 전이는 「같은 문제」임을 알아보는 데서 온다.',
      verified: false,
    },
  ],
}
