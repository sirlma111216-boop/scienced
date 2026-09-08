/**
 * npm run audit:lesson -- 03 04
 *
 * 한 차시가 「1·2강 기준」에 맞춰졌는지 항목별로 센다.
 *
 * ── 왜 이 도구가 있나 ──
 * 1·2강은 실제 수업에 쓰면서 강의자의 지시로 열두 가지쯤을 고쳤다.
 * 그것을 3~18강에 옮길 때 매번 「무엇을 고쳐야 하더라」를 다시 물으면
 * 빠뜨리는 항목이 생긴다. 실제로 자료·개념 카드·지금 할 일이 한꺼번에 빠져 있다.
 *
 * 그래서 기준을 글이 아니라 코드로 둔다.
 *   docs/강의-일괄-수정-기준.md  — 무엇을 왜 그렇게 하는가 (사람이 읽는다)
 *   이 스크립트                  — 그것이 됐는지 센다 (기계가 읽는다)
 * 둘이 어긋나면 이 스크립트가 맞다. 문서를 고친다.
 *
 * 검사가 아니라 점검표다. 인수를 주면 그 차시에 빈 항목이 있을 때 1로 끝난다 —
 * 「3강 다 했나?」를 이걸로 묻는다.
 */
import { existsSync } from 'node:fs'

const { LESSONS } = await import('../src/content/lessons/index.ts')
const { parseBody } = await import('../src/lib/body-text.ts')

/* 자료가 화면에 없는 것을 가리키는 말 (4차 G.2 기준 ②) */
const 가리키는_말 = ['이 기사가', '이 자료에서', '위 그림의', '아래 표를 보고', '이 학생의 답안',
  '방금 본', '이 대본', '이 보고서', '아래 기사', '아래 학생 보고서', '이 도식', '이 사진',
  '아래 발자국', '아래 자료', '위 자료', '이 계획서', '이 응답']
/* 순서가 있는 활동을 가리키는 말 (기준 ③) */
const 순서_말 = ['토론 뒤', '새 증거 뒤', '제출 후', '증거를 보고', '공개 후', '듣고 나서']
/* 더 쓰지 않기로 한 말 */
const 묵은_말 = ['확신도', '인쇄 활동지', '퇴실표', '봉인된 증거']
/**
 * 풀어 주지 않아도 되는 줄임말. 이유와 함께 적는다.
 *
 * 대문자 두 자 이상을 모두 줄임말로 보기 때문에 로마 숫자 같은 것이 걸린다.
 * 그때 할 일은 둘 중 하나다 — 집 문법(`**XXX** —`)으로 풀어 주거나, 이유를 달고 여기 넣거나.
 */
const 설명_면제 = {
  AI: '이 강의의 학생에게 설명이 필요 없는 말',
  OECD: '풀이 문장 안에서 쓰인다',
  TV: '일상어',
  DNA: '중등 과학에서 이미 쓰는 말',
  CO: '화학식',
  PPT: '일상어',
  II: '줄임말이 아니라 로마 숫자다 — 「대기시간 II」는 본문이 이미 설명하고 있다',
}

/** 학생이 화면에서 읽는 글만 모은다. 강사 대본은 뺀다 — 학생이 보지 않는다. */
function 학생글(lesson) {
  const p = [lesson.title, lesson.centralQuestion, lesson.studentVoice, lesson.firstSentence,
    lesson.guide, lesson.fieldCase, lesson.flowSummary, ...lesson.objectives]
  for (const c of lesson.keyConcepts) {
    p.push(c.term, c.plainOneLiner, c.whyItMatters, c.classroomScene, c.formalDefinition,
      c.applyQuestion, ...(c.notToConfuseWith ?? []), ...(c.mustKnow ?? []), c.check.prompt,
      ...c.check.options)
    for (const d of c.deepDive ?? []) p.push(d.title, d.body)
  }
  for (const s of lesson.steps) {
    p.push(s.title, s.lead, s.doNow ?? '')
    for (const f of s.fields) {
      p.push(f.label, f.help ?? '', f.placeholder ?? '', ...(f.options ?? []),
        ...(f.sentenceStarters ?? []))
      for (const i of f.items ?? []) p.push(i.label, i.note ?? '')
      for (const q of f.quadrants ?? []) p.push(q.label, q.hint ?? '')
    }
    for (const m of s.material ?? []) p.push(m.title, m.body, m.label ?? '')
    if (s.wall?.enabled) p.push(s.wall.prompt)
  }
  return p.filter(Boolean).join('\n')
}

