/**
 * 사다리 순수 계산.
 *
 * 이 파일에는 React도 Firestore도 Math.random()도 없다.
 * 씨앗 문자열 하나만 같으면 강사 화면과 모든 학생 화면이 글자 그대로 같은 사다리를 그린다.
 * 그래야 서버가 결과를 내려보내지 않아도 30명이 동시에 같은 그림을 본다.
 *
 * 해시: FNV-1a (32bit) → 난수: mulberry32
 * 검증: scripts/verify-ladder.mjs (전단사 · 가로줄 인접 금지 · 발표자 수 · 씨앗 재현성 · 좌우 이동률)
 */

/** FNV-1a 32비트 해시. 문자열 씨앗을 난수 시드 정수로 바꾼다. */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    // h *= 16777619 을 32비트 오버플로 없이
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h >>> 0
}

/** mulberry32 — 시드 하나로 재현 가능한 [0,1) 난수열. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Ladder {
  /** 세로줄 개수 = 자리 개수 = 그 자리에 선 수강생 수 */
  columns: number
  /** 가로줄을 놓을 수 있는 층 수 */
  rows: number
  /**
   * rungs[row][col] === true 이면 row 층에서 col 번 세로줄과 col+1 번 세로줄이 이어져 있다.
   * 길이는 rows × (columns - 1).
   * 같은 층에서 이웃한 두 칸이 동시에 true 가 되지 않는다(그러면 어디로 갈지 정해지지 않는다).
   */
  rungs: boolean[][]
  /** mapping[시작칸] = 도착칸. 전단사(모든 칸이 서로 다른 한 칸에 대응)이다. */
  mapping: number[]
  /** 이 사다리를 만든 씨앗. 화면에 그대로 표시해 재현성을 보인다. */
  seed: string
}

/** 층 수는 자리 수에 따라 정한다. 너무 적으면 좌우로 못 움직이고, 너무 많으면 화면에 안 들어간다. */
export function rowsFor(columns: number): number {
  return Math.min(24, Math.max(8, columns * 2))
}

const DENSITY = 0.42
/** 자리 중 이 비율 이상은 시작 칸과 다른 칸에 도착해야 한다. 안 그러면 추첨이 싱겁다. */
export const MIN_DISPLACEMENT_RATIO = 0.7

function emptyRungs(rows: number, columns: number): boolean[][] {
  return Array.from({ length: rows }, () => new Array(Math.max(0, columns - 1)).fill(false))
}

/** 가로줄을 따라 내려간 도착 칸을 계산한다. */
function computeMapping(rungs: boolean[][], columns: number): number[] {
  const map: number[] = []
  for (let start = 0; start < columns; start++) {
    let c = start
    for (let r = 0; r < rungs.length; r++) {
      if (c > 0 && rungs[r][c - 1]) c -= 1
      else if (c < columns - 1 && rungs[r][c]) c += 1
    }
    map.push(c)
  }
  return map
}

function displacementRatio(mapping: number[]): number {
  if (mapping.length === 0) return 1
  const moved = mapping.filter((end, start) => end !== start).length
  return moved / mapping.length
}

/** 같은 층에서 이웃 칸이 이미 차 있으면 놓을 수 없다. */
function canPlace(rungs: boolean[][], row: number, col: number): boolean {
  const line = rungs[row]
  if (col < 0 || col >= line.length) return false
  if (line[col]) return false
  if (col > 0 && line[col - 1]) return false
  if (col + 1 < line.length && line[col + 1]) return false
  return true
}

/**
 * 씨앗 문자열에서 사다리를 만든다. 같은 씨앗 → 언제 어디서 불러도 같은 결과.
 *
 * @param seed 서버가 만든 씨앗 문자열. 클라이언트가 난수를 만들지 않는다.
 * @param columns 자리 개수(수강생 수)
 */
export function buildLadder(seed: string, columns: number): Ladder {
  const cols = Math.max(1, Math.floor(columns))
  let rows = rowsFor(cols)
  const rungs = emptyRungs(rows, cols)

  if (cols < 2) {
    return { columns: cols, rows, rungs, mapping: cols === 1 ? [0] : [], seed }
  }

  const rand = mulberry32(fnv1a(seed))

  // 1차: 층마다 왼쪽부터 훑으며 확률로 가로줄을 놓는다.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      if (rand() < DENSITY && canPlace(rungs, r, c)) rungs[r][c] = true
    }
  }

  // 2차: 좌우 이동률이 기준에 못 미치면 보강한다.
  //
  // 아무 데나 가로줄을 더 놓는 방식은 통하지 않는다. 격자가 차면 놓을 자리가 없어
  // 루프만 돌다 끝난다. 그래서 '제자리에 도착한 칸'을 직접 겨냥해 그 칸에 닿는
  // 가로줄을 놓고, 층이 포화되면 층을 하나 늘린다.
  // 난수열을 이어 쓰므로 결과는 여전히 씨앗 하나로 결정된다.
  let mapping = computeMapping(rungs, cols)
  let guard = 0
  while (displacementRatio(mapping) < MIN_DISPLACEMENT_RATIO && guard < 600) {
    guard++
    const stuck = mapping.reduce<number[]>((acc, end, start) => {
      if (end === start) acc.push(start)
      return acc
    }, [])
    if (stuck.length === 0) break

    const target = stuck[Math.floor(rand() * stuck.length)]
    // target 칸에 닿는 가로줄은 왼쪽(target-1) 또는 오른쪽(target) 자리에 놓는다.
    const sides = rand() < 0.5 ? [target - 1, target] : [target, target - 1]
    const startRow = Math.floor(rand() * rows)
    let placed = false
    for (let k = 0; k < rows && !placed; k++) {
      const r = (startRow + k) % rows
      for (const c of sides) {
        if (canPlace(rungs, r, c)) {
          rungs[r][c] = true
          placed = true
          break
        }
      }
    }
    if (!placed) {
      if (rows >= 48) break // 화면에 들어가지 않는다. 여기서 멈춘다.
      rungs.push(new Array(cols - 1).fill(false))
      rows += 1
    }
    mapping = computeMapping(rungs, cols)
  }

  return { columns: cols, rows, rungs, mapping, seed }
}

