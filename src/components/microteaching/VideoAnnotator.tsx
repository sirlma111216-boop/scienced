import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Caption, Notice, ScrollX } from '@/components/ui'

/**
 * 마이크로티칭 영상 주석.
 *
 * 개인정보 설계 (컨텍스트 18.7 · 19.4):
 *  · 영상은 서버로 올리지 않는다. 브라우저 안에서만 재생한다(objectURL).
 *    새로고침하면 영상은 사라지고 주석만 남는다. 얼굴이 담긴 파일을 어디에도 보내지 않기 위해서다.
 *  · AI 에 영상이나 식별 가능한 정보를 넣지 않는다.
 *  · 저장되는 것은 시각·관찰 코드·증거 문장뿐이다.
 *
 * 기록 규칙: "좋았다/아쉬웠다"는 쓰지 않는다.
 * 시간·발화·산출물 증거를 인용하고 의도를 추측하지 않는다.
 */

export const OBSERVATION_CODES = [
  { key: 'E', label: '학생 생각 끌어내기', hint: '발문과 실제 응답' },
  { key: 'P', label: '발화 연결', hint: '다시 말하거나 서로 잇기' },
  { key: 'R', label: '이유·증거 요구', hint: '표상을 요구한 장면' },
  { key: 'W', label: '기다림', hint: '대기시간과 생각할 기회' },
  { key: 'F', label: '형성평가 대응', hint: '증거 때문에 행동이 바뀐 장면' },
  { key: 'A', label: '접근성·참여', hint: '장벽 또는 지원' },
  { key: 'C', label: '과학적 정확성', hint: '모형의 한계·불확실성 처리' },
] as const

export type CodeKey = (typeof OBSERVATION_CODES)[number]['key']

export interface Annotation {
  id: string
  /** 초 단위. 영상이 없으면 손으로 적는다. */
  at: number
  code: CodeKey
  evidence: string
  /** 재수업 뒤 기록인가 */
  phase: 'before' | 'after'
}

/** 인상평을 거른다. 이 말들이 있고 증거가 없으면 저장하지 않는다. */
const IMPRESSION_WORDS = ['좋았', '아쉬웠', '잘했', '멋있', '재미있었', '훌륭', '괜찮았']

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function parseTime(text: string): number {
  const m = text.match(/^(\d{1,2}):(\d{1,2})$/)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  const n = Number(text)
  return Number.isFinite(n) ? n : 0
}