/**
 * 자료가 없어도 되는 단계.
 *
 * 밖에서 온 자료를 놓고 판단하는 활동이 아니라, 학생 자신의 경험이나 판단을
 * 꺼내는 활동이면 자료가 없는 것이 맞다. 그런 자리에 읽을거리를 밀어 넣으면
 * 「네 생각을 적어라」가 「이 글을 요약해라」로 바뀐다.
 *
 * 면제는 반드시 이유와 함께 여기 적는다. 조용히 넘어가는 자리를 만들지 않는다.
 */
const 자료_면제 = {
  '01': {
    'step-recall': '학생이 겪은 좋은 수업을 스스로 꺼내는 자리 — 밖의 자료가 있으면 안 된다',
    'step-auction': '여덟 장의 배분 카드가 곧 자료다',
    'step-wrapup': '오늘 자기 판단을 정리하는 자리',
  },
}

/** 이 단계에 자료가 있어야 하는가. 개념 카드 단계는 카드가 자료다. */
function 자료가_필요한_단계(lesson, s) {
  if (s.type === 'concepts' || s.fields.length === 0) return false
  return !자료_면제[lesson.id]?.[s.id]
}

/* ── 항목 ──
 * 각 항목은 빈 곳을 문자열 목록으로 돌려준다. 빈 배열이면 됐다는 뜻이다.
 * id 는 docs/강의-일괄-수정-기준.md 의 번호와 같다. 둘을 같이 고친다.
 */
