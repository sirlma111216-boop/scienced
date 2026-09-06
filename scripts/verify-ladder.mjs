/**
 * npm run verify:ladder
 *
 * 사다리 검증 5종. 배포 전에 전부 통과해야 한다.
 *   1. 전단사          — 모든 시작 칸이 서로 다른 도착 칸에 대응하는가
 *   2. 가로줄 인접 금지 — 같은 층에서 이웃한 두 칸이 동시에 이어져 있지 않은가
 *   3. 발표자 수       — 기본 2명, 인원이 2명 이하면 전원
 *   4. 씨앗 재현성     — 같은 씨앗이면 몇 번을 만들어도 글자 그대로 같은가
 *   5. 좌우 이동률     — 자리의 70% 이상이 시작과 다른 칸에 도착하는가
 */
import { fail, pass, report } from './_report.mjs'

const {
  buildLadder,
  pickPresentSlots,
  winnersFromLadder,
  emergencyDraw,
  weightedDraw,
  weightFromPresentCount,
  MIN_DISPLACEMENT_RATIO,
} = await import('../src/lib/ladder.ts')

const SIZES = [1, 2, 3, 4, 5, 6, 8, 12, 16, 20, 24, 28, 30, 36, 40]
const SEEDS = [
  '01-auction::r1::1730000000',
  '01-auction::r2::1730000000',
  '05-survival::r1::1731111111',
  '14-silent-data::r3::1732222222',
  '가나다라::seed::한글도::된다',
]

// 1. 전단사
for (const seed of SEEDS) {
  for (const n of SIZES) {
    const l = buildLadder(seed, n)
    const seen = new Set(l.mapping)
    if (seen.size !== n) {
      fail('전단사', `자리 ${n}개, 씨앗 ${seed} → 도착 칸이 ${seen.size}종류밖에 없다`)
    }
    if (l.mapping.some((v) => v < 0 || v >= n)) {
      fail('전단사', `자리 ${n}개에서 범위를 벗어난 도착 칸이 있다`)
    }
  }
}
pass('전단사', `${SEEDS.length}개 씨앗 × ${SIZES.length}개 인원에서 모든 칸이 1:1로 대응`)

// 2. 가로줄 인접 금지
for (const seed of SEEDS) {
  for (const n of SIZES) {
    const l = buildLadder(seed, n)
    l.rungs.forEach((line, r) => {
      for (let c = 0; c + 1 < line.length; c++) {
        if (line[c] && line[c + 1]) {
          fail('가로줄 인접 금지', `자리 ${n}개 ${r}층 ${c}·${c + 1}칸이 동시에 이어져 있다`)
        }
      }
    })
  }
}
pass('가로줄 인접 금지', '같은 층에서 이웃한 가로줄이 겹치지 않는다')

// 3. 발표자 수
for (const seed of SEEDS) {
  for (const n of SIZES) {
    const slots = pickPresentSlots(seed, n, 2)
    const expected = n <= 2 ? n : 2
    if (slots.length !== expected) {
      fail('발표자 수', `자리 ${n}개 → 발표 칸이 ${slots.length}개 (기대 ${expected}개)`)
    }
    if (new Set(slots).size !== slots.length) {
      fail('발표자 수', `자리 ${n}개 → 같은 칸이 두 번 뽑혔다`)
    }
    const l = buildLadder(seed, n)
    const winners = winnersFromLadder(l, slots)
    if (winners.length !== expected) {
      fail('발표자 수', `자리 ${n}개 → 사다리를 타고 도착한 발표자가 ${winners.length}명`)
    }
  }
}
pass('발표자 수', '기본 2명, 인원 2명 이하면 전원')

// 4. 씨앗 재현성
for (const seed of SEEDS) {
  for (const n of SIZES) {
    const a = JSON.stringify(buildLadder(seed, n))
    const b = JSON.stringify(buildLadder(seed, n))
    if (a !== b) fail('씨앗 재현성', `씨앗 ${seed}, 자리 ${n}개 → 두 번 만든 결과가 다르다`)
    const p1 = pickPresentSlots(seed, n).join(',')
    const p2 = pickPresentSlots(seed, n).join(',')
    if (p1 !== p2) fail('씨앗 재현성', `씨앗 ${seed} → 발표 칸이 매번 달라진다`)
  }
}
// 다른 씨앗은 실제로 다른 결과를 내야 한다(상수를 반환하고 있지 않은지)
{
  const a = JSON.stringify(buildLadder(SEEDS[0], 20).rungs)
  const b = JSON.stringify(buildLadder(SEEDS[1], 20).rungs)
  if (a === b) fail('씨앗 재현성', '서로 다른 씨앗이 같은 사다리를 만든다')
}
pass('씨앗 재현성', '같은 씨앗은 항상 같은 사다리, 다른 씨앗은 다른 사다리')

// 5. 좌우 이동률
for (const seed of SEEDS) {
  for (const n of SIZES) {
    if (n < 2) continue
    const l = buildLadder(seed, n)
    const moved = l.mapping.filter((end, start) => end !== start).length
    const ratio = moved / n
    if (ratio < MIN_DISPLACEMENT_RATIO) {
      fail(
        '좌우 이동률',
        `자리 ${n}개, 씨앗 ${seed} → ${(ratio * 100).toFixed(0)}%만 자리를 옮겼다 (기준 ${MIN_DISPLACEMENT_RATIO * 100}%)`,
      )
    }
  }
}
pass('좌우 이동률', `모든 조합에서 ${MIN_DISPLACEMENT_RATIO * 100}% 이상이 다른 칸에 도착`)

// 보너스: 비상 추첨과 가중 추첨도 재현 가능한가
{
  const cands = Array.from({ length: 12 }, (_, i) => `u${i}`)
  const a = emergencyDraw('seed-x', cands, 2).join(',')
  const b = emergencyDraw('seed-x', cands, 2).join(',')
  if (a !== b) fail('비상 추첨', '같은 씨앗인데 결과가 다르다')
  if (emergencyDraw('seed-x', ['u1'], 2).length !== 1) {
    fail('비상 추첨', '후보가 뽑을 인원보다 적으면 전원이어야 한다')
  }

  const weights = Object.fromEntries(cands.map((u, i) => [u, weightFromPresentCount(i)]))
  const w1 = weightedDraw('seed-y', weights, 2).join(',')
  const w2 = weightedDraw('seed-y', weights, 2).join(',')
  if (w1 !== w2) fail('가중 추첨', '같은 씨앗인데 결과가 다르다')
  if (weightFromPresentCount(0) <= weightFromPresentCount(3)) {
    fail('가중 추첨', '발표를 적게 한 사람의 가중치가 더 커야 한다')
  }
  // 실제로 적게 발표한 사람이 더 자주 뽑히는지 (200회 표본)
  let fewCount = 0
  for (let i = 0; i < 200; i++) {
    const picked = weightedDraw(`seed-${i}`, weights, 1)
    if (picked[0] === 'u0' || picked[0] === 'u1' || picked[0] === 'u2') fewCount++
  }
  if (fewCount < 60) {
    fail('가중 추첨', `발표 0~2회인 3명이 200회 중 ${fewCount}회만 뽑혔다 (기대 60회 이상)`)
  }
  pass('비상·가중 추첨', '씨앗 재현성 유지, 발표 적은 사람의 확률이 실제로 높다')
}

report('verify:ladder')
