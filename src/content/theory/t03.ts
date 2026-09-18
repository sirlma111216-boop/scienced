import type { LessonTheory } from '../types'

/**
 * 3강 — 학생은 수업 전에 이미 자기 설명을 가지고 있다
 *
 * 오수벨은 여기에 명제 하나만 둔다. 이론 전체(선행조직자·점진적 분화)는 4강이 다루고
 * 서로 연결한다 — 강의자가 그렇게 정했다.
 * 「오개념」과 「대안적 개념」이 왜 다르게 쓰이는지는 Driver 항목에서 밝힌다.
 */
export const t03: LessonTheory = {
  summary:
    '「학생은 수업 전에 이미 자기 설명을 갖고 있다」는 명제는 Ausubel 이 1968년 교육심리학 전체를 한 원리로 줄이며 적은 것이다. ' +
    '그 설명이 무엇인지를 실제 학생의 말에서 캐낸 것은 1970년대 말부터의 「대안적 개념틀」 연구 — 영국의 Driver, 뉴질랜드의 Osborne 과 Freyberg — 였고, 이 흐름은 1980~90년대에 수천 편의 「학생 개념」 연구로 불어났다. ' +
    '그 설명이 머릿속에서 어떤 모양으로 있는가를 두고는 지금도 세 입장이 갈린다 — 일관된 이론(Vosniadou), 작은 조각들(diSessa), 범주의 착오(Chi). ' +
    '이 차시가 정정이 아니라 진단을 연습하는 것은 이 연구들의 공통 결론 때문이며, 진단 도구로 쓰는 2단계 문항은 Treagust 가 1988년 그 목적으로 만든 것이다.',
  entries: [
    {
      id: 't03-ausubel',
      termKo: '유의미수용학습 — 이미 알고 있는 것',
      termEn: 'meaningful reception learning',
      scholars: [{ nameKo: '데이비드 오수벨', nameEn: 'David P. Ausubel', year: '1968' }],
      claim:
        'Ausubel 은 학습이 새 정보를 학습자의 기존 인지 구조에 **비임의적·실질적으로** 연결할 때 유의미해진다고 보았다. 그 전제가 이 차시의 출발점이다 — **학습에 영향을 주는 가장 중요한 단일 요인은 학습자가 이미 알고 있는 것이며, 교사는 그것을 확인하고 그에 맞게 가르쳐야 한다.** ' +
        '이 명제가 이 차시 제목의 학술적 원형이다. 이론의 나머지 — 선행조직자, 점진적 분화, 통합적 조정 — 는 다음 차시의 「유의미학습」 카드에서 다룬다.',
      bridgeToPlain:
        '이 카드의 「무엇」에서 「학생이 수업 전에 이미 가지고 있는, 세상을 설명하는 규칙」이라고 한 것이 Ausubel 의 「이미 알고 있는 것」이다. ' +
        '「더 읽기」의 「선행개념을 다루는 첫 교사 행동은 정의도 반례도 아니라 예측 과제다」가 「그것을 확인하라」의 교실판이다.',
      limits:
        'Ausubel 은 「이미 알고 있는 것」을 주로 **학교에서 배운 상위 개념**으로 생각했다. 일상 경험에서 만들어진 규칙 — 「무거운 게 빨리 떨어진다」 — 이 얼마나 끈질기고 체계적인지는 뒤의 대안적 개념 연구가 밝혔다. ' +
        '그래서 이 차시는 Ausubel 의 명제에서 시작해 Driver 의 연구로 넘어간다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 3장 · 4장',
      readings: [
        { title: 'Ausubel, D. P. (1968). Educational Psychology: A Cognitive View. Holt, Rinehart and Winston.' },
      ],
      quotes: [
        {
          original:
            'If I had to reduce all of educational psychology to just one principle, I would say this: The most important single factor influencing learning is what the learner already knows. Ascertain this and teach him accordingly.',
          ko: '교육심리학 전체를 단 하나의 원리로 줄여야 한다면 이렇게 말하겠다. 학습에 영향을 주는 가장 중요한 단일 요인은 학습자가 이미 알고 있는 것이다. 그것을 확인하고, 그에 맞게 가르쳐라.',
          source: 'Ausubel (1968), 권두 제사(epigraph)',
        },
      ],
      linkedConceptId: 'c03-prior',
      plainTerms: ['학생이 수업 전에 이미 가지고 있는, 세상을 설명하는 규칙'],
      oneLine: '학습을 가장 크게 좌우하는 것은 학습자가 이미 아는 것이다 — 확인하고 그에 맞게 가르쳐라.',
      verified: false,
    },
    {
      id: 't03-driver',
      termKo: '대안적 개념틀',
      termEn: 'alternative frameworks',
      scholars: [{ nameKo: '로절린드 드라이버', nameEn: 'Rosalind Driver', year: '1978·1983' }],
      claim:
        'Driver 는 학생의 「틀린 답」이 무작위 오류가 아니라 **일관된 설명 체계**에서 나온다는 것을 실제 수업 관찰로 보였다. 그 체계를 「오개념(misconception)」이 아니라 **「대안적 개념틀(alternative frameworks)」** 이라고 부른 것은 두 가지 이유에서다 — ' +
        '첫째, 그 생각은 학생의 경험 안에서 합리적이며 여러 현상을 설명해 낸다(과학과 다를 뿐 「오류」가 아니다). 둘째, 「오개념」이라는 말은 교사의 일을 「지우기」로 만드는데, 실제 필요한 일은 그 틀이 어디까지 작동하고 어디서 막히는지를 학생과 함께 보는 것이다. ' +
        '이 용어 선택이 이후 「개념변화」 연구의 방향을 정했다.',
      bridgeToPlain:
        '이 카드 전체가 이 주장이다. 「무엇」의 「「틀린 생각」이라고 부르는 대신 지금 학생이 쓰고 있는 설명이라고 부르는 방식」이 대안적 개념틀이라는 용어 선택 그 자체다. ' +
        '이 강의가 「오개념」이라는 말을 개념 설명에서 피하는 이유가 여기 있다.',
      limits:
        '「틀(framework)」이라는 말은 학생의 생각이 이론처럼 일관되고 체계적이라는 뜻을 담는데, diSessa 는 그것이 과장이라고 보았다 — 학생의 직관은 훨씬 작고 단편적인 조각들이라는 것이다(p-prims). 이 논쟁은 아직 끝나지 않았다. ' +
        '또 「대안적」이라는 말이 「과학과 동등한 대안」으로 읽히면 상대주의가 된다. Driver 자신은 그렇게 읽지 않았다 — 과학적으로 더 나은 설명은 있다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 3장',
      readings: [
        {
          title:
            'Driver, R., & Easley, J. (1978). Pupils and paradigms: A review of literature related to concept development in adolescent science students. Studies in Science Education, 5(1), 61–84.',
        },
        { title: 'Driver, R. (1983). The Pupil as Scientist? Open University Press.' },
        { title: 'Driver, R., Guesne, E., & Tiberghien, A. (Eds.) (1985). Children’s Ideas in Science. Open University Press.' },
      ],
      linkedConceptId: 'c03-alternative',
      plainTerms: ['지금 학생이 쓰고 있는 설명이라고 부르는 방식'],
      oneLine: '학생의 「틀린 답」은 일관된 설명 체계에서 나온다. 오개념이 아니라 대안적 개념틀이라 부르는 이유.',
      verified: false,
    },
    {
      id: 't03-osborne',
      termKo: '아동의 과학',
      termEn: "children's science",
      scholars: [
        { nameKo: '로저 오즈번', nameEn: 'Roger Osborne' },
        { nameKo: '피터 프라이버그', nameEn: 'Peter Freyberg', year: '1985' },
      ],
      claim:
        '뉴질랜드의 「과학에서의 학습(Learning in Science)」 프로젝트가 낸 결론이다. 학생은 교실에 들어올 때 이미 자기 나름의 「과학」 — 세계가 어떻게 돌아가는지에 대한 설명, 그리고 과학 용어에 대한 자기 뜻 — 을 갖고 있으며, 그것을 **아동의 과학(children’s science)** 이라 불렀다. ' +
        '수업이 끝난 뒤 학생이 갖는 것은 교사의 과학이 아니라 아동의 과학과 교사의 과학이 섞인 무엇이다. 그래서 교사는 자기가 가르친 것이 아니라 학생이 실제로 갖게 된 것을 봐야 한다. ' +
        '이들은 특히 「동물」 「살아 있다」 「힘」 같은 일상어와 과학 용어의 뜻 차이가 학습을 가로막는다는 것을 보였다.',
      bridgeToPlain:
        '이 카드의 「왜」에서 「「먼저 써서」 「없어져서」 같은 말이 사고모형을 가리키는 표지」라고 한 것이 이 연구의 방법이다 — 학생의 낱말 그대로를 자료로 삼는다. ' +
        '「헷갈림」의 「교사가 정리해 준 문장과 다르다. 정리하는 순간 단서가 지워진다」도 같은 자리에서 왔다.',
      limits:
        '「아동의 과학」이라는 이름은 학생의 생각을 과학과 같은 급의 체계로 보게 하는데, 실제로는 훨씬 상황 의존적이고 불안정하다는 것이 이후 밝혀졌다. ' +
        '또 이 연구는 주로 8~17세 뉴질랜드 학생을 대상으로 했다. 언어와 문화가 다른 곳에서 같은 「아동의 과학」이 나오는지는 따로 확인해야 한다 — 한국어의 「힘」과 영어의 force 가 같은 일상적 뜻을 갖지 않는다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 3장',
      readings: [
        { title: "Osborne, R., & Freyberg, P. (1985). Learning in Science: The Implications of Children's Science. Heinemann." },
      ],
      linkedConceptId: 'c03-utterance',
      plainTerms: ['사고모형을 가리키는 표지'],
      oneLine: '학생은 자기 나름의 「과학」을 갖고 교실에 온다. 수업 뒤 남는 것은 그것과 교사의 과학이 섞인 것이다.',
      verified: false,
    },
    {
      id: 't03-vosniadou',
      termKo: '틀 이론',
      termEn: 'framework theory',
      scholars: [{ nameKo: '스텔라 보스니아두', nameEn: 'Stella Vosniadou', year: '1992·1994' }],
      claim:
        'Vosniadou 는 아이들이 지구의 모양에 대해 갖는 생각을 조사해, 그들의 답이 무작위가 아니라 몇 가지 **정신 모형** — 납작한 지구, 속이 빈 구, 두 개의 지구 — 으로 정리된다는 것을 보였다. ' +
        '그 모형들은 「땅은 평평하다」 「받쳐 주지 않으면 떨어진다」 같은 더 깊은 전제 — **틀 이론(framework theory)** — 에서 나온다. 새 정보(지구는 둥글다)는 이 틀 안에서 소화되어 「둥글지만 위가 평평한 지구」 같은 **종합 모형(synthetic model)** 을 만든다. ' +
        '개념변화란 정보를 더하는 것이 아니라 이 틀 자체를 고치는 일이며, 그래서 느리고 어렵다.',
      bridgeToPlain:
        '이 카드의 「무엇」에서 「학생 내부에서는 일관되게 작동하는 설명 체계」라고 한 것이 틀 이론 쪽 입장이다. ' +
        '「전류가 전구에서 소모된다」가 전지가 닳는 것도 전구를 더 달면 어두워지는 것도 설명한다고 한 것이, 틀이 종합 모형을 만드는 방식의 예다.',
      limits:
        'diSessa 와의 논쟁이 핵심이다 — 학생의 생각이 「이론」이라 불릴 만큼 일관된가, 아니면 상황마다 다른 조각이 켜지는가. 같은 학생이 문항의 표현만 바꿔도 다른 답을 한다는 자료가 diSessa 쪽을 지지한다. ' +
        'Vosniadou 는 뒤에 「틀」의 일관성을 처음보다 약하게 고쳤다. 지금은 두 입장이 영역과 나이에 따라 다르게 맞는다고 보는 것이 보통이다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 3장',
      readings: [
        {
          title: 'Vosniadou, S., & Brewer, W. F. (1992). Mental models of the earth: A study of conceptual change in childhood. Cognitive Psychology, 24(4), 535–585.',
          url: 'https://doi.org/10.1016/0010-0285(92)90018-W',
        },
        {
          title: 'Vosniadou, S. (1994). Capturing and modeling the process of conceptual change. Learning and Instruction, 4(1), 45–69.',
        },
      ],
      linkedConceptId: 'c03-alternative',
      plainTerms: ['학생 내부에서는 일관되게 작동하는 설명 체계'],
      oneLine: '학생의 생각은 깊은 전제(틀)에서 나오는 정신 모형이며, 새 정보는 틀 안에서 종합 모형으로 소화된다.',
      verified: false,
    },
    {
      id: 't03-disessa',
      termKo: '현상학적 원초 개념',
      termEn: 'phenomenological primitives (p-prims)',
      scholars: [{ nameKo: '안드레아 디세사', nameEn: 'Andrea A. diSessa', year: '1993' }],
      claim:
        'diSessa 는 물리에 대한 학생의 직관이 이론이 아니라 **작고 단편적인 지식 조각들**의 느슨한 모음이라고 주장했다. 「힘을 더 주면 더 간다(Ohm 의 p-prim)」 「가까울수록 세다」 「막으면 못 간다」처럼 경험에서 추상된 조각들은 그 자체로 옳고 그르지 않으며, **어느 상황에서 켜지는가**가 문제다. ' +
        '전문가의 지식은 이 조각들이 더 잘 조직되고 더 알맞은 상황에서 켜지는 것이지 조각을 버린 것이 아니다. 그래서 학습은 「오개념 제거」가 아니라 **지식 조각의 재조직**이다(knowledge in pieces).',
      bridgeToPlain:
        '이 카드의 「헷갈림」 — 「p-prims 는 「가까울수록 세다」 같은 아주 작은 직관 조각이다」 — 와 「더 읽기」의 「p-prims — 설명보다 작은 조각」이 이 이론이다. ' +
        '「여름엔 지구가 태양에 가깝다」를 「가까울수록 더 세다」가 계절에 잘못 켜진 것으로 읽은 것이 diSessa 식 진단이다.',
      limits:
        'Vosniadou 와의 논쟁의 반대편이다. 조각 이론은 학생 답의 상황 의존성을 잘 설명하지만, 어떤 학생이 여러 상황에서 **일관되게** 같은 오류를 내는 것은 설명하기 어렵다. ' +
        '또 p-prim 의 목록이 얼마나 되는지, 어떻게 확인하는지가 정해져 있지 않아 「사후 설명」이 된다는 비판이 있다. diSessa 는 물리 이외 영역에서도 같은 구조가 성립하는지를 열어 두었다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 3장',
      readings: [
        {
          title: 'diSessa, A. A. (1993). Toward an epistemology of physics. Cognition and Instruction, 10(2–3), 105–225.',
        },
      ],
      linkedConceptId: 'c03-alternative',
      plainTerms: ['아주 작은 직관 조각'],
      oneLine: '학생의 직관은 이론이 아니라 작은 지식 조각들. 문제는 조각이 어느 상황에서 켜지는가다.',
      verified: false,
    },
    {
      id: 't03-chi',
      termKo: '존재론적 범주 오류',
      termEn: 'ontological category mistake',
      scholars: [{ nameKo: '미셸린 치', nameEn: 'Michelene T. H. Chi', year: '1994' }],
      claim:
        'Chi 는 가장 끈질긴 과학 오개념의 공통점을 찾았다 — 학생이 **과정(process)** 을 **물질(substance)** 의 범주에 넣고 있다는 것. 열은 「흐르는 물질」이 아니라 과정이고, 전류는 「닳는 것」이 아니라 흐름이며, 빛은 「날아가는 알갱이」로만 생각되어서는 안 된다. ' +
        '이런 오개념은 같은 범주 안에서 속성을 고치는 것으로는 바뀌지 않는다. **범주 자체를 바꾸어야**(ontological shift) 하고, 그래서 다른 오개념보다 훨씬 오래 간다. 특히 「창발적 과정(emergent process)」 — 확산, 자연선택, 전류 — 은 「직접적 과정」으로 잘못 범주화되기 쉽다.',
      bridgeToPlain:
        '이 카드의 「교실에서」 — 「「써서」는 전류를 물질로 보는 단서다」 — 가 이 자리다. Chi 는 이것을 존재론적 범주의 착오라고 불렀다. ' +
        '「먼저 써서」 한 마디에서 두 개의 다음 수업이 나온 것 가운데 첫째 — 전하 보존과 에너지 전달을 가르는 활동 — 가 범주를 옮기는 수업이다.',
      limits:
        '범주 이론은 왜 어떤 오개념이 끈질긴지를 잘 설명하지만, 범주를 옮기는 **수업이 실제로 어떻게 생겨야 하는지**는 충분히 말해 주지 못한다. Chi 자신의 처방(창발 과정의 특징을 명시적으로 가르치기)의 효과는 제한적이었다. ' +
        '또 「물질/과정」 범주가 문화와 언어를 넘어 보편적인지 — 한국어 「열이 난다」와 영어 「heat flows」는 이미 다른 범주를 암시한다 — 는 열려 있다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 3장',
      readings: [
        {
          title:
            'Chi, M. T. H., Slotta, J. D., & de Leeuw, N. (1994). From things to processes: A theory of conceptual change for learning science concepts. Learning and Instruction, 4(1), 27–43.',
          url: 'https://doi.org/10.1016/0959-4752(94)90017-5',
        },
      ],
      linkedConceptId: 'c03-utterance',
      plainTerms: ['전류를 물질로 보는 단서'],
      oneLine: '끈질긴 오개념은 과정을 물질로 잘못 범주화한 것. 속성이 아니라 범주를 옮겨야 바뀐다.',
      verified: false,
    },
    {
      id: 't03-treagust',
      termKo: '2단계 진단 문항',
      termEn: 'two-tier diagnostic test',
      scholars: [{ nameKo: '데이비드 트레거스트', nameEn: 'David F. Treagust', year: '1988' }],
      claim:
        'Treagust 는 학생의 대안적 개념을 큰 집단에서 빠르게 찾아낼 수 있는 선택형 도구를 만들었다. **1단계**는 내용 질문에 대한 선택, **2단계**는 그 선택의 이유에 대한 선택이다. 2단계의 이유 선택지는 교사가 지어내지 않고 **면담과 서술형 답에서 실제 학생이 쓴 이유를 모아** 만든다. ' +
        '두 단계를 함께 보면 같은 답 뒤의 다른 이유가 갈라지고, 정답을 골랐지만 이유가 틀린 학생도 드러난다. 이후 확신도 단계를 더한 3단계·4단계 문항으로 발전했다.',
      bridgeToPlain:
        '이 카드의 「무엇」 — 「1단계에서 답을 고르고 2단계에서 그 이유를 고르면 같은 답 뒤의 다른 이유가 갈라져 보인다」 — 가 이 도구다. ' +
        '「교실에서」의 학생 A·B 답안이 그 예다 — 같은 답을 골랐지만 이유가 다르다.',
      limits:
        '2단계 문항은 이미 알려진 대안적 개념만 잡는다 — 선택지에 없는 생각은 보이지 않는다. 그래서 만들기 전에 반드시 면담이 필요하고, 그 면담이 없으면 교사의 상상으로 만든 「가짜 오개념」 목록이 된다. ' +
        '또 이유를 「고르는」 것과 「말하는」 것은 다르다. 학생은 자기 생각과 가장 비슷한 선택지를 고를 뿐, 그것이 자기 생각은 아닐 수 있다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 3장',
      readings: [
        {
          title:
            'Treagust, D. F. (1988). Development and use of diagnostic tests to evaluate students’ misconceptions in science. International Journal of Science Education, 10(2), 159–169.',
          url: 'https://doi.org/10.1080/0950069880100204',
        },
      ],
      linkedConceptId: 'c03-diagnosis',
      plainTerms: ['같은 답 뒤의 다른 이유가 갈라져 보인다'],
      oneLine: '답을 고르고 이유도 고르는 두 단계 문항. 이유 선택지는 실제 학생의 말에서 만든다.',
      verified: false,
    },
  ],
}
