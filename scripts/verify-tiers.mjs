/**
 * npm run verify:tiers
 *
 * 50분 판이 성립하는지 본다 (3차 F.7).
 *
 * 이 검사가 지키는 것은 하나다 — **50분 반 학생이 손해를 보지 않는 것.**
 * 흐름에서 뺀 블록은 「수업 후 이어서」로 내려갈 뿐 사라지지 않고,
 * 수업 안에서 반드시 일어나야 하는 네 가지는 두 판 모두에 남는다.
 *   개인 응답 제출 · 핵심 개념 카드 2장 이상 · 발표자 뽑기 · 의견 광장 1회 이상
 *
 * 태그를 빠뜨린 블록은 core 로 본다. 빠뜨린 쪽이 드러나야지,
 * 학생이 못 본 채 지나가면 안 된다.
 */
import { fail, pass, report } from './_report.mjs'
import { LESSONS } from '../src/content/lessons/index.ts'
import { buildLessonView } from '../src/lib/tiers.ts'

const tierOf = (x) => x?.tier ?? 'core'

/* ── ① 태그가 두 값 중 하나인가 ── */
{
  let bad = 0
  let untagged = 0
  for (const l of LESSONS) {
    const check = (t, where) => {
      if (t === undefined) return untagged++
      if (t !== 'core' && t !== 'extended') {
        fail('태그 값', `${l.id}강 ${where} 의 tier 가 「${t}」다`)
        bad++
      }
    }
    for (const s of l.steps) {
      check(s.tier, s.id)
      for (const f of s.fields) check(f.tier, `${s.id}/${f.key}`)
      for (const m of s.material ?? []) check(m.tier, `${s.id}/자료`)
    }
    for (const c of l.keyConcepts) check(c.tier, c.id)
  }
  if (bad === 0) {
    pass('태그 값', `tier 는 core/extended 뿐이다 (태그 없는 ${untagged}곳은 core 로 본다)`)
  }
}

/* ── ② 50분 판에 빈 차시가 없는가 ── */
{
  let empty = 0
  for (const l of LESSONS) {
    const view = buildLessonView(l, 'short')
    if (view.steps.length === 0) {
      fail('빈 차시', `${l.id}강은 50분 판에서 단계가 하나도 남지 않는다`)
      empty++
    }
  }
  if (empty === 0) pass('빈 차시', '50분 판에서도 모든 차시에 단계가 남는다')
}

/* ── ②-b 1시간 판은 아무것도 내려보내지 않는다 ── */
{
  /*
   * 1시간 판은 모든 블록을 수업 안에서 한다. 「수업 후 이어서」가 뜨면 안 된다.
   * 실제로 그런 버그가 있었다 — 단계에 붙은 extended 태그를 판과 무관하게 적용해서,
   * 1시간 반 학생도 「이번 수업 정리」를 수업 밖에서 하게 되어 있었다.
   * 브라우저로 열어 보고서야 드러났다. 그래서 여기에 못을 박는다.
   */
  const leaking = LESSONS.filter((l) => buildLessonView(l, 'full').hasDeferred)
  if (leaking.length > 0) {
    fail(
      '1시간 판',
      `${leaking.map((l) => l.id + '강').join(' · ')} 이 1시간 판에서도 블록을 「수업 후 이어서」로 내린다`,
    )
  } else {
    pass('1시간 판', '1시간 판은 모든 블록이 수업 안에 있다 — 내려보내는 것이 없다')
  }
}

/* ── ③ 절감이 없는 차시는 경고한다 ── */
{
  const noSaving = LESSONS.filter((l) => {
    const view = buildLessonView(l, 'short')
    return !view.hasDeferred
  })
  if (noSaving.length > 0) {
    fail(
      '절감 없음',
      `${noSaving.map((l) => l.id + '강').join(' · ')} 은 50분 판에서 빠지는 것이 없다 — 40분 안에 못 끝낸다`,
    )
  } else {
    pass('절감', '18개 차시 모두 50분 판에서 빠지는 블록이 있다')
  }
}