const 항목 = [
  {
    id: 'A1', name: '자료 실물', doc: '단계마다 학생이 붙들 자료가 있다',
    run(l) {
      const out = []
      for (const s of l.steps) {
        const m = s.material ?? []
        const 실물 = m.filter((x) => x.format !== 'note')
        if (자료가_필요한_단계(l, s) && 실물.length === 0) {
          out.push(`${s.id} 에 실물 자료가 없다${m.length ? ' (note 뿐)' : ''}`)
        }
      }
      return out
    },
  },
  {
    id: 'A2', name: '자료 꼬리표', doc: '가상 자료에 「수업용으로 만든 가상 자료」가 붙는다',
    run(l) {
      const out = []
      for (const s of l.steps) {
        for (const m of s.material ?? []) {
          if (m.format === 'note' || m.format === 'standard') continue
          if (!m.label && !m.source) out.push(`${s.id} 「${m.title}」 에 라벨도 출처도 없다`)
        }
      }
      return out
    },
  },
  {
    id: 'A3', name: '줄머리 구분', doc: '대본·학생 산출물의 화자와 절 이름이 본문과 갈린다',
    run(l) {
      const out = []
      for (const s of l.steps) {
        for (const m of s.material ?? []) {
          if (m.format !== 'dialogue' && m.format !== 'studentWork') continue
          const lines = parseBody(m.body)
          if (!lines.some((x) => x.kind === 'labelled')) {
            out.push(`${s.id} 「${m.title}」 에 줄머리 꼬리표가 없다`)
          }
          const 맨줄 = lines.filter((x) => x.kind === 'plain')
          if (맨줄.length > 0) {
            out.push(`${s.id} 「${m.title}」 에 꼬리표도 들여쓰기도 없는 줄 ${맨줄.length}개`)
          }
        }
      }
      return out
    },
  },
  {
    id: 'A4', name: '자료 연결', doc: '「이 기사가」라고 하면 requiresStimulus 로 못 박는다',
    run(l) {
      const out = []
      for (const s of l.steps) {
        const ids = new Set((s.material ?? []).map((m) => m.id))
        for (const f of s.fields) {
          const t = `${f.label}\n${f.help ?? ''}`
          const hit = 가리키는_말.filter((k) => t.includes(k))
          if (hit.length > 0 && !(f.requiresStimulus?.length > 0)) {
            out.push(`${s.id} 「${f.label}」 이 「${hit[0]}」 라는데 가리킬 자료가 안 적혀 있다`)
          }
          for (const need of f.requiresStimulus ?? []) {
            if (!ids.has(need)) out.push(`${s.id} 「${f.label}」 이 없는 자료 「${need}」 를 가리킨다`)
          }
        }
      }
      return out
    },
  },
  {
    id: 'B1', name: '지금 할 일', doc: '단계마다 지금 손으로 할 행동 한 문장',
    run(l) {
      const out = []
      for (const s of l.steps) {
        const 필요 = s.fields.length > 0 || (s.conceptIds?.length ?? 0) > 0
        if (필요 && !s.doNow) { out.push(`${s.id} 에 doNow 가 없다`); continue }
        if (!s.doNow) continue
        if (s.doNow.includes('\n')) out.push(`${s.id} 의 doNow 가 두 줄이다`)
        if (s.doNow.trim().endsWith('?')) out.push(`${s.id} 의 doNow 가 물음표로 끝난다`)
      }
      return out
    },
  },
  {
    id: 'B2', name: '여는 조건', doc: '순서가 있는 칸은 그때가 되어야 열린다',
    run(l) {
      const out = []
      for (const s of l.steps) {
        for (const f of s.fields) {
          const t = `${f.label}\n${f.help ?? ''}`
          const hit = 순서_말.filter((k) => t.includes(k))
          if (hit.length > 0 && !f.gate) {
            out.push(`${s.id} 「${f.label}」 이 「${hit[0]}」 인데 열림 조건이 없다`)
          }
        }
        for (const g of [...(s.material ?? []).map((m) => m.gate), ...s.fields.map((f) => f.gate)]) {
          if (g && !g.lockedMessage?.trim()) out.push(`${s.id} 의 gate 에 여는 조건 문구가 없다`)
        }
      }
      return out
    },
  },
  {
    id: 'C1', name: '그림 명세', doc: '그림은 프롬프트·대체 설명·대안까지 갖춘다',
    run(l) {
      const out = []
      for (const s of l.steps) {
        for (const m of s.material ?? []) {
          if (m.format !== 'image') {
            if (m.imageSpec) out.push(`${s.id} 「${m.title}」 은 image 가 아닌데 imageSpec 이 있다`)
            continue
          }
          const spec = m.imageSpec
          if (!spec) { out.push(`${s.id} 「${m.title}」 에 imageSpec 이 없다`); continue }
          for (const k of ['purpose', 'genPrompt', 'altText', 'fallback', 'license']) {
            if (!String(spec[k] ?? '').trim()) out.push(`${s.id} 「${m.title}」 의 ${k} 가 비었다`)
          }
          for (const k of ['mustShow', 'mustNotShow', 'labels']) {
            if (!(spec[k]?.length > 0)) out.push(`${s.id} 「${m.title}」 의 ${k} 가 비었다`)
          }
          if ((spec.altText ?? '').length < 80) {
            out.push(`${s.id} 「${m.title}」 의 altText 가 짧다 — 보지 않고도 같은 판단이 되어야 한다`)
          }
          if (spec.labels?.length > 0) {
            const 금지 = (spec.mustNotShow ?? []).join(' ')
            if (!/글자|문구|글씨|text|label/i.test(금지)) {
              out.push(`${s.id} 「${m.title}」 의 mustNotShow 에 「그림 안에 글자 금지」가 없다`)
            }
          }
          if (spec.src) {
            const 경로 = `public${spec.src.split('?')[0]}`
            if (!existsSync(경로)) out.push(`${s.id} 「${m.title}」 의 그림 파일 ${경로} 가 없다`)
          } else {
            out.push(`${s.id} 「${m.title}」 은 아직 그림 파일이 없다 — 프롬프트로 만들어 넣는다`)
          }
        }
      }
      return out
    },
  },
  {
    id: 'D1', name: '꼭 알아야 할 것', doc: '개념 카드마다 강조할 알맹이 3줄 이상',
    run(l) {
      return l.keyConcepts.filter((c) => (c.mustKnow?.length ?? 0) < 3)
        .map((c) => `「${c.term}」 의 mustKnow 가 ${c.mustKnow?.length ?? 0}줄`)
    },
  },
  {
    id: 'D2', name: '더 읽기', doc: '개념 카드마다 수업 뒤 혼자 읽을 본문',
    run(l) {
      return l.keyConcepts.filter((c) => (c.deepDive?.length ?? 0) < 1)
        .map((c) => `「${c.term}」 에 deepDive 가 없다`)
    },
  },
  {
    id: 'D3', name: '강조 표시', doc: '강사가 소리 내어 읽을 대목을 **볼드**로 짚는다',
    run(l) {
      return l.keyConcepts.filter((c) => {
        const t = [...(c.mustKnow ?? []), ...(c.deepDive ?? []).map((d) => d.body)].join('\n')
        return !/\*\*[^*]+\*\*/.test(t)
      }).map((c) => `「${c.term}」 에 **강조**가 하나도 없다`)
    },
  },
  {
    id: 'D4', name: '줄임말 풀이', doc: '학생이 읽는 글에 나온 줄임말은 한 번은 풀어 준다',
    run(l) {
      const t = 학생글(l)
      const 나온것 = new Set((t.match(/\b[A-Z]{2,6}\b/g) ?? []).filter((x) => !설명_면제[x]))
      const out = []
      for (const a of 나온것) {
        /* 집 문법: 「**CER** — 주장(Claim)…」 처럼 볼드 뒤에 줄표로 푼다 */
        if (!new RegExp(`\\*\\*${a}\\*\\*\\s*[—-]`).test(t)) out.push(`「${a}」 가 풀이 없이 쓰였다`)
      }
      return out
    },
  },
  {
    id: 'D5', name: '앞으로 배울 강', doc: '학생 글에서 뒤 차시를 번호로 부르지 않는다 — 「나중에」',
    run(l) {
      const 지금 = Number(l.id)
      const out = []
      for (const m of 학생글(l).matchAll(/(\d{1,2})\s*강/g)) {
        if (Number(m[1]) > 지금) out.push(`「${m[0]}」 이라고 앞질러 부른다 — 「나중에」로`)
      }
      return [...new Set(out)]
    },
  },
  {
    id: 'E1', name: '칸의 보기', doc: '사분면·배분 칸은 무엇을 적는지 한 줄 예시를 준다',
    run(l) {
      const out = []
      for (const s of l.steps) {
        for (const f of s.fields) {
          for (const q of f.quadrants ?? []) {
            if (!q.hint?.trim()) out.push(`${s.id} 「${f.label}」 의 ${q.label} 칸에 보기가 없다`)
          }
          for (const i of f.items ?? []) {
            if (!i.note?.trim()) out.push(`${s.id} 「${f.label}」 의 ${i.label} 에 설명이 없다`)
          }
        }
      }
      return out
    },
  },
  {
    id: 'E2', name: '묵은 말', doc: '더 쓰지 않기로 한 말이 남아 있지 않다',
    run(l) {
      const t = 학생글(l)
      return 묵은_말.filter((w) => t.includes(w)).map((w) => `「${w}」 가 남아 있다`)
    },
  },
]

