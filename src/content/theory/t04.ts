import type { LessonTheory } from '../types'

/**
 * 4강 — 학습이론을 수업 언어로 바꾸기
 *
 * 오수벨의 이론 전체가 여기 온다. 3강은 명제 하나만 두고 이리로 잇는다.
 * 지시서 M 의 일곱 항목(Piaget · Ausubel · Vygotsky/Wood-Bruner-Ross · Bruner · Flavell · Sweller · HPL II).
 */
export const t04: LessonTheory = {
  summary:
    '이 차시의 네 이론은 20세기 중반 심리학이 학습을 설명한 네 갈래다. Piaget 는 1920~50년대에 아이가 자기 틀로 세계를 소화하고(동화) 틀을 고치는(조절) 과정을 그렸고, Ausubel 은 1960년대에 「이미 아는 것에 잇는 것」이 유의미학습의 조건이라 했으며, Vygotsky 는 1930년대에 쓰고 1978년에야 영어로 소개된 글에서 발달이 사회적 상호작용에서 온다고 했고, Bruner 는 1960년대에 어떤 내용도 어떤 나이에나 정직한 형태로 가르칠 수 있다고 주장했다. ' +
    '「비계」라는 말은 Vygotsky 가 아니라 Wood·Bruner·Ross 가 1976년에 만들었다. ' +
    '이 넷은 경쟁하는 정답이 아니라 같은 수업 장면에서 다른 것을 보게 하는 도구이며, 1990년대 이후의 메타인지(Flavell)·인지부하(Sweller) 연구와 2018년의 『How People Learn II』가 그것들을 하나의 그림으로 묶었다.',
  entries: [
    {
      id: 't04-piaget',
      termKo: '동화·조절·평형화와 인지발달 단계',
      termEn: 'assimilation, accommodation, equilibration / stages of cognitive development',
      scholars: [{ nameKo: '장 피아제', nameEn: 'Jean Piaget', year: '1952·1985' }],
      claim:
        'Piaget 는 지식이 밖에서 안으로 옮겨지는 것이 아니라 아이가 세계와 부딪치며 **구성**하는 것이라고 보았다. 새 경험은 기존 인지 도식(schema)에 **동화**되거나, 도식이 그것에 맞게 **조절**되며, 둘 사이의 균형을 되찾으려는 작용이 **평형화**다. ' +
        '그는 이 작용이 나이에 따라 질적으로 다른 네 단계 — 감각운동기, 전조작기, 구체적 조작기, 형식적 조작기 — 를 거친다고 보았고, 특히 청소년기의 형식적 조작(가설연역적 사고, 변인 통제)이 과학 학습의 조건이라고 했다.',
      bridgeToPlain:
        '이 카드의 「먼저 쉽게」 — 「새 경험을 기존 틀에 끼워 넣는 것이 동화, 틀 자체를 고치는 것이 조절」 — 이 그대로 이 이론의 두 작용이고, 「더 읽기」의 「평형화 — 균형을 되찾는 힘, 그리고 그 함정」이 평형화다. ' +
        '「헷갈리지 말자」에서 「발달 단계를 나이로 고정해 읽으면 안 된다」고 한 것은 아래 한계에서 온다.',
      limits:
        '단계 이론은 가장 많이 비판받은 부분이다. 같은 아이가 영역에 따라 다른 단계의 사고를 보이고(décalage), 과제의 표현을 바꾸면 더 어린 나이에도 「형식적」 사고를 한다는 것이 반복해서 보여졌다. 지금은 단계를 「나이표」가 아니라 사고의 종류를 가르는 눈금으로 읽는다. ' +
        '또 Piaget 는 사회적 상호작용과 언어의 역할을 작게 보았다 — Vygotsky 가 그 자리를 채운다. ' +
        '과학교육에서의 응용(Lawson 의 순환학습, 인지가속 프로그램 CASE)은 Piaget 를 그대로가 아니라 고쳐 쓴 것이다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 4장',
      readings: [
        { title: 'Piaget, J. (1952). The Origins of Intelligence in Children. International Universities Press.' },
        { title: 'Piaget, J. (1985). The Equilibration of Cognitive Structures: The Central Problem of Intellectual Development. University of Chicago Press.' },
      ],
      linkedConceptId: 'c04-assimilation',
      plainTerms: ['새 경험을 기존 틀에 끼워 넣는 것이 동화, 틀 자체를 고치는 것이 조절'],
      oneLine: '지식은 동화와 조절, 그 사이의 평형화로 아이가 스스로 구성한다. 단계는 나이표가 아니라 사고의 종류다.',
      verified: false,
    },
    {
      id: 't04-ausubel',
      termKo: '유의미학습·선행조직자·점진적 분화·통합적 조정',
      termEn: 'meaningful learning / advance organizer / progressive differentiation / integrative reconciliation',
      scholars: [{ nameKo: '데이비드 오수벨', nameEn: 'David P. Ausubel', year: '1960·1968' }],
      claim:
        'Ausubel 은 학습을 두 축으로 갈랐다. **수용 ↔ 발견**은 내용이 학습자에게 어떻게 오는가(완성된 형태로 제시되는가, 스스로 찾는가)의 축이고, **유의미 ↔ 기계적**은 그 내용이 기존 인지 구조에 비임의적·실질적으로 이어지는가의 축이다. 두 축은 독립이다 — 수용학습도 유의미할 수 있고 발견학습도 기계적일 수 있다. ' +
        '유의미학습을 돕는 장치가 **선행조직자(advance organizer)**: 세부 내용보다 앞서 제시되는, 더 추상적이고 포괄적인 틀이다. 인지 구조는 위에서 아래로 갈라져 내려가고(**점진적 분화**), 갈라진 것들 사이의 관계를 다시 잇는 일(**통합적 조정**)이 필요하다.',
      bridgeToPlain:
        '이 카드의 「꼭 알아야 할 것」 첫 두 줄 — 「두 축을 가른다」 「네 칸이 생긴다」 — 가 이 이론의 두 축이고, 「더 읽기」의 「네 칸」 표가 그것을 펼친 것이다. ' +
        '「선행조직자 — 요약문이 아니라 걸개」라고 한 것이 advance organizer 다. ' +
        '이 강의 3강의 출발점 — 「학습자가 이미 알고 있는 것」 — 도 이 이론의 전제다. 그 명제는 3강 이론 배경에 있다.',
      limits:
        '선행조직자의 효과는 연구마다 갈렸다. 조직자가 「학습자가 이미 아는 것보다 조금 위」에 있어야 한다는 조건이 지켜지지 않으면 효과가 없거나 오히려 방해가 되고, 그 조건을 실험에서 통제하기가 어렵다. ' +
        '또 Ausubel 은 학습자의 「이미 아는 것」을 주로 학교 지식으로 보았기 때문에, 일상 경험에서 온 대안적 개념(3강)이 새 내용에 어떻게 저항하는지는 설명하지 못한다. 유의미하게 이었는데 틀린 것에 이은 경우다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 4장',
      readings: [
        {
          title: 'Ausubel, D. P. (1960). The use of advance organizers in the learning and retention of meaningful verbal material. Journal of Educational Psychology, 51(5), 267–272.',
        },
        { title: 'Ausubel, D. P. (1968). Educational Psychology: A Cognitive View. Holt, Rinehart and Winston.' },
      ],
      linkedConceptId: 'c04-meaningful',
      plainTerms: ['설명해도 유의미할 수 있고, 발견해도 기계적일 수 있다'],
      oneLine: '수용/발견과 유의미/기계적은 다른 축. 선행조직자는 세부보다 먼저 주는 상위의 걸개다.',
      verified: false,
    },
    {
      id: 't04-vygotsky',
      termKo: '근접발달영역',
      termEn: 'zone of proximal development (ZPD)',
      scholars: [{ nameKo: '레프 비고츠키', nameEn: 'Lev S. Vygotsky', year: '1934/1978' }],
      claim:
        'Vygotsky 는 고등 정신 기능이 먼저 사람 사이에서(interpsychological) 나타나고 그다음에 개인 안으로(intrapsychological) 들어온다고 보았다. 학습은 발달을 뒤따르는 것이 아니라 **앞서 끌고 간다**. ' +
        '그 자리가 근접발달영역이다 — 혼자 문제를 풀어 정해지는 실제 발달 수준과, 어른의 안내나 더 유능한 또래와의 협력으로 풀어 정해지는 잠재 발달 수준 사이의 거리. 이 영역은 이미 익은 열매가 아니라 **지금 익고 있는 기능**을 가리키며, 가르침은 여기를 겨냥해야 한다.',
      bridgeToPlain:
        '이 카드의 「먼저 쉽게」 — 「혼자 할 수 있는 수행과, 도움을 받으면 할 수 있는 다음 수행 사이의 영역」 — 이 정의 그대로다. ' +
        '「더 읽기」의 「지능 검사에서 같은 점수를 받은 두 아이에게 도움을 줘 보니…」가 Vygotsky 가 이 개념을 꺼낸 바로 그 장면이다.',
      limits:
        'Vygotsky 는 1934년에 죽었고 이 개념을 충분히 다듬지 못했다. 「도움」이 무엇이어야 하는지, 영역의 폭을 어떻게 재는지는 후대가 채웠다. 그 가운데 하나가 비계다. ' +
        '또 「더 유능한 타인」이 늘 있어야 한다는 뜻으로 읽으면 또래끼리의 협력이나 혼자 하는 탐구의 자리가 없어진다. 후속 연구는 도구·글·환경도 그 역할을 할 수 있다고 넓혔다. ' +
        '영역을 학생별 고정값으로 재려는 시도는 개념의 뜻과 어긋난다 — 영역은 과제와 시점마다 다르다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 4장',
      readings: [
        {
          title: 'Vygotsky, L. S. (1978). Mind in Society: The Development of Higher Psychological Processes (M. Cole, V. John-Steiner, S. Scribner, & E. Souberman, Eds.). Harvard University Press.',
        },
      ],
      quotes: [
        {
          original:
            'It is the distance between the actual developmental level as determined by independent problem solving and the level of potential development as determined through problem solving under adult guidance or in collaboration with more capable peers.',
          ko: '그것은 독립적인 문제 해결로 정해지는 실제 발달 수준과, 어른의 안내 아래 또는 더 유능한 또래와의 협력으로 문제를 풀어 정해지는 잠재 발달 수준 사이의 거리다.',
          source: 'Vygotsky (1978), Mind in Society, p. 86',
        },
      ],
      figure: {
        purpose: '영역이 「위」도 「아래」도 아닌 사이의 띠이며, 가르침이 겨냥할 자리가 어디인지 보게 한다.',
        mustShow: [
          '가운데가 같은 동심원 세 개',
          '안쪽 원은 진하게 채워짐, 가운데 띠는 옅게 채워짐, 바깥 띠는 비어 있음',
          '가운데 띠를 가리키는 작은 화살표 하나',
        ],
        mustNotShow: ['그림 안의 어떤 글자도', '사람의 모습', '사다리나 계단 같은 다른 비유'],
        labels: [
          { text: '혼자 할 수 있다', position: '안쪽 원', x: 50, y: 50 },
          { text: '도우면 할 수 있다', position: '가운데 띠 위쪽', x: 50, y: 22 },
          { text: '아직 못 한다', position: '바깥 띠 위쪽', x: 50, y: 6 },
        ],
        legend: '가운데 띠가 근접발달영역이다. 화살표가 가르침이 겨냥할 자리를 가리킨다.',
        genPrompt:
          'Minimal flat diagram on white background: three concentric circles. The innermost circle is filled solid dark, the middle ring is filled with a light tint, the outer ring is empty with a thin outline. A single small arrow points at the middle ring from the right. Clean vector style. No text, no letters, no icons, no people.',
        altText:
          '흰 바탕에 동심원 세 개가 있다. 안쪽 원은 진하게 채워져 있고(혼자 할 수 있다), 가운데 띠는 옅게 채워져 있으며(도우면 할 수 있다 — 이것이 근접발달영역), 바깥 띠는 비어 있다(아직 못 한다). 오른쪽에서 작은 화살표가 가운데 띠를 가리킨다.',
        fallback: '동심원 셋을 판서하고 가운데 띠에 빗금을 친다. 「여기를 겨냥한다」고 적는다.',
        license: '직접 제작',
      },
      linkedConceptId: 'c04-zpd',
      plainTerms: ['혼자 할 수 있는 수행과, 도움을 받으면 할 수 있는 다음 수행 사이의 영역'],
      oneLine: '혼자 하는 수준과 도움받아 하는 수준 사이의 거리. 학습은 발달을 뒤따르지 않고 앞서 끈다.',
      verified: false,
    },
    {
      id: 't04-scaffold',
      termKo: '비계',
      termEn: 'scaffolding',
      scholars: [
        { nameKo: '데이비드 우드', nameEn: 'David Wood' },
        { nameKo: '제롬 브루너', nameEn: 'Jerome S. Bruner' },
        { nameKo: '게일 로스', nameEn: 'Gail Ross', year: '1976' },
      ],
      claim:
        '「비계」는 흔히 Vygotsky 의 용어로 알려져 있지만, 실제로는 Wood·Bruner·Ross 가 1976년 어른이 3~5세 아이의 블록 쌓기를 돕는 장면을 분석하며 만든 말이다. 그들은 잘 돕는 어른이 하는 일을 여섯 가지로 적었다 — 관심 끌기, 자유도 줄이기, 방향 유지, 결정적 특징 표시, 좌절 조절, 시범. ' +
        '핵심 세 성질은 뒤에 정리됐다. **반응에 맞춤(contingency)**: 도움의 크기가 아이의 직전 반응에 따라 달라진다. **줄이기(fading)**: 아이가 해내면 도움을 거둔다. **책임 넘기기(transfer of responsibility)**: 결국 아이가 과제를 맡는다. 셋 가운데 하나라도 없으면 비계가 아니라 그냥 도움이다.',
      bridgeToPlain:
        '이 카드의 「꼭 알아야 할 것」 둘째 줄 — 「세 가지가 있어야 비계다 … ③ 걷어낼 계획」 — 이 세 성질이고, 「더 읽기」의 「이 말을 만든 사람들이 본 것」이 1976년 논문의 그 장면이다. ' +
        '오늘 모듈의 「세 장면」은 반응에 맞춤과 줄이기를 직접 연습하는 것이다.',
      limits:
        '원래 연구는 어른 한 명과 아이 한 명의 일대일 장면이다. 서른 명이 있는 교실에서 「반응에 맞춤」을 어떻게 하는가는 이 개념이 답하지 않는다 — 후속 연구가 또래 비계, 도구 비계(양식·소프트웨어), 분산 비계로 넓혔지만, 그럴수록 「반응에 맞춤」이 약해진다는 긴장이 있다. ' +
        '또 「비계」라는 비유가 너무 잘 통해서 모든 도움이 비계라 불리게 됐다. 걷어낼 계획이 없는 상시 양식은 비계가 아니다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 4장',
      readings: [
        {
          title: 'Wood, D., Bruner, J. S., & Ross, G. (1976). The role of tutoring in problem solving. Journal of Child Psychology and Psychiatry, 17(2), 89–100.',
          url: 'https://doi.org/10.1111/j.1469-7610.1976.tb00381.x',
        },
      ],
      quotes: [
        {
          original:
            'This scaffolding consists essentially of the adult "controlling" those elements of the task that are initially beyond the learner\'s capacity, thus permitting him to concentrate upon and complete only those elements that are within his range of competence.',
          ko: '이 비계는 본질적으로, 처음에는 학습자의 능력 밖에 있는 과제 요소들을 어른이 「맡아 주어」, 학습자가 자기 능력 범위 안의 요소에만 집중해 그것을 완수하게 하는 데 있다.',
          source: 'Wood, Bruner & Ross (1976), p. 90',
        },
      ],
      linkedConceptId: 'c04-scaffold',
      plainTerms: ['지금은 도움을 받아 하고, 나중에는 혼자 하게 만드는 임시 지원'],
      oneLine: '반응에 맞추고, 줄이고, 책임을 넘기는 임시 지원. 1976년 Wood·Bruner·Ross 의 말이다.',
      verified: false,
    },
    {
      id: 't04-bruner',
      termKo: '표상의 세 양식과 나선형 교육과정',
      termEn: 'enactive, iconic, symbolic representation / spiral curriculum',
      scholars: [{ nameKo: '제롬 브루너', nameEn: 'Jerome S. Bruner', year: '1960·1966' }],
      claim:
        'Bruner 는 아이가 세계를 세 양식으로 표상한다고 보았다 — **작동적(enactive)**: 행동으로, **영상적(iconic)**: 그림·심상으로, **상징적(symbolic)**: 언어·기호로. 세 양식은 순서대로 나타나지만 뒤의 것이 앞의 것을 대체하지 않고 함께 남는다. ' +
        '여기서 **나선형 교육과정**이 나온다. 어떤 교과의 핵심 구조든 어느 발달 단계의 아이에게나 지적으로 정직한 형태로 가르칠 수 있으며, 같은 구조를 학년이 올라가며 더 추상적인 양식으로 다시 다루어야 한다는 것이다. 그리고 그는 학생이 그 구조를 **발견**하게 하는 수업을 옹호했다.',
      bridgeToPlain:
        '이 차시의 「친절한 길잡이」 — 「같은 수업 장면을 놓고 각각 다른 것을 보게 한다」 — 에서 Bruner 가 보게 하는 것은 「이 개념을 지금 어느 양식으로 만나고 있는가」다. 밀도를 손으로 재고(작동), 표로 보고(영상), 식으로 쓰는(상징) 순서가 그것이다. ' +
        '「발견해도 기계적일 수 있다」는 Ausubel 의 지적은 Bruner 의 발견학습을 향한 것이다.',
      limits:
        '「어떤 내용이든 어느 나이에나」는 강한 주장이고, 그대로 받으면 발달의 한계를 무시하게 된다. Bruner 자신도 「지적으로 정직한 형태로」라는 조건을 붙였는데 그 조건이 무엇인지는 교과마다 따로 밝혀야 한다. ' +
        '발견학습은 이후 「최소 안내 수업」 논쟁(Kirschner·Sweller·Clark, 2006)에서 정면으로 비판받았다 — 안내 없는 발견은 초보자에게 비효율적이라는 것이다. Bruner 도 만년에는 문화와 이야기의 역할로 무게를 옮겼다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 4장',
      readings: [
        { title: 'Bruner, J. S. (1960). The Process of Education. Harvard University Press.' },
        { title: 'Bruner, J. S. (1966). Toward a Theory of Instruction. Harvard University Press.' },
      ],
      quotes: [
        {
          original: 'We begin with the hypothesis that any subject can be taught effectively in some intellectually honest form to any child at any stage of development.',
          ko: '우리는 어떤 교과든 어느 발달 단계의 어떤 아이에게나 지적으로 정직한 어떤 형태로 효과적으로 가르칠 수 있다는 가설에서 출발한다.',
          source: 'Bruner (1960), The Process of Education, p. 33',
        },
      ],
      linkedConceptId: 'c04-meaningful',
      plainTerms: ['같은 수업 장면을 놓고 각각 다른 것을 보게 한다'],
      oneLine: '행동·그림·기호의 세 표상 양식. 같은 구조를 학년마다 더 추상적인 양식으로 다시 만나는 나선형 교육과정.',
      verified: false,
    },
    {
      id: 't04-flavell',
      termKo: '메타인지',
      termEn: 'metacognition',
      scholars: [{ nameKo: '존 플라벨', nameEn: 'John H. Flavell', year: '1976·1979' }],
      claim:
        'Flavell 은 「자기 인지에 관한 인지」에 메타인지라는 이름을 붙이고 두 부분으로 나눴다. **메타인지적 지식**: 사람·과제·전략에 관해 내가 아는 것(「나는 그래프보다 표가 편하다」), **메타인지적 조절**: 자기 인지를 계획하고 점검하고 평가하는 것(「이 답이 맞는지 다른 방법으로 확인해 보자」). ' +
        '1979년 모형은 여기에 **메타인지적 경험** — 「이해가 안 된다」는 느낌 같은 — 을 더했다. 이 느낌이 조절을 촉발한다. 학습을 잘하는 사람과 못하는 사람의 차이가 지식의 양보다 이 조절에 있다는 것이 이후 연구의 결론이다.',
      bridgeToPlain:
        '이 카드의 「더 읽기」 — 「조절의 증거는 학생이 자기 틀의 한계를 말할 때」 — 에서 「전에 제가 생각하던 대로면 이건 설명이 안 돼요」라는 말이 메타인지적 경험이 조절로 이어진 순간이다. ' +
        '이 앱이 첫 답을 남겨 두고 그 아래에 다시 고른 답을 붙이는 것은 학생이 자기 생각의 앞뒤를 볼 수 있게 — 메타인지적 조절이 일어날 자리를 만들려는 것이다.',
      limits:
        '메타인지는 개념이 넓어서 자기조절학습·성찰·실행 기능과 경계가 흐리다. 재는 방법도 문제다 — 자기 보고 설문은 「내가 점검한다고 생각하는 것」을 재지 「점검하는 것」을 재지 않는다. ' +
        '또 메타인지를 「가르칠 수 있는가」는 영역 일반 전략(「계획하라」)보다 영역 특수 전략(「그래프를 읽을 때는 축부터」)이 더 잘 옮겨진다는 쪽으로 정리되고 있다. 메타인지 수업이 내용과 떨어져 있으면 효과가 적다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 4장',
      readings: [
        {
          title: 'Flavell, J. H. (1979). Metacognition and cognitive monitoring: A new area of cognitive–developmental inquiry. American Psychologist, 34(10), 906–911.',
          url: 'https://doi.org/10.1037/0003-066X.34.10.906',
        },
      ],
      quotes: [
        {
          original: 'Metacognition refers to one\'s knowledge concerning one\'s own cognitive processes and products or anything related to them.',
          ko: '메타인지란 자기 자신의 인지 과정과 산물, 또는 그것과 관련된 무엇에 관한 자기 지식을 가리킨다.',
          source: 'Flavell (1976), Metacognitive aspects of problem solving, p. 232',
        },
      ],
      linkedConceptId: 'c04-assimilation',
      plainTerms: ['옛 틀로는 설명이 안 되는 현상을 학생이 스스로 짚는 것'],
      oneLine: '자기 인지에 관한 인지 — 아는 것(지식)과 계획·점검·평가하는 것(조절). 잘 배우는 사람은 조절이 다르다.',
      verified: false,
    },
    {
      id: 't04-sweller',
      termKo: '인지부하 이론',
      termEn: 'cognitive load theory',
      scholars: [{ nameKo: '존 스웰러', nameEn: 'John Sweller', year: '1988' }],
      claim:
        'Sweller 는 작업 기억의 용량이 매우 작다는 사실에서 출발했다. 학습이란 작업 기억에서 처리한 것이 장기 기억의 도식(schema)으로 옮겨지는 일인데, 작업 기억이 과제 자체가 아닌 것에 쓰이면 그 이동이 막힌다. ' +
        '부하는 셋으로 나뉜다 — **내재적 부하**: 내용 자체의 복잡성(요소 사이의 상호작용), **외재적 부하**: 제시 방식이 만드는 불필요한 부하(흩어진 정보, 무관한 그림), **본유적(germane) 부하**: 도식 형성에 쓰이는 부하. 수업 설계는 외재적 부하를 줄이고 본유적 부하에 자리를 내주어야 한다. 초보자에게는 완성된 예(worked example)를 보이는 것이 문제를 풀게 하는 것보다 낫다는 「완성예 효과」가 대표적 결과다.',
      bridgeToPlain:
        '이 차시의 「비계」 카드에서 「3단계 — 부분 완성 예」 「4단계 — 사고 과정을 보인 완성 예」를 힌트 수준으로 둔 것이 완성예 효과다. ' +
        '「근접발달영역」 카드의 학생 ㄹ — 「완성 예를 봐도 못 따라온다 … 앞 단계로 돌아가야 한다」 — 는 내재적 부하가 작업 기억을 넘친 경우로 읽을 수 있다.',
      limits:
        '세 부하를 따로 잴 방법이 없다는 것이 가장 큰 비판이다. 결과를 보고 「외재적 부하가 컸다」고 말하면 순환 논리가 된다. Sweller 자신도 뒤에 본유적 부하를 독립 범주에서 뺐다. ' +
        '또 완성예 효과는 초보자에게만 나타나고 숙련자에게는 오히려 역효과가 난다(전문성 역전 효과). 그래서 「완성 예가 낫다」가 아니라 「누구에게, 언제」가 늘 붙어야 한다. 이 이론은 발견학습 비판의 근거로 자주 쓰이지만, 그 비판이 「안내된 탐구」까지 겨냥하는지는 논쟁 중이다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 4장',
      readings: [
        {
          title: 'Sweller, J. (1988). Cognitive load during problem solving: Effects on learning. Cognitive Science, 12(2), 257–285.',
          url: 'https://doi.org/10.1207/s15516709cog1202_4',
        },
      ],
      linkedConceptId: 'c04-scaffold',
      plainTerms: ['부분 완성 예'],
      oneLine: '작업 기억은 작다. 제시 방식이 만드는 불필요한 부하를 줄여야 도식이 만들어진다. 초보자에겐 완성 예가 낫다.',
      verified: false,
    },
    {
      id: 't04-hpl2',
      termKo: '『사람은 어떻게 배우는가 II』',
      termEn: 'How People Learn II: Learners, Contexts, and Cultures',
      scholars: [{ nameKo: '미국 국립학술원', nameEn: 'National Academies of Sciences, Engineering, and Medicine', year: '2018' }],
      claim:
        '2000년의 『How People Learn』을 18년 만에 고쳐 쓴 보고서다. 앞 판이 인지과학의 결과 — 선행 지식의 역할, 전문가와 초보자의 차이, 메타인지 — 를 정리했다면, 이 판은 거기에 **학습이 문화와 맥락 안에서 일어난다**는 것, 학습 유형이 여럿이며(습관·관찰·모형 기반·추론·통합) 각각 다른 기제를 갖는다는 것, 동기와 정서가 인지와 분리되지 않는다는 것을 더했다. ' +
        '이 차시의 네 이론이 서로 다른 것을 본다면, 이 보고서는 그것들이 같은 그림의 다른 조각임을 보이려 한 문서다.',
      bridgeToPlain:
        '이 차시의 「먼저 한 문장」 — 네 이론은 「같은 수업 장면에서 각각 다른 문제를 보게 하는 이론」 — 과 수업 정리의 「한 이론만으로 처방했을 때 놓치는 것」이 이 보고서의 태도다. 하나의 이론이 아니라 여럿을 겹쳐 본다.',
      limits:
        '합의 보고서라 논쟁이 있는 자리를 뭉뚱그린다 — 발견학습 논쟁, 학습 양식 신화, 인지부하의 측정 문제가 정면으로 다뤄지지 않는다. ' +
        '또 미국의 교실과 자료를 바탕으로 쓰였다. 「문화와 맥락」을 강조하는 보고서가 정작 다른 문화의 교실은 거의 다루지 않는다는 지적이 있다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 4장',
      readings: [
        {
          title: 'National Academies of Sciences, Engineering, and Medicine (2018). How People Learn II: Learners, Contexts, and Cultures. The National Academies Press.',
          url: 'https://doi.org/10.17226/24783',
        },
      ],
      linkedConceptId: 'c04-zpd',
      plainTerms: ['한 이론만으로 처방하면 반드시 놓치는 부분이 생긴다'],
      oneLine: '학습은 문화와 맥락 안에서, 여러 기제로, 동기·정서와 함께 일어난다 — 네 이론을 한 그림으로 묶은 보고서.',
      verified: false,
    },
  ],
}