export function VideoAnnotator({
  annotations,
  onChange,
  phase,
  onPhaseChange,
}: {
  annotations: Annotation[]
  onChange: (next: Annotation[]) => void
  phase: 'before' | 'after'
  onPhaseChange: (p: 'before' | 'after') => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [code, setCode] = useState<CodeKey>('E')
  const [evidence, setEvidence] = useState('')
  const [manualTime, setManualTime] = useState('')
  const [error, setError] = useState<string | null>(null)

  // objectURL 은 반드시 되돌려 준다. 안 그러면 메모리에 파일이 남는다.
  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src)
    }
  }, [src])

  function loadFile(file: File | undefined) {
    if (!file) return
    if (src) URL.revokeObjectURL(src)
    setSrc(URL.createObjectURL(file))
    setFileName(file.name)
  }

  function add() {
    const at = src ? current : parseTime(manualTime)
    if (!src && !manualTime.trim()) {
      setError('시각을 적어 주세요. 예: 03:20')
      return
    }
    if (evidence.trim().length < 10) {
      setError('무엇을 보았는지 구체적으로 적어 주세요.')
      return
    }
    const hasImpression = IMPRESSION_WORDS.some((w) => evidence.includes(w))
    const hasEvidence = /\d|"|“|학생|말했|응답|썼|그렸|초|명|질문/.test(evidence)
    if (hasImpression && !hasEvidence) {
      setError(
        '인상평만으로는 저장되지 않습니다. 시간·발화·산출물 증거를 함께 적어 주세요. ' +
          '예: “질문 뒤 대기시간이 1초여서 세 학생의 생각만 드러났다”',
      )
      return
    }
    setError(null)
    onChange([
      ...annotations,
      { id: Date.now().toString(36), at, code, evidence: evidence.trim(), phase },
    ])
    setEvidence('')
    setManualTime('')
  }

  const sorted = useMemo(
    () => [...annotations].sort((a, b) => a.at - b.at),
    [annotations],
  )
  const shown = sorted.filter((a) => a.phase === phase)

  /** 코드별 개수. 무엇이 빠졌는지가 재수업 계획의 재료가 된다. */
  const counts = useMemo(() => {
    const map: Record<string, { before: number; after: number }> = {}
    for (const c of OBSERVATION_CODES) map[c.key] = { before: 0, after: 0 }
    for (const a of annotations) map[a.code][a.phase] += 1
    return map
  }, [annotations])

  const duration = videoRef.current?.duration ?? 0

  return (
    <section className="flex flex-col gap-lg">
      <Notice tone="cream">
        <p className="text-body-sm" style={{ margin: 0 }}>
          <strong>영상은 서버로 올라가지 않습니다.</strong> 이 브라우저 안에서만 재생되고,
          새로고침하면 사라집니다. 저장되는 것은 시각·코드·증거 문장뿐입니다.
          AI 에도 영상이나 식별 가능한 정보를 넣지 않습니다.
        </p>
      </Notice>

      {/* 영상 */}
      <div className="card">
        <div className="flex items-center gap-md" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
          <label
            className="btn-secondary"
            style={{ cursor: 'pointer', display: 'inline-flex' }}
            htmlFor="va-file"
          >
            영상 열기
          </label>
          <input
            id="va-file"
            type="file"
            accept="video/*"
            onChange={(e) => loadFile(e.target.files?.[0])}
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
          />
          <Caption>{fileName ?? '영상 없이 시각을 손으로 적어도 됩니다'}</Caption>
        </div>

        {src ? (
          <>
            <video
              ref={videoRef}
              src={src}
              controls
              onTimeUpdate={(e) => setCurrent((e.target as HTMLVideoElement).currentTime)}
              style={{ width: '100%', maxHeight: 420, borderRadius: 8, background: '#000' }}
            >
              {/* 자막 트랙은 브라우저 기본 UI 로 붙일 수 있다 */}
              현재 브라우저가 영상 재생을 지원하지 않습니다.
            </video>

            {/* 시간축 위 주석 표시 */}
            {duration > 0 ? (
              <div
                style={{ position: 'relative', height: 28, marginTop: 8 }}
                aria-label={`시간축. 주석 ${shown.length}개.`}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 12,
                    height: 3,
                    background: '#e6e6e6',
                    borderRadius: 999,
                  }}
                />
                {shown.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      if (videoRef.current) videoRef.current.currentTime = a.at
                    }}
                    title={`${formatTime(a.at)} ${a.code} — ${a.evidence}`}
                    style={{
                      position: 'absolute',
                      left: `${(a.at / duration) * 100}%`,
                      top: 0,
                      transform: 'translateX(-50%)',
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      background: '#000',
                      color: '#fff',
                      fontSize: 11,
                      fontFamily: 'JetBrains Mono, monospace',
                      border: 0,
                      cursor: 'pointer',
                    }}
                  >
                    {a.code}
                  </button>
                ))}
              </div>
            ) : null}

            <p className="font-mono text-body-sm" style={{ marginTop: 8 }}>
              현재 {formatTime(current)}
            </p>
          </>
        ) : null}
      </div>

      {/* 전/후 전환 */}
      <div className="flex gap-xs">
        {(['before', 'after'] as const).map((p) => (
          <button
            key={p}
            type="button"
            className="tab"
            data-selected={phase === p}
            aria-pressed={phase === p}
            onClick={() => onPhaseChange(p)}
          >
            {p === 'before' ? '1차 수업' : '재수업'}
            <span className="font-mono text-caption" style={{ marginLeft: 6 }}>
              {annotations.filter((a) => a.phase === p).length}
            </span>
          </button>
        ))}
      </div>

      {/* 기록 입력 */}
      <div className="card">
        <Caption>
          {phase === 'before' ? '1차 수업' : '재수업'} 관찰 기록 — 시각 + 코드 + 증거
        </Caption>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: src
              ? 'minmax(140px, 200px) 1fr auto'
              : 'minmax(100px, 120px) minmax(140px, 200px) 1fr auto',
            gap: 12,
            marginTop: 12,
            alignItems: 'end',
          }}
        >
          {!src ? (
            <div className="flex flex-col gap-xs">
              <label htmlFor="va-time" className="text-body-sm" style={{ fontWeight: 480 }}>
                시각
              </label>
              <input
                id="va-time"
                className="field"
                value={manualTime}
                placeholder="03:20"
                onChange={(e) => setManualTime(e.target.value)}
              />
            </div>
          ) : null}
          <div className="flex flex-col gap-xs">
            <label htmlFor="va-code" className="text-body-sm" style={{ fontWeight: 480 }}>
              코드
            </label>
            <select
              id="va-code"
              className="field"
              value={code}
              onChange={(e) => setCode(e.target.value as CodeKey)}
            >
              {OBSERVATION_CODES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.key} — {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor="va-ev" className="text-body-sm" style={{ fontWeight: 480 }}>
              증거
            </label>
            <input
              id="va-ev"
              className="field"
              value={evidence}
              placeholder="질문 뒤 대기시간이 1초여서 세 학생의 생각만 드러났다"
              onChange={(e) => setEvidence(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') add()
              }}
            />
          </div>
          <Button onClick={add}>{src ? `${formatTime(current)}에 기록` : '기록'}</Button>
        </div>

        {error ? (
          <p role="alert" className="text-body-sm" style={{ fontWeight: 480, marginTop: 12 }}>
            ⚠ {error}
          </p>
        ) : null}
      </div>

      {/* 기록 목록 */}
      {shown.length > 0 ? (
        <ScrollX>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 620 }}>
            <thead>
              <tr>
                {['시각', '코드', '증거', ''].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="caption"
                    style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <tr key={a.id} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                  <td className="font-mono text-body-sm" style={{ padding: '10px 12px 10px 0' }}>
                    <button
                      type="button"
                      className="btn-tertiary"
                      style={{ padding: 0, minHeight: 32 }}
                      onClick={() => {
                        if (videoRef.current) videoRef.current.currentTime = a.at
                      }}
                    >
                      {formatTime(a.at)}
                    </button>
                  </td>
                  <td style={{ padding: '10px 12px 10px 0' }}>
                    <Badge>{a.code}</Badge>
                  </td>
                  <td className="text-body-sm" style={{ padding: '10px 12px 10px 0' }}>
                    {a.evidence}
                  </td>
                  <td style={{ padding: '10px 0' }}>
                    <Button
                      variant="tertiary"
                      onClick={() => onChange(annotations.filter((x) => x.id !== a.id))}
                    >
                      지우기
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      ) : null}

      {/* 전후 비교 — 코드별 개수 */}
      <div className="card">
        <Caption>1차 수업과 재수업의 차이 — 코드별 기록 수</Caption>
        <ScrollX>
          <table style={{ borderCollapse: 'collapse', marginTop: 12, minWidth: 480 }}>
            <thead>
              <tr>
                {['코드', '1차', '재수업', '변화'].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="caption"
                    style={{ textAlign: 'left', padding: '4px 16px 4px 0' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OBSERVATION_CODES.map((c) => {
                const b = counts[c.key].before
                const a = counts[c.key].after
                const d = a - b
                return (
                  <tr key={c.key} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                    <th
                      scope="row"
                      className="text-body-sm"
                      style={{ textAlign: 'left', padding: '6px 16px 6px 0', fontWeight: 400 }}
                    >
                      <Badge>{c.key}</Badge> {c.label}
                    </th>
                    <td className="font-mono text-body-sm" style={{ padding: '6px 16px 6px 0' }}>
                      {b}
                    </td>
                    <td className="font-mono text-body-sm" style={{ padding: '6px 16px 6px 0' }}>
                      {a}
                    </td>
                    <td className="font-mono text-body-sm" style={{ padding: '6px 0' }}>
                      {/* 색이 아니라 부호로 표시한다 */}
                      {d === 0 ? '—' : d > 0 ? `+${d}` : String(d)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollX>
        <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.72 }}>
          개수가 늘었다고 좋은 수업이 되는 것은 아닙니다. 무엇을 바꿨고 학생 반응이 어떻게
          달라졌는지를 증거로 설명해야 합니다.
        </p>
      </div>
    </section>
  )
}
