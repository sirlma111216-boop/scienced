import type { LessonTheory } from '../types'

/**
 * 과학교육론 2강 — 과학지식은 왜 고쳐지고도 믿을 만한가
 *
 * 카드 여섯 장(관찰과 추론 · 이론 의존성 · 경험적 근거와 상상 · 잠정성 · 법칙과 이론 · 공동체의 검토)에
 * 항목 하나씩을 붙였다. verify:theory 가 공개 차시의 카드마다 붙은 항목을 요구하므로 여섯이 최소다.
 * ★ 전부 초안(verified: false). 인명·연도는 확실한 것만 적었고 원문 인용은 넣지 않았다.
 *   교수법 2강의 t02 와 같은 학자를 다루지만 문장은 따로 썼다 (8.3).
 */
export const te02: LessonTheory = {
  summary:
    '「과학은 바뀌는데 왜 배워요」라는 학생의 물음에 답하려면 과학지식이 어떻게 만들어지고 어떻게 검토되는지를 알아야 한다. ' +
    'Hanson 은 1958년 관찰이 이미 개념을 업고 이루어진다는 것을, Popper 는 1934년 과학 이론의 표지가 반증 가능성이라는 것을, Kuhn(1962)과 Longino(1990)는 지식의 권위가 개인이 아니라 공동체의 절차에서 나온다는 것을 보였다. ' +
    '과학교육은 이 논의를 그대로 옮기지 않고 Lederman·McComas 등이 「학생이 알아야 할 과학의 특성」으로 추린 합의 관점을 쓴다. ' +
    '이 차시의 여섯 카드는 그 목록 가운데 관찰과 추론, 이론 의존성, 경험적 근거와 창의성, 잠정성, 법칙과 이론의 구분, 사회적 검토를 고른 것이다.',
  entries: [
    {
      id: 'te02-obs-inf',
      termKo: '관찰과 추론의 구분',
      termEn: 'observation and inference',
      scholars: [
        { nameKo: '노먼 레더먼', nameEn: 'Norman G. Lederman', year: '2002' },
        { nameKo: '푸아드 압델칼릭', nameEn: 'Fouad Abd-El-Khalick', year: '2002' },
      ],
      claim:
        'Lederman 과 동료들은 2002년 과학의 본성 검사 도구(VNOS)를 만들며 학생이 알아야 할 특성 일곱을 정리했고 그 첫째가 관찰과 추론의 구분이다. ' +
        '관찰은 감각이나 도구로 직접 접근할 수 있는 현상에 관한 기술이고, 추론은 그렇게 접근할 수 없는 것에 관한 진술이다. ' +
        '원자 모형이나 진화처럼 과학지식의 큰 부분이 추론이며, 추론이라는 사실이 그 지식의 지위를 낮추지 않는다. 다만 둘을 가를 수 있어야 무엇이 새 증거로 바뀔 수 있는지를 안다.',
      bridgeToPlain:
        '카드 1 의 「감각이나 도구로 직접 확인한 것」이 관찰의 정의이고, 「관찰한 것을 근거로 직접 보지 못한 것에 관해 세운 진술」이 추론의 정의다. ' +
        '활동 1 의 촛불 보고서에서 「산소가 다 타서 꺼졌다」를 관찰 칸에서 가려내는 일이 이 구분을 교실에서 쓰는 모습이다.',
      limits:
        '순수한 관찰이 없다는 Hanson 의 지적을 받아들이면 관찰과 추론은 칼로 자르듯 갈리지 않는다. 「물이 올라왔다」에도 이미 「물」이라는 범주가 들어 있다. ' +
        '그래서 이 구분은 존재론적 이분법이 아니라 어느 진술이 더 직접적이고 어느 진술이 더 많은 가정을 업고 있는가를 가르는 실용적 눈금으로 쓰는 것이 맞다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 2장',
      readings: [
        {
          title:
            'Lederman, N. G., Abd-El-Khalick, F., Bell, R. L., & Schwartz, R. S. (2002). Views of nature of science questionnaire: Toward valid and meaningful assessment of learners’ conceptions of nature of science. Journal of Research in Science Teaching, 39(6), 497–521.',
          url: 'https://doi.org/10.1002/tea.10034',
        },
      ],
      linkedConceptId: 'e02-observation',
      plainTerms: ['감각이나 도구로 직접 확인한 것'],
      oneLine: '직접 확인한 것(관찰)과 그것으로 세운 진술(추론)을 가르는 실용적 눈금. 추론도 과학지식이다.',
      verified: false,
    },
    {
      id: 'te02-hanson',
      termKo: '관찰의 이론 의존성',
      termEn: 'theory-ladenness of observation',
      scholars: [{ nameKo: '노우드 러셀 핸슨', nameEn: 'Norwood Russell Hanson', year: '1958' }],
      claim:
        'Hanson 은 『발견의 패턴』에서 본다는 것이 망막에 맺힌 상을 받아 적는 일이 아니라고 했다. 같은 상을 받아도 무엇을 아는가에 따라 다른 것을 본다. ' +
        '그래서 관찰은 이론에 앞서 있는 중립적 토대가 아니라 이미 개념을 업고 이루어지는 활동이다. 논리실증주의가 그린 「이론 없는 관찰로 이론을 검증한다」는 그림은 여기서 무너진다.',
      bridgeToPlain:
        '카드 2 의 「순수하게 중립적인 관찰은 없다」가 이 주장이다. 양파 표피 장면에서 세포 그림을 본 뒤에야 칸이 보이는 것이 이론 의존성의 교실판이다. ' +
        '카드 1 의 관찰·추론 구분과 나란히 읽어야 한다. 관찰이 개념을 업고 있다는 것과 관찰이 추론보다 직접적이라는 것은 모순이 아니다.',
      limits:
        '이론 의존성을 세게 밀면 어느 관찰도 다른 관찰보다 낫지 않다는 상대주의로 미끄러진다. Hanson 자신은 거기까지 가지 않았다. ' +
        '과학의 실제 관행인 측정의 표준화, 독립 반복, 공개 검토가 경쟁하는 이론 사이에서 관찰을 충분히 중립적으로 만든다는 것이 이후의 대답이다. 카드 6 의 공동체 검토가 그 자리다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 2장',
      readings: [{ title: 'Hanson, N. R. (1958). Patterns of Discovery: An Inquiry into the Conceptual Foundations of Science. Cambridge University Press.' }],
      linkedConceptId: 'e02-theory-laden',
      plainTerms: ['순수하게 중립적인 관찰은 없다'],
      oneLine: '관찰은 이론 없는 토대가 아니라 이미 개념을 업고 보는 활동이다. 그렇다고 상대주의는 아니다.',
      verified: false,
    },
    {
      id: 'te02-creative',
      termKo: '경험적 근거와 창의성',
      termEn: 'empirical basis and creativity in science',
      scholars: [{ nameKo: '노먼 레더먼', nameEn: 'Norman G. Lederman', year: '2007' }],
      claim:
        '과학의 본성 합의 관점은 과학지식이 자연 세계의 관찰에 근거한다는 것(경험적 근거)과 과학이 상상과 창의성을 요구한다는 것을 같은 목록에 놓는다. ' +
        'Lederman 은 2007년 『과학교육 연구 편람』의 장에서 이 둘이 학생에게 가장 어렵게 받아들여지는 짝이라고 정리했다. 학생은 과학을 사실의 수집으로 보고, 설명을 만드는 일에 상상이 든다는 것을 낯설어한다. ' +
        '자료는 설명을 강제하지 않는다. 같은 자료에서 다른 설명이 나올 수 있고, 어느 설명을 세울지는 과학자의 창의적 작업이다.',
      bridgeToPlain:
        '카드 3 의 「설명은 과학자가 상상으로 만든 것」이 창의성 쪽이고, 「자연 세계를 관찰한 자료에 기대야 한다」가 경험적 근거 쪽이다. ' +
        '뉴턴이 사과와 달을 하나의 설명으로 묶은 장면은 상상으로 만든 설명이 뒤이어 측정으로 시험된 본보기다.',
      limits:
        '「창의성」을 강조하면 학생이 과학을 아무 설명이나 지어내는 일로 오해할 수 있다. 상상은 자료에 매여 있고 시험을 받는다는 조건이 늘 같이 가야 한다. ' +
        '합의 관점 자체에 대해서도 목록이 분과의 차이를 지운다는 비판(Irzik & Nola, 2011)이 있다. 이 차시가 명제 목록이 아니라 장면으로 시작하는 것은 그 비판을 받아들인 결과다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 2장',
      readings: [
        {
          title:
            'Lederman, N. G. (2007). Nature of science: Past, present, and future. In S. K. Abell & N. G. Lederman (Eds.), Handbook of Research on Science Education (pp. 831–879). Lawrence Erlbaum.',
        },
      ],
      linkedConceptId: 'e02-empirical',
      plainTerms: ['설명은 과학자가 상상으로 만든 것'],
      oneLine: '과학은 자료에 근거하지만 설명은 상상으로 만든다. 둘은 서로를 지우지 않는다.',
      verified: false,
    },
    {
      id: 'te02-popper',
      termKo: '반증주의와 잠정성',
      termEn: 'falsificationism and tentativeness',
      scholars: [{ nameKo: '칼 포퍼', nameEn: 'Karl R. Popper', year: '1934/1959' }],
      claim:
        'Popper 는 과학과 비과학을 가르는 기준을 검증 가능성이 아니라 반증 가능성에 두었다. 확인 사례가 아무리 쌓여도 보편 진술은 증명되지 않지만 반례 하나는 그것을 무너뜨린다. ' +
        '그래서 과학 이론은 대담한 추측이고, 과학자의 일은 그것을 무너뜨리려 시험하는 것이며, 시험을 견딘 이론만 잠정적으로 받아들여진다. ' +
        '과학교육에서 말하는 잠정성은 이 논리에서 온다. 지식이 고쳐질 수 있다는 것은 결함이 아니라 시험에 열려 있다는 표지다.',
      bridgeToPlain:
        '카드 4 의 「반증 가능성」과 「지금까지 살아남은 설명」이 이 자리다. 「어떤 증거가 나오면 이 설명을 버릴지 말할 수 있는지 보면 그것이 과학적 설명인지 알 수 있다」는 기준이 반증 가능성을 교실의 물음으로 바꾼 것이다. ' +
        '활동 2 에서 「고쳐질 수 있어야 과학이다」를 근거로 고른 답이 여기에 기댄다.',
      limits:
        '실제 과학자는 반례 하나에 이론을 버리지 않고 측정을 의심하거나 보조 가설을 고친다(Duhem–Quine). Kuhn 과 Lakatos 의 비판이 여기서 시작된다. ' +
        '교실의 함의도 같다. 학생이 반례를 보고도 생각을 지키는 것은 비합리가 아니라 과학자와 같은 반응이다. 개념변화는 나중에 따로 다룬다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 2장',
      readings: [
        { title: 'Popper, K. R. (1959). The Logic of Scientific Discovery. Hutchinson. (원저 Logik der Forschung, 1934)' },
        { title: 'Popper, K. R. (1963). Conjectures and Refutations: The Growth of Scientific Knowledge. Routledge & Kegan Paul.' },
      ],
      linkedConceptId: 'e02-tentative',
      plainTerms: ['반증 가능성'],
      oneLine: '과학 이론의 표지는 반증 가능성. 고쳐질 수 있다는 것은 시험에 열려 있다는 뜻이다.',
      verified: false,
    },
    {
      id: 'te02-myths',
      termKo: '법칙과 이론의 구분 — 과학의 본성에 관한 신화',
      termEn: 'laws vs. theories / myths of science',
      scholars: [{ nameKo: '윌리엄 매코머스', nameEn: 'William F. McComas', year: '1998' }],
      claim:
        'McComas 는 1998년 교과서와 교실에 퍼진 과학의 본성에 관한 신화 열다섯 가지를 정리했다. 그 첫째가 「가설은 이론이 되고 이론은 법칙이 된다」는 위계다. ' +
        '법칙은 관찰된 규칙성을 일반화한 진술이고 이론은 그 규칙성을 설명하는 체계라서, 둘은 종류가 다른 지식이며 한쪽이 다른 쪽으로 자라지 않는다. ' +
        '이 신화가 남아 있으면 「이론」이라는 말이 「아직 확실하지 않은 것」으로 들리고, 잠정성을 가르칠수록 이론에 대한 불신이 커진다.',
      bridgeToPlain:
        '카드 5 의 「이론은 자라서 법칙이 된다」가 그 신화이고, 「어떻게 되는가」를 적는지 「왜 그런가」를 대는지로 가르는 기준이 그 대답이다. ' +
        '「진화는 이론일 뿐」이라는 학생의 말이 이 신화의 교실판이다. 잠정성 카드 바로 뒤에 이 카드를 둔 까닭이 여기 있다.',
      limits:
        '법칙과 이론의 경계가 늘 깨끗하지는 않다. 뉴턴의 운동 법칙은 규칙성의 기술이면서 설명 체계의 일부이기도 하다. ' +
        '그래서 이 구분은 「법칙은 확실하고 이론은 불확실하다」는 위계를 물리치는 데 쓰는 것이지, 모든 진술을 두 통에 나누는 분류표로 쓰는 것이 아니다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 2장',
      readings: [
        {
          title:
            'McComas, W. F. (1998). The principal elements of the nature of science: Dispelling the myths. In W. F. McComas (Ed.), The Nature of Science in Science Education: Rationales and Strategies (pp. 53–70). Kluwer.',
        },
      ],
      linkedConceptId: 'e02-law-theory',
      plainTerms: ['이론은 자라서 법칙이 된다'],
      oneLine: '법칙은 규칙성의 기술, 이론은 그 설명. 이론이 자라서 법칙이 되는 것이 아니다.',
      verified: false,
    },
    {
      id: 'te02-community',
      termKo: '과학의 사회적 검토',
      termEn: 'scientific community and social objectivity',
      scholars: [
        { nameKo: '토머스 쿤', nameEn: 'Thomas S. Kuhn', year: '1962' },
        { nameKo: '헬렌 롱기노', nameEn: 'Helen E. Longino', year: '1990' },
      ],
      claim:
        'Kuhn 은 과학자가 혼자 판단하지 않고 공동체가 공유하는 패러다임 안에서 무엇이 문제이고 무엇이 답인지 정한다고 보았다. 패러다임의 교체도 논리적 증명이 아니라 공동체의 전환이다. ' +
        'Longino 는 『사회적 지식으로서의 과학』에서 객관성이 개인 연구자의 덕목이 아니라 공개 비판이 제도로 갖추어진 공동체의 속성이라고 했다. 비판이 오갈 공개 장소, 비판에 응답하는 관행, 공유된 기준, 지적 권위의 평등이 그 조건이다. ' +
        '동료 심사와 독립 재현은 이 조건의 실물이다.',
      bridgeToPlain:
        '카드 6 의 「공개 비판의 절차」가 Longino 의 자리이고, 「과학자들이 공유하는 패러다임 안에서」가 Kuhn 의 자리다. ' +
        '「유튜브의 어떤 박사」를 반박하지 않고 「어디에 실렸고 누가 검토했는가」를 찾게 한 장면이 이 개념의 교실판이다. 활동 2 에서 「여럿이 따져서 남은 것이다」를 근거로 고른 답이 여기에 기댄다.',
      limits:
        'Kuhn 의 「패러다임」은 책 안에서 여러 뜻으로 쓰였다는 비판을 받았고, 공약 불가능성을 세게 읽으면 과학의 진보를 말할 수 없게 된다. Kuhn 자신은 그 독법을 거부했다. ' +
        'Longino 의 조건은 이상형이다. 실제 학계는 권위의 평등과 거리가 멀고, 동료 심사가 오류를 다 거르지도 못한다. 그래서 「검토를 거쳤다」는 「틀릴 수 없다」가 아니라 「개인의 말보다 무겁다」로 가르쳐야 한다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 2장',
      readings: [
        { title: 'Kuhn, T. S. (1962). The Structure of Scientific Revolutions. University of Chicago Press.' },
        { title: 'Longino, H. E. (1990). Science as Social Knowledge: Values and Objectivity in Scientific Inquiry. Princeton University Press.' },
      ],
      linkedConceptId: 'e02-community',
      plainTerms: ['공개 비판의 절차'],
      oneLine: '지식의 무게는 개인의 확신이 아니라 공동체의 공개 비판에서 나온다. 검토는 무오류가 아니라 무게다.',
      verified: false,
    },
  ],
}
