import type { LessonTheory } from '../types'

/**
 * 2강 — 과학지식은 어떻게 만들어지고 믿을 만해지는가
 *
 * 지시서 M 의 여섯 항목(Hanson · Popper · Kuhn · Lakatos · NOS 합의 관점 · 관찰과 추론)에
 * 「자료와 증거」 카드에 붙일 CER 과 「모형과 이론」 카드에 붙일 모형의 인식론을 더했다.
 * 둘 다 뒤 차시에서 본격적으로 다루므로 여기서는 이름과 자리만 잡아 둔다.
 */
export const t02: LessonTheory = {
  summary:
    '「과학은 변하는데 왜 믿어요?」라는 학생의 물음은 20세기 과학철학이 반세기 동안 붙든 물음이다. ' +
    'Popper 는 1934년 과학의 표지를 「반증될 수 있음」에서 찾았고, Hanson 은 1958년 관찰 자체가 이론을 업고 있음을 보였으며, Kuhn 은 1962년 과학이 누적이 아니라 패러다임의 교체로 나아간다고 했고, Lakatos 는 1970년 그 둘을 「연구 프로그램」으로 조정했다. ' +
    '과학교육은 이 논쟁을 그대로 가르치지 않는다. 1990년대 이후 Lederman·McComas 등이 「학생이 알아야 할 과학의 본성」을 몇 가지 합의된 특성으로 추려 냈고, 이 차시의 개념 카드 네 장은 그 합의 관점의 네 축 — 관찰과 추론의 구분, 경험적 근거, 잠정성, 모형 — 을 쉬운 말로 옮긴 것이다.',
  entries: [
    {
      id: 't02-hanson',
      termKo: '관찰의 이론의존성',
      termEn: 'theory-ladenness of observation',
      scholars: [{ nameKo: '노우드 러셀 핸슨', nameEn: 'Norwood Russell Hanson', year: '1958' }],
      claim:
        'Hanson 은 『발견의 패턴』에서 관찰이 감각 자료를 그대로 받아 적는 일이 아니라고 주장했다. ' +
        '같은 망막 상을 받아도 케플러와 티코 브라헤는 동틀 녘의 해를 다르게 「본다」 — 한 사람은 지구가 도는 것을, 다른 사람은 해가 뜨는 것을. ' +
        '보는 것(seeing)은 이미 개념과 이론을 업고 있다(theory-laden). 그래서 「이론과 무관한 순수한 관찰」로 이론을 검증한다는 논리실증주의의 그림이 성립하지 않는다.',
      bridgeToPlain:
        '이 카드의 「정확한 정의」에서 「관찰도 이론의 영향을 받지만」이라고 한 것과, 「꼭 알아야 할 것」의 「관찰도 완전히 중립적이지 않다 — 무엇을 보려고 하는가에 따라」가 이 주장이다. ' +
        '그다음에 「측정 기준과 여러 사람의 대조로 개인 해석의 영향을 드러내고 줄일 수 있다」고 한 것은 이론의존성이 곧 상대주의는 아니라는 한계 쪽 대답이다.',
      limits:
        '이론의존성을 강하게 밀면 「모든 관찰은 편향됐으니 어느 관찰도 다른 것보다 낫지 않다」는 상대주의로 미끄러진다. Hanson 자신은 거기까지 가지 않았다. ' +
        '이후 논의는 관찰이 이론을 업고 있더라도 **경쟁하는 이론 사이에서 중립적일 수 있는 관찰**이 있는가를 따졌고, 과학의 실제 관행 — 측정의 표준화, 독립 반복, 공개 검토 — 이 그 중립성을 확보하는 장치로 이해된다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 2장',
      readings: [
        { title: 'Hanson, N. R. (1958). Patterns of Discovery: An Inquiry into the Conceptual Foundations of Science. Cambridge University Press.' },
      ],
      quotes: [
        {
          original: 'There is more to seeing than meets the eyeball.',
          ko: '본다는 것에는 안구에 닿는 것 이상이 들어 있다.',
          source: 'Hanson (1958), p. 7',
        },
      ],
      linkedConceptId: 'c02-observation',
      plainTerms: ['관찰도 이론의 영향을 받지만'],
      oneLine: '관찰은 감각 자료를 받아 적는 일이 아니라 이미 이론을 업고 보는 일이다.',
      verified: false,
    },
    {
      id: 't02-obs-inf',
      termKo: '관찰과 추론의 구분',
      termEn: 'observation vs. inference',
      scholars: [
        { nameKo: '노먼 레더먼', nameEn: 'Norman G. Lederman' },
        { nameKo: '윌리엄 매코머스', nameEn: 'William F. McComas', year: '1998·2002' },
      ],
      claim:
        '과학의 본성(NOS) 합의 관점이 학생에게 가르쳐야 할 특성으로 꼽는 것 가운데 하나다. **관찰**은 감각(또는 도구)으로 직접 접근할 수 있는 현상에 관한 기술이고, **추론**은 그렇게 직접 접근할 수 없는 것에 관한 진술이다. ' +
        '화석의 크기와 간격은 관찰이고, 그 동물이 어떻게 걸었는가는 추론이다. 과학지식의 많은 부분 — 원자, 진화, 판의 이동 — 은 추론이며, 그것이 지식의 지위를 낮추지 않는다. 다만 둘을 구분할 수 있어야 「무엇이 바뀔 수 있는가」를 알 수 있다.',
      bridgeToPlain:
        '이 카드 전체가 이 구분이다. 「먼저 쉽게」의 「눈으로 확인한 것과, 그것을 보고 머릿속에서 채운 것」이 관찰과 추론이고, 첫 단계의 발자국 사진 활동은 Lederman 이 이 구분을 가르칠 때 쓰는 고전적 과제를 그대로 옮긴 것이다.',
      limits:
        'Hanson 의 지적대로 순수한 관찰은 없으므로 관찰과 추론은 칼로 자르듯 갈리지 않는다 — 「액체가 붉게 변했다」에도 이미 「액체」 「붉다」라는 범주가 들어 있다. ' +
        '그래서 이 구분은 존재론적 이분법이 아니라 **교실에서 쓰는 실용적 눈금**으로 보아야 한다. 어느 진술이 더 직접적이고 어느 진술이 더 많은 가정을 업고 있는가를 가르는 눈금.',
      textbookRef: '『과학 교육론과 지도법』 제2판 2장',
      readings: [
        {
          title:
            'Lederman, N. G., Abd-El-Khalick, F., Bell, R. L., & Schwartz, R. S. (2002). Views of nature of science questionnaire: Toward valid and meaningful assessment of learners’ conceptions of nature of science. Journal of Research in Science Teaching, 39(6), 497–521.',
          url: 'https://doi.org/10.1002/tea.10034',
        },
        { title: 'McComas, W. F. (Ed.) (1998). The Nature of Science in Science Education: Rationales and Strategies. Kluwer.' },
      ],
      linkedConceptId: 'c02-observation',
      plainTerms: ['눈으로 확인한 것과, 그것을 보고 머릿속에서 채운 것'],
      oneLine: '직접 접근할 수 있는 현상의 기술(관찰)과 그렇지 않은 것에 관한 진술(추론)을 가르는 실용적 눈금.',
      verified: false,
    },
    {
      id: 't02-cer',
      termKo: '주장－증거－추론',
      termEn: 'Claim–Evidence–Reasoning (CER)',
      scholars: [
        { nameKo: '캐서린 맥닐', nameEn: 'Katherine L. McNeill' },
        { nameKo: '조지프 크라이칙', nameEn: 'Joseph Krajcik', year: '2012' },
      ],
      claim:
        'McNeill 과 Krajcik 은 Toulmin 의 논증 구조를 중등 과학 교실에 맞게 세 요소로 줄였다. **주장(claim)** 은 질문에 대한 답, **증거(evidence)** 는 주장을 뒷받침하는 자료, **추론(reasoning)** 은 그 증거가 왜 그 주장을 지지하는지를 과학 원리로 잇는 정당화다. ' +
        '학생이 가장 자주 비우는 칸이 추론이며, 그래서 이 틀은 「자료를 옮겨 적는 것」과 「증거로 쓰는 것」을 갈라 준다.',
      bridgeToPlain:
        '이 카드의 「정확한 정의」에서 자료·증거·추론을 셋으로 가른 것과, 「꼭 알아야 할 것」의 **CER** 줄이 이 틀이다. ' +
        '여기서는 「자료가 언제 증거가 되는가」만 다룬다. 논증 전체 — 반박과 한정까지 — 는 나중에 따로 배운다.',
      limits:
        '세 요소로 줄이면 Toulmin 의 한정(qualifier)과 반박(rebuttal)이 빠진다. 그래서 CER 만으로 쓴 글은 「확실성의 정도」와 「반대 증거」를 다루지 못한다. McNeill 자신도 이후 반박을 넷째 요소로 더한 판을 쓴다. ' +
        '또 틀이 양식(template)이 되면 학생이 칸을 채우는 데 그치고 논증은 하지 않는다는 것이 반복해서 보고됐다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 2장 · 11장',
      readings: [
        {
          title:
            'McNeill, K. L., & Krajcik, J. (2012). Supporting Grade 5–8 Students in Constructing Explanations in Science: The Claim, Evidence, and Reasoning Framework for Talk and Writing. Pearson.',
        },
      ],
      linkedConceptId: 'c02-evidence',
      plainTerms: ['어느 자료를 왜 골랐는지'],
      oneLine: '주장 · 증거 · 추론. 자료가 주장과 이어지는 정당화(추론)가 있어야 증거가 된다.',
      verified: false,
    },
    {
      id: 't02-popper',
      termKo: '반증주의',
      termEn: 'falsificationism',
      scholars: [{ nameKo: '칼 포퍼', nameEn: 'Karl R. Popper', year: '1934/1959' }],
      claim:
        'Popper 는 과학과 비과학을 가르는 기준을 「검증될 수 있음」이 아니라 **「반증될 수 있음(falsifiability)」** 에서 찾았다. 아무리 많은 흰 백조를 보아도 「모든 백조는 희다」는 증명되지 않지만, 검은 백조 한 마리는 그것을 반증한다. ' +
        '그러므로 과학 이론은 대담한 추측이고, 과학자의 일은 그것을 확인하는 것이 아니라 무너뜨리려 시도하는 것이며, 그 시도를 견딘 이론만이 잠정적으로 받아들여진다. 과학지식은 증명된 진리가 아니라 **아직 반증되지 않은 추측**이다.',
      bridgeToPlain:
        '이 카드의 「먼저 쉽게」에서 「새 증거로 고칠 수 있다는 것이 지금 믿을 수 없다는 뜻은 아니다」라고 한 것의 앞 절 — 고칠 수 있음 — 이 Popper 의 잠정성이다. ' +
        '2강의 학생 보고서 활동에서 「이 실험 한 번으로 가설이 증명되었다」를 짚는 것도 여기서 온다. 증명은 애초에 되지 않는다.',
      limits:
        '실제 과학자는 반증 사례 하나에 이론을 버리지 않는다 — 측정을 의심하거나 보조 가설을 고친다(Duhem–Quine 논제). Kuhn 과 Lakatos 의 비판이 여기서 시작된다. ' +
        '또 반증 자체가 이론을 업은 관찰에 기대므로(Hanson) 「결정적 반증」이 무엇인지도 깨끗하지 않다. ' +
        '교실에서의 함의: 「반례 하나로 학생 생각이 바뀐다」는 기대는 Popper 를 순진하게 읽은 것이다. 학생도 과학자처럼 보조 가설을 고친다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 2장',
      readings: [
        { title: 'Popper, K. R. (1959). The Logic of Scientific Discovery. Hutchinson. (원저 Logik der Forschung, 1934)' },
        { title: 'Popper, K. R. (1963). Conjectures and Refutations: The Growth of Scientific Knowledge. Routledge & Kegan Paul.' },
      ],
      quotes: [
        {
          original: 'The criterion of the scientific status of a theory is its falsifiability, or refutability, or testability.',
          ko: '한 이론의 과학적 지위를 가르는 기준은 그것의 반증 가능성, 곧 논박 가능성, 곧 시험 가능성이다.',
          source: 'Popper (1963), Conjectures and Refutations, p. 37',
        },
      ],
      linkedConceptId: 'c02-tentative',
      plainTerms: ['새 증거로 고칠 수 있다는 것'],
      oneLine: '과학의 표지는 검증이 아니라 반증 가능성. 이론은 아직 무너지지 않은 추측이다.',
      verified: false,
    },
    {
      id: 't02-kuhn',
      termKo: '패러다임과 과학혁명',
      termEn: 'paradigm / scientific revolution',
      scholars: [{ nameKo: '토머스 쿤', nameEn: 'Thomas S. Kuhn', year: '1962' }],
      claim:
        'Kuhn 은 과학사가 지식의 누적이 아니라 **정상과학 → 변칙 사례의 축적 → 위기 → 혁명 → 새 정상과학**의 순환으로 이루어진다고 보았다. ' +
        '정상과학 시기에 과학자는 공동체가 공유하는 **패러다임** — 모범 사례, 문제 풀이 방식, 무엇이 문제인지에 대한 합의 — 안에서 퍼즐을 푼다. 변칙 사례는 처음에는 무시되거나 조정되고, 쌓여서 위기가 되어야 비로소 패러다임이 교체된다. ' +
        '두 패러다임은 같은 자로 잴 수 없다(공약 불가능성). 그래서 교체는 논리적 증명이 아니라 공동체의 전환이다.',
      bridgeToPlain:
        '이 카드의 「정확한 정의」에서 「공동체의 비판을 거쳤기 때문에」라고 한 것이 Kuhn 의 공동체이고, 「헷갈리지 말자」의 「과학은 변하니까 믿을 수 없다」에 대한 답 — 변화는 아무렇게나 일어나지 않는다 — 이 정상과학과 혁명의 구분에서 온다. ' +
        '개념변화 이론(나중에 배운다)은 이 순환을 학생 한 사람의 머릿속에 옮겨 놓은 것이다.',
      limits:
        '「패러다임」이라는 말 자체가 책 안에서 스무 가지 넘는 뜻으로 쓰였다는 비판(Masterman, 1970)을 받았고, Kuhn 은 뒤에 「전문 분야 행렬(disciplinary matrix)」로 고쳐 썼다. ' +
        '공약 불가능성을 강하게 읽으면 과학의 진보를 말할 수 없게 되고, 이것이 상대주의 논쟁의 불씨가 됐다. Kuhn 자신은 그 독법을 거부했다. ' +
        '교실에서의 함의: 학생의 개념변화를 「혁명」으로 그리면 극적인 한 순간을 기대하게 되는데, 실제 변화는 훨씬 점진적이다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 2장',
      readings: [
        { title: 'Kuhn, T. S. (1962). The Structure of Scientific Revolutions. University of Chicago Press.' },
      ],
      quotes: [
        {
          original:
            'Normal science, the activity in which most scientists inevitably spend almost all their time, is predicated on the assumption that the scientific community knows what the world is like.',
          ko: '대부분의 과학자가 거의 모든 시간을 보낼 수밖에 없는 활동인 정상과학은, 과학 공동체가 세계가 어떻게 생겼는지 안다는 가정 위에 서 있다.',
          source: 'Kuhn (1962), p. 5',
        },
      ],
      figure: {
        purpose: '과학의 변화가 아무렇게나 일어나는 것이 아니라 순환의 단계를 밟는다는 것을 한눈에 보게 한다.',
        mustShow: [
          '시계 방향으로 도는 원형 순환 화살표',
          '순환 위에 놓인 다섯 개의 빈 마디(작은 원 또는 둥근 사각형)',
          '다섯 마디 중 하나(위기 자리)가 다른 색으로 강조됨',
        ],
        mustNotShow: ['그림 안의 어떤 글자도', '실제 과학자나 실험 장면', '구체적 과학 기호'],
        labels: [
          { text: '정상과학', position: '위쪽 마디', x: 50, y: 12 },
          { text: '변칙 사례', position: '오른쪽 위 마디', x: 86, y: 38 },
          { text: '위기', position: '오른쪽 아래 마디', x: 76, y: 82 },
          { text: '혁명', position: '왼쪽 아래 마디', x: 24, y: 82 },
          { text: '새 정상과학', position: '왼쪽 위 마디', x: 14, y: 38 },
        ],
        genPrompt:
          'Minimal flat diagram on white background: a large circular cycle made of five curved arrow segments flowing clockwise, with five small empty rounded nodes evenly placed on the circle. One node (lower right) is filled with a single accent color; the others are outlined only. Clean vector style, black lines. No text, no letters, no icons.',
        altText:
          '흰 바탕에 시계 방향으로 도는 큰 원형 순환이 있고 그 위에 빈 마디 다섯 개가 고르게 놓여 있다. 위에서부터 시계 방향으로 정상과학, 변칙 사례, 위기, 혁명, 새 정상과학이며, 오른쪽 아래의 위기 마디만 색이 채워져 있다.',
        fallback: '다섯 낱말을 원 모양으로 판서하고 화살표로 잇는다. 「위기」에 동그라미.',
        license: '직접 제작',
      },
      linkedConceptId: 'c02-tentative',
      plainTerms: ['공동체의 비판을 거쳤기 때문에'],
      oneLine: '과학은 누적이 아니라 정상과학 → 변칙 → 위기 → 혁명의 순환으로 나아간다.',
      verified: false,
    },
    {
      id: 't02-lakatos',
      termKo: '과학적 연구 프로그램',
      termEn: 'scientific research programmes',
      scholars: [{ nameKo: '임레 라카토슈', nameEn: 'Imre Lakatos', year: '1970' }],
      claim:
        'Lakatos 는 Popper 의 반증주의와 Kuhn 의 패러다임 사이에 「연구 프로그램」을 놓았다. 프로그램은 반증에서 보호되는 **견고한 핵(hard core)** 과, 반증을 받아 내며 고쳐지는 **보호대(protective belt)** 로 이루어진다. ' +
        '반증 사례가 나오면 과학자는 핵이 아니라 보호대의 보조 가설을 고친다 — 그것이 비합리가 아니라 정상이다. 프로그램이 새 사실을 예측하며 나아가면 **전진적**, 사실을 뒤따라 땜질만 하면 **퇴행적**이며, 후자가 전자에 자리를 내준다.',
      bridgeToPlain:
        '이 카드의 「헷갈리지 말자」에서 「과학은 변하니까 믿을 수 없다」와 「교과서에 나오면 확정된 사실」을 둘 다 물리친 것이 Lakatos 의 자리다. 핵은 쉽게 바뀌지 않고(신뢰성), 보호대는 늘 고쳐진다(잠정성). ' +
        '학생이 반례를 보고도 생각을 지키는 것 — 나중에 개념변화에서 다룬다 — 도 이 틀로 보면 보호대를 고치는 정상적 반응이다.',
      limits:
        '어떤 프로그램이 퇴행적인지는 **사후에만** 판정된다 — 그 순간에는 알 수 없다. 그래서 이 틀은 과학사를 설명하지만 지금 무엇을 해야 하는지는 말해 주지 못한다는 비판(Feyerabend)이 있다. ' +
        '핵과 보호대의 경계도 프로그램 안에서 합의된 것일 뿐 논리적으로 정해지지 않는다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 2장',
      readings: [
        {
          title:
            'Lakatos, I. (1970). Falsification and the methodology of scientific research programmes. In I. Lakatos & A. Musgrave (Eds.), Criticism and the Growth of Knowledge (pp. 91–196). Cambridge University Press.',
        },
      ],
      linkedConceptId: 'c02-tentative',
      plainTerms: ['수정 가능성과 신뢰성이 왜 같이 갈 수 있는지'],
      oneLine: '반증에서 보호되는 핵과 고쳐지는 보호대. 과학은 핵을 지키며 보호대를 고친다.',
      verified: false,
    },
    {
      id: 't02-nos',
      termKo: '과학의 본성 합의 관점',
      termEn: 'consensus view of the nature of science (NOS)',
      scholars: [
        { nameKo: '노먼 레더먼', nameEn: 'Norman G. Lederman' },
        { nameKo: '윌리엄 매코머스', nameEn: 'William F. McComas', year: '1998·2002' },
      ],
      claim:
        '과학철학의 논쟁을 교실에 그대로 옮길 수는 없다. 1990년대 후반 Lederman·McComas 등은 철학자들 사이에 이견이 적고 초·중등 학생이 이해할 수 있는 과학의 특성을 추려 「합의 관점」으로 정리했다 — ' +
        '과학지식은 **잠정적**이고, **경험에 근거**하며, **이론을 업고**(주관성) 있고, **창의적**이며, **사회·문화에 뿌리내려** 있고, **관찰과 추론이 구분**되며, **법칙과 이론은 다른 종류의 지식**이다. ' +
        '이 관점은 NOS 를 「명시적·성찰적으로」 가르쳐야 한다고 주장한다 — 과학을 하다 보면 저절로 배워진다는 암묵적 접근은 효과가 없었다.',
      bridgeToPlain:
        '이 차시의 개념 카드 네 장 — 관찰과 추론, 자료와 증거, 잠정성과 신뢰성, 모형과 이론 — 이 이 목록에서 고른 네 축이다. ' +
        '이 차시의 학습목표 「과학의 본성을 명시적·성찰적으로 다룰 짧은 발문을 만든다」의 「명시적·성찰적」이 이 관점의 핵심 처방이다.',
      limits:
        '「합의」라는 이름에 대한 비판이 있다. 목록이 맥락과 분과의 차이를 지우고(물리와 생태학은 같은 「과학」인가), 과학의 실제 실행보다 철학적 명제 몇 개를 외우게 만든다는 것이다. ' +
        'Irzik & Nola(2011)의 「가족 유사성」 접근, Allchin(2011)의 「전체 과학(whole science)」 접근이 대안으로 제시됐다. 이 차시가 명제 목록이 아니라 발자국·기사·보고서로 시작하는 것은 그 비판을 받아들인 결과다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 2장',
      readings: [
        {
          title:
            'Lederman, N. G., Abd-El-Khalick, F., Bell, R. L., & Schwartz, R. S. (2002). Views of nature of science questionnaire. Journal of Research in Science Teaching, 39(6), 497–521.',
          url: 'https://doi.org/10.1002/tea.10034',
        },
        { title: 'McComas, W. F. (Ed.) (1998). The Nature of Science in Science Education: Rationales and Strategies. Kluwer.' },
      ],
      linkedConceptId: 'c02-tentative',
      plainTerms: ['과학의 본성을 명시적·성찰적으로'],
      oneLine: '학생이 알아야 할 과학의 특성 일곱 가지로 추린 목록. 명시적·성찰적으로 가르친다.',
      verified: false,
    },
    {
      id: 't02-model',
      termKo: '모형의 인식론',
      termEn: 'epistemology of models / modelling-based teaching',
      scholars: [
        { nameKo: '존 길버트', nameEn: 'John K. Gilbert' },
        { nameKo: '호자리아 주스티', nameEn: 'Rosária Justi', year: '2016' },
      ],
      claim:
        'Gilbert 와 Justi 는 모형을 「실제의 축소판」이 아니라 **특정 목적을 위해 만든 표상**으로 본다. 모형은 대상의 어떤 측면을 골라 단순화하고 다른 측면을 버리며, 그 선택이 곧 모형의 쓸모와 한계를 정한다. ' +
        '그래서 「맞는 모형」이 아니라 「이 질문에 쓸 만한 모형」이 있을 뿐이고, 과학자는 모형을 만들고·시험하고·고치고·버리는 순환(modelling)을 한다. 이 순환을 학생이 직접 하게 하는 것이 모형 기반 교수다.',
      bridgeToPlain:
        '이 카드의 「먼저 쉽게」에서 「실제를 작게 줄인 복사본이 아니라, 어떤 질문에 답하려고 고른 설명 도구」라고 한 것이 이 입장이다. ' +
        '「왜 필요한가」의 「실제와 다르니 틀린 모형」이 이 입장이 고치려는 학생의 생각이다. 모형 만들기 자체는 나중에 따로 배운다.',
      limits:
        '모형의 종류가 너무 많다 — 축소 모형, 수학 모형, 시뮬레이션, 비유, 도식 — 어서 한 이론으로 다 묶기 어렵다는 지적이 있다. ' +
        '또 학생이 「모형은 도구」라는 말을 들어도 실제 판단에서는 여전히 「닮았는가」로 모형을 평가한다는 것이 반복해서 보고됐다(Grosslight 외, 1991). 말을 바꾸는 것과 판단 기준이 바뀌는 것은 다르다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 2장 · 6장',
      readings: [
        { title: 'Gilbert, J. K., & Justi, R. (2016). Modelling-based Teaching in Science Education. Springer.' },
        {
          title: 'Gilbert, J. K. (2004). Models and modelling: Routes to more authentic science education. International Journal of Science and Mathematics Education, 2(2), 115–130.',
        },
      ],
      linkedConceptId: 'c02-model',
      plainTerms: ['어떤 질문에 답하려고 고른 설명 도구'],
      oneLine: '모형은 축소판이 아니라 목적을 위해 고른 표상. 만들고·시험하고·고치는 순환이 모형화다.',
      verified: false,
    },
  ],
}