/* ── ④ 50분 판에서도 남아야 하는 네 가지 ── */
{
  let broken = 0
  for (const l of LESSONS) {
    const view = buildLessonView(l, 'short')

    // 개인 응답 제출 — 이것이 없으면 의견 광장도 분포도 성립하지 않는다
    const inputs = view.steps.reduce((n, s) => n + s.fields.length, 0)
    if (inputs === 0) {
      fail('개인 응답', `${l.id}강 50분 판에 입력 칸이 하나도 없다`)
      broken++
    }

    // 그 차시 판단에 꼭 필요한 핵심 개념 카드 (최소 2장)
    const concepts = view.steps.reduce((n, s) => n + s.concepts.length, 0)
    if (concepts < 2) {
      fail('개념 카드', `${l.id}강 50분 판에 개념 카드가 ${concepts}장뿐이다 (2장 이상)`)
      broken++
    }

    // 발표자 뽑기 — 짧고, 참여를 여는 장치다
    if (!view.steps.some((s) => s.step.picker?.enabled)) {
      fail('발표자 뽑기', `${l.id}강 50분 판에 발표자 뽑기가 없다`)
      broken++
    }

    // 의견 광장 최소 1회
    if (!view.steps.some((s) => s.step.wall?.enabled)) {
      fail('의견 광장', `${l.id}강 50분 판에 의견 광장이 없다`)
      broken++
    }
  }
  if (broken === 0) {
    pass('절대 빼지 않는 것', '18개 차시 모두 50분 판에 개인 응답·개념 2장·발표자 뽑기·의견 광장이 남는다')
  }
}

/* ── ⑤ 뺀 것이 사라지지 않는가 ── */
{
  let lost = 0
  for (const l of LESSONS) {
    const full = buildLessonView(l, 'full')
    const short = buildLessonView(l, 'short')

    const count = (v) =>
      [...v.steps, ...v.deferredSteps].reduce(
        (n, s) =>
          n +
          s.fields.length +
          s.deferredFields.length +
          s.concepts.length +
          s.deferredConcepts.length,
        0,
      )

    if (count(full) !== count(short)) {
      fail(
        '이동이지 삭제가 아니다',
        `${l.id}강의 블록 수가 판마다 다르다 (1시간 ${count(full)} · 50분 ${count(short)})`,
      )
      lost++
    }
  }
  if (lost === 0) {
    pass('이동이지 삭제가 아니다', '두 판의 블록 총수가 같다 — 뺀 것은 「수업 후 이어서」에 그대로 있다')
  }
}

/* ── ⑥ 시간 합계 표 (개발자 확인용, 화면에 나가지 않는다) ── */
{
  /*
   * 단계에 붙은 durationMinutes 는 그 단계 전체의 시간이다.
   * 칸 하나를 빼도 그 숫자는 그대로라, 단계만 세면 칸 단위 절감이 통째로 사라진다.
   * 그래서 남은 블록의 비율로 환산한다 — 정확한 초시계가 아니라 눈금이다.
   * 화면에는 나가지 않는다. 강의자가 판을 가늠할 때만 쓴다.
   */
  const estimate = (view) =>
    view.steps.reduce((n, s) => {
      const kept = s.fields.length + s.material.length + s.concepts.length
      const gone = s.deferredFields.length + s.deferredMaterial.length + s.deferredConcepts.length
      if (kept + gone === 0) return n + s.step.durationMinutes
      return n + Math.round((s.step.durationMinutes * kept) / (kept + gone))
    }, 0)

  const rows = LESSONS.map((l) => {
    const short = buildLessonView(l, 'short')
    const fullMin = l.steps.reduce((n, s) => n + s.durationMinutes, 0)
    const shortMin = estimate(short)
    return { id: l.id, fullMin, shortMin, cut: fullMin - shortMin, steps: short.steps.length }
  })

  console.log('\n  차시   1시간 판   50분 판   절감   50분 판 단계 수')
  console.log('  ' + '─'.repeat(48))
  for (const r of rows) {
    console.log(
      `  ${r.id}강      ${String(r.fullMin).padStart(3)}       ${String(r.shortMin).padStart(3)}     ${String(r.cut).padStart(3)}        ${r.steps}`,
    )
  }
  const avgCut = Math.round(rows.reduce((n, r) => n + r.cut, 0) / rows.length)
  console.log('  ' + '─'.repeat(48))
  console.log(`  평균 절감 ${avgCut} — F.1 이 목표한 약 10분에 대한 눈금\n`)

  // F.1 이 목표한 것은 차시마다 약 10분어치를 빼는 것이다.
  const tooLong = rows.filter((r) => r.shortMin > 42)
  if (tooLong.length > 0) {
    fail(
      '50분 판 길이',
      `${tooLong.map((r) => `${r.id}강(${r.shortMin})`).join(' · ')} — 전환 시간을 빼면 쓸 수 있는 것은 40분 남짓이다`,
    )
  } else {
    pass('50분 판 길이', '모든 차시가 42 이하로 줄었다 — 전환 시간을 빼고 40분 남짓에 든다')
  }
}

report('verify:tiers')