/* ── 실행 ── */
const 인수 = process.argv.slice(2).map((x) => x.padStart(2, '0'))
const 대상 = 인수.length > 0 ? LESSONS.filter((l) => 인수.includes(l.id)) : LESSONS

if (인수.length > 0 && 대상.length !== 인수.length) {
  const 없는 = 인수.filter((x) => !LESSONS.some((l) => l.id === x))
  console.error(`\n  그런 차시가 없다: ${없는.join(', ')}\n`)
  process.exit(1)
}

let 빈곳_전체 = 0
const 줄 = '─'.repeat(60)

for (const l of 대상) {
  const 결과 = 항목.map((c) => ({ ...c, gaps: c.run(l) }))
  const 남은 = 결과.filter((r) => r.gaps.length > 0)
  빈곳_전체 += 남은.reduce((n, r) => n + r.gaps.length, 0)

  console.log(`\n${줄}`)
  console.log(`${l.id}강 ${l.title}${l.published ? '  (공개됨)' : ''}`)
  console.log(줄)

  if (대상.length > 3 && 남은.length > 0) {
    /* 여러 차시를 한꺼번에 볼 때는 항목 이름만 — 자세한 것은 한 차시씩 부른다 */
    console.log(`  남은 항목 ${남은.length}개: ${남은.map((r) => r.id).join(' ')}`)
    continue
  }

  for (const r of 결과) {
    if (r.gaps.length === 0) { console.log(`  ✓ ${r.id} ${r.name}`); continue }
    console.log(`  ✗ ${r.id} ${r.name} — ${r.doc}`)
    for (const g of r.gaps.slice(0, 8)) console.log(`      · ${g}`)
    if (r.gaps.length > 8) console.log(`      · … 그리고 ${r.gaps.length - 8}개 더`)
  }
}

console.log(`\n${줄}`)
if (빈곳_전체 === 0) {
  console.log(`${대상.map((l) => l.id).join('·')}강 — 1·2강 기준을 모두 채웠다.\n`)
  process.exit(0)
}
console.log(`빈 곳 ${빈곳_전체}개. 기준은 docs/강의-일괄-수정-기준.md 에 있다.`)
console.log(`한 차시만 자세히 보려면:  npm run audit:lesson -- ${대상[0].id}\n`)
process.exit(인수.length > 0 ? 1 : 0)