/** 한 칸에서 출발해 내려가는 경로. 화면에 선을 그릴 때 쓴다. */
export function traceLadder(ladder: Ladder, startCol: number): Array<{ row: number; col: number }> {
  const path: Array<{ row: number; col: number }> = []
  let c = Math.min(Math.max(0, startCol), ladder.columns - 1)
  path.push({ row: -1, col: c })
  for (let r = 0; r < ladder.rows; r++) {
    if (c > 0 && ladder.rungs[r][c - 1]) c -= 1
    else if (c < ladder.columns - 1 && ladder.rungs[r][c]) c += 1
    path.push({ row: r, col: c })
  }
  return path
}

/**
 * 사다리 아래쪽 어느 칸에 「발표!」를 붙일지 정한다.
 *
 * 발표자 수는 기존 구현 그대로 기본 2명이다. 인원이 그 이하면 전원.
 * 씨앗에 다른 소금을 섞어 사다리 모양과 독립적으로 정한다.
 */
export function pickPresentSlots(seed: string, columns: number, count = 2): number[] {
  const cols = Math.max(0, Math.floor(columns))
  if (cols === 0) return []
  if (cols <= count) return Array.from({ length: cols }, (_, i) => i)

  const rand = mulberry32(fnv1a(`${seed}::present`))
  const pool = Array.from({ length: cols }, (_, i) => i)
  // Fisher–Yates. 앞에서 count 개만 쓰면 된다.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count).sort((a, b) => a - b)
}

/**
 * 자리 → 발표자 여부. 학생이 고른 자리가 발표 칸으로 도착했는지 판정한다.
 * @returns 발표하게 된 시작 칸 번호들
 */
export function winnersFromLadder(ladder: Ladder, presentSlots: number[]): number[] {
  const targets = new Set(presentSlots)
  const winners: number[] = []
  ladder.mapping.forEach((end, start) => {
    if (targets.has(end)) winners.push(start)
  })
  return winners
}

/**
 * 비상 추첨 — 사다리를 그릴 수 없을 때(자리 수가 부족하거나 화면이 깨졌을 때) 쓰는 대안.
 * 사다리 없이 씨앗만으로 당첨자를 뽑는다. 결과는 여전히 재현 가능하다.
 */
export function emergencyDraw(seed: string, candidates: string[], count = 2): string[] {
  if (candidates.length <= count) return [...candidates]
  const rand = mulberry32(fnv1a(`${seed}::emergency`))
  const pool = [...candidates]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

/**
 * 발표 횟수가 적은 사람에게 확률을 더 주는 가중 추첨.
 * 14강은 이 가중치를 화면에 그대로 공개한다(그날의 학습 내용이 참여 형평성이므로).
 *
 * @param weights uid → 가중치(클수록 잘 뽑힌다). 0 이하는 후보에서 빠진다.
 */
export function weightedDraw(
  seed: string,
  weights: Record<string, number>,
  count = 2,
): string[] {
  const entries = Object.entries(weights).filter(([, w]) => w > 0)
  if (entries.length <= count) return entries.map(([uid]) => uid)

  const rand = mulberry32(fnv1a(`${seed}::weighted`))
  const chosen: string[] = []
  const pool = [...entries]
  for (let k = 0; k < count && pool.length > 0; k++) {
    const total = pool.reduce((s, [, w]) => s + w, 0)
    let t = rand() * total
    let idx = pool.length - 1
    for (let i = 0; i < pool.length; i++) {
      t -= pool[i][1]
      if (t <= 0) {
        idx = i
        break
      }
    }
    chosen.push(pool[idx][0])
    pool.splice(idx, 1)
  }
  return chosen
}

/** 발표 횟수 → 가중치. 적게 발표한 사람일수록 커진다. */
export function weightFromPresentCount(presentCount: number): number {
  return 1 / (1 + Math.max(0, presentCount))
}
