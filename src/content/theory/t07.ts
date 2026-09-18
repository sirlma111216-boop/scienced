import type { LessonTheory } from '../types'

/**
 * 7강 — 성취기준을 한 차시 수업으로 바꾸기
 *
 * 네 항목: 역방향 설계(Wiggins·McTighe) · 구성적 정렬(Biggs) · 행동적 목표 진술(Tyler·Mager) ·
 * 성공 기준과 형성평가(Sadler · Black·Wiliam). 카드 넷에 하나씩 붙는다.
 * ★ 전부 초안이다. 인명·연도를 원문과 대조한 뒤 verified 를 켠다. 원문 인용은 넣지 않았다.
 */
export const t07: LessonTheory = {
  summary:
    '이 차시가 「활동보다 증거를 먼저」라고 말하는 근거는 1990년대 말 미국의 Wiggins 와 McTighe 가 정리한 역방향 설계다. ' +
    '목표·활동·평가의 동사를 맞추라는 요구는 같은 시기 호주의 Biggs 가 대학 수업을 놓고 세운 구성적 정렬에서 왔다. ' +
    '목표를 「학생이 할 수 있게 되는 것」으로 적는 습관은 훨씬 오래된 것으로, Tyler 의 교육과정 원리와 Mager 의 행동적 목표 진술이 그 뿌리다. ' +
    '성공 기준을 학생의 말로 적는 것은 형성평가 연구 — Sadler 의 「기준을 학생이 알아야 스스로 고친다」와 Black·Wiliam 의 종합 — 가 교실에 남긴 처방이다.',
  entries: [
    {
      id: 't07-backward',
      termKo: '역방향 설계',
      termEn: 'backward design (Understanding by Design)',
      scholars: [
        { nameKo: '그랜트 위긴스', nameEn: 'Grant Wiggins' },
        { nameKo: '제이 맥타이', nameEn: 'Jay McTighe', year: '1998·2005' },
      ],
      claim:
        'Wiggins 와 McTighe 는 수업 설계의 순서를 뒤집었다 — ① 바라는 결과(학생이 이해하고 할 수 있어야 하는 것)를 정한다 ② 그것을 인정할 **증거**(수행 과제·평가)를 정한다 ③ 그다음에야 학습 경험과 활동을 짠다. ' +
        '이들이 이름 붙인 두 가지 실패가 **활동 중심 설계**(재미있지만 목표와 무관한 활동)와 **진도 중심 설계**(교과서를 처음부터 끝까지)다. 둘 다 증거를 먼저 정하지 않아서 생긴다.',
      bridgeToPlain:
        '이 카드의 「무엇」 둘째 문장 — 「활동을 고르기 전에 증거부터 정하는 순서」 — 가 이 틀이고, 오늘 활동에서 「걷을 산출물 하나」를 목표 다음에 정하게 한 것이 ②단계다. ' +
        '도입의 목표 세 문장이 활동 중심 설계의 목표 칸에서 나온 것이다.',
      limits:
        '역방향 설계는 「바라는 결과」를 잘 적을 수 있다는 것을 전제한다. 이해를 여섯 측면으로 쪼갠 틀이 복잡해 실제 학교에서는 양식 채우기가 되기 쉽다는 비판이 있다. ' +
        '또 증거를 먼저 정하면 평가하기 쉬운 것만 목표가 된다는 위험 — 측정 가능성이 목표를 결정하는 역전 — 을 저자들 자신도 경고했다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 7장',
      readings: [
        { title: 'Wiggins, G., & McTighe, J. (2005). Understanding by Design (expanded 2nd ed.). ASCD.' },
        { title: 'Wiggins, G., & McTighe, J. (1998). Understanding by Design. ASCD.' },
      ],
      linkedConceptId: 'c07-backward',
      plainTerms: ['활동을 고르기 전에 증거부터 정하는 순서'],
      oneLine: '목표 → 증거 → 활동. 증거를 먼저 정하지 않으면 활동 중심 설계나 진도 중심 설계가 된다.',
      verified: false,
    },
    {
      id: 't07-alignment',
      termKo: '구성적 정렬',
      termEn: 'constructive alignment',
      scholars: [{ nameKo: '존 빅스', nameEn: 'John Biggs', year: '1996' }],
      claim:
        'Biggs 는 수업의 목표(의도한 학습 성과)·교수·학습 활동·평가 과제가 **같은 동사**를 요구해야 한다고 했다. ' +
        '학생은 평가가 요구하는 것을 배우므로, 평가가 「기억한다」를 요구하면 목표에 「설명한다」가 적혀 있어도 학생은 외운다. ' +
        '「구성적」은 학습이 학생의 활동으로 구성된다는 뜻이고, 「정렬」은 그 활동과 평가를 목표의 동사에 맞추라는 뜻이다. 그는 이것을 SOLO 분류(학습 성과의 구조)와 함께 대학 수업 설계의 원리로 세웠다.',
      bridgeToPlain:
        '이 카드의 「무엇」 둘째 문장 — 「세 곳의 동사가 같으면 정렬된 것이다」 — 가 이 원리다. ' +
        '「교실에서」의 지도안(목표는 설명, 활동은 절차, 평가는 빈칸)이 Biggs 가 든 어긋남의 전형이다.',
      limits:
        '구성적 정렬은 대학 수업을 놓고 세워졌고, 학습 성과를 미리 동사로 적을 수 있다는 것을 전제한다. 열린 탐구처럼 성과를 미리 적기 어려운 수업에서는 정렬이 목표를 좁힐 수 있다. ' +
        '또 「평가가 학습을 끌고 간다」는 관찰이 「평가에 맞춰 가르치라」로 읽히면 시험 대비 수업을 정당화하는 데 쓰인다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 7장',
      readings: [
        { title: 'Biggs, J. (1996). Enhancing teaching through constructive alignment. Higher Education, 32(3), 347–364.' },
        { title: 'Biggs, J., & Tang, C. (2007). Teaching for Quality Learning at University (3rd ed.). Open University Press.' },
      ],
      linkedConceptId: 'c07-alignment',
      plainTerms: ['세 곳의 동사가 같으면 정렬된 것이다'],
      oneLine: '목표·활동·평가가 같은 동사를 요구해야 한다. 학생은 평가가 요구하는 것을 배운다.',
      verified: false,
    },
    {
      id: 't07-objectives',
      termKo: '행동적 목표 진술',
      termEn: 'behavioral objectives',
      scholars: [
        { nameKo: '랠프 타일러', nameEn: 'Ralph W. Tyler', year: '1949' },
        { nameKo: '로버트 메이거', nameEn: 'Robert F. Mager', year: '1962' },
      ],
      claim:
        'Tyler 는 교육과정의 첫 물음을 「학교가 이루려는 목표는 무엇인가」로 놓고, 목표를 **학생의 행동 변화**로 적어야 그 뒤의 경험 선택과 평가가 가능하다고 했다. ' +
        'Mager 는 이것을 수업 단위로 내려, 목표 문장에 관찰 가능한 수행·조건·기준 셋이 있어야 한다고 했다. 「안다」 「이해한다」는 관찰할 수 없으므로 「설명한다」 「구별한다」 「그린다」로 바꾸라는 것이다.',
      bridgeToPlain:
        '이 카드의 「무엇」 첫 문장 — 「수업이 끝났을 때 학생이 할 수 있게 되는 것」 — 이 Tyler 의 행동 변화이고, 학습목표에서 「이해한다」 「안다」 를 막는 규칙이 Mager 의 것이다. ' +
        '도입의 세 문장을 가르는 기준이 여기서 왔다.',
      limits:
        '행동적 목표는 잘게 쪼개면 사소한 수행의 목록이 되고, 관찰 가능한 것만 목표가 되어 태도와 이해가 밀려난다는 비판을 1970년대부터 받았다(Eisner 의 표현적 목표). ' +
        '이 차시는 목표를 잘게 쪼개라는 것이 아니라, 한 차시의 목표 한 문장에 학생의 동사 하나는 있어야 한다는 최소 요구로 쓴다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 7장',
      readings: [
        { title: 'Tyler, R. W. (1949). Basic Principles of Curriculum and Instruction. University of Chicago Press.' },
        { title: 'Mager, R. F. (1962). Preparing Instructional Objectives. Fearon.' },
      ],
      linkedConceptId: 'c07-objective',
      plainTerms: ['수업이 끝났을 때 학생이 할 수 있게 되는 것'],
      oneLine: '목표는 학생의 행동 변화로 적는다. 「안다」는 관찰할 수 없으므로 목표가 아니다.',
      verified: false,
    },
    {
      id: 't07-success',
      termKo: '성공 기준과 형성평가',
      termEn: 'success criteria / formative assessment',
      scholars: [
        { nameKo: '로이스 새들러', nameEn: 'D. Royce Sadler', year: '1989' },
        { nameKo: '폴 블랙', nameEn: 'Paul Black' },
        { nameKo: '딜런 윌리엄', nameEn: 'Dylan Wiliam', year: '1998' },
      ],
      claim:
        'Sadler 는 형성평가가 작동하려면 학생 쪽에 세 가지가 있어야 한다고 했다 — 목표로 하는 수행의 **기준**을 알고, 자기 수행을 그 기준에 비추어 볼 수 있고, 둘 사이의 간격을 줄일 방법을 알아야 한다. 기준이 교사에게만 있으면 학생은 피드백을 받아도 무엇을 고칠지 모른다. ' +
        'Black 과 Wiliam 은 1998년 250여 편의 연구를 종합해 형성평가가 학습을 크게 올린다는 것을 보였고, 그 조건으로 기준의 공유와 자기평가·동료평가를 들었다.',
      bridgeToPlain:
        '이 카드의 「무엇」 첫 문장 — 「다 했는지 스스로 판단할 수 있게 적은 기준」 — 이 Sadler 의 첫째 조건이다. ' +
        '「교실에서」의 학생이 둘째 줄을 다시 읽고 짝의 그림에 말을 보태는 장면이 자기평가와 동료평가가 돌아가는 모습이다.',
      limits:
        '성공 기준을 학생의 말로 적으면 기준이 체크리스트가 되어 수행이 항목 채우기로 좁아질 수 있다. Sadler 자신이 기준은 예시와 함께 있어야 뜻이 전해진다고 했다. ' +
        '또 Black 과 Wiliam 이 보고한 효과 크기는 뒤에 여러 번 다시 계산되어 처음 보고보다 작게 잡힌다.',
      textbookRef: '『과학 교육론과 지도법』 제2판 7장',
      readings: [
        { title: 'Sadler, D. R. (1989). Formative assessment and the design of instructional systems. Instructional Science, 18(2), 119–144.' },
        { title: 'Black, P., & Wiliam, D. (1998). Assessment and classroom learning. Assessment in Education: Principles, Policy & Practice, 5(1), 7–74.' },
      ],
      linkedConceptId: 'c07-success',
      plainTerms: ['다 했는지 스스로 판단할 수 있게 적은 기준'],
      oneLine: '기준을 학생이 알아야 자기 수행과 견주어 고친다. 기준이 교사에게만 있으면 피드백은 소용없다.',
      verified: false,
    },
  ],
}
