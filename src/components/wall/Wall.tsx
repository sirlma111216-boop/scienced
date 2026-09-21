import { useEffect, useMemo, useRef, useState } from 'react'
import type { FieldDef, LessonId } from '@/content/types'
import { useAuth } from '@/lib/auth'
import type { Post } from '@/lib/types'
import { Badge, Button, Caption, Notice } from '@/components/ui'

/**
 * 의견 광장 — 카드 목록 하나, 최신순 (8차 원칙 3).
 *
 * 읽는 것은 읽기로 끝난다. 반응·댓글·고정·숨김·정렬·묶기·이어서 쓰기·고치기·삭제가 없다.
 * 한 사람이 한 글을 한 번 올린다. 본인이 그 단계 응답을 제출한 뒤에만 열린다.
 */

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

/** 마지막 버전의 본문 */
export function postContent(p: Post): string {
  return p.versions?.[p.versions.length - 1]?.content ?? ''
}

/** 응답에서 광장 글을 만든다 — 방금 쓴 것을 다시 치게 하지 않는다 */
export function composeFromFields(fields: FieldDef[], payload: Record<string, unknown>): string {
  const lines: string[] = []
  for (const f of fields) {
    const v = payload[f.key]
    const text =
      typeof v === 'string' ? v : Array.isArray(v) ? v.filter(Boolean).map(String).join(', ') : ''
    const t = text.trim()
    if (t) lines.push(t)
  }
  return lines.join('\n\n')
}

/* ─────────────────────────── ShareBar ─────────────────────────── */

export function ShareBar({
  classId,
  lessonId,
  stepId,
  prompt,
  unlocked,
  fields,
  groupId = null,
}: {
  classId: string
  lessonId: LessonId
  stepId: string
  prompt: string
  /** 본인이 이 단계 응답을 제출했는가 */
  unlocked: boolean
  /** 공유 상자를 열 때 내가 낸 답을 불러와 채우는 데 쓴다 */
  fields?: FieldDef[]
  /** 모둠 이름으로 올리는 글이면 그 모둠 id */
  groupId?: string | null
}) {
  const { repo, user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [open, setOpen] = useState(false)
  const [composing, setComposing] = useState(false)

  useEffect(() => {
    if (!repo || !unlocked) return
    return repo.watchPosts(classId, lessonId, stepId, setPosts)
  }, [repo, classId, lessonId, stepId, unlocked])

  if (!unlocked) {
    return (
      <Notice tone="cream">
        <p className="text-body-sm" style={{ margin: 0 }}>
          의견 광장은 내 답을 제출한 뒤에 열립니다. 남의 답을 먼저 보고 자기 생각을 정하는 일을 막기
          위해서입니다.
        </p>
      </Notice>
    )
  }

  const myPost = posts.find((p) => p.uid === user?.uid) ?? null

  return (
    <>
      {/* 무엇을 올리라는 말이 먼저다 — 단추 옆에 흐리게 두지 않는다 (강의자 지시 2026-09-21) */}
      <p className="text-body" style={{ margin: '0 0 10px' }}>
        {prompt}
      </p>
      <div className="flex flex-wrap items-center gap-md no-print">
        {myPost ? (
          <Caption>내 글이 올라가 있습니다</Caption>
        ) : (
          <Button onClick={() => setComposing(true)}>공유하기</Button>
        )}
        <Button variant="secondary" onClick={() => setOpen(true)}>
          다른 사람 생각 보기 ({posts.length})
        </Button>
      </div>

      {composing ? (
        <ComposeDialog
          classId={classId}
          lessonId={lessonId}
          stepId={stepId}
          prompt={prompt}
          fields={fields}
          groupId={groupId}
          onClose={() => setComposing(false)}
          onDone={() => {
            setComposing(false)
            setOpen(true)
          }}
        />
      ) : null}

      {open ? <WallDialog prompt={prompt} posts={posts} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

/* ─────────────────────────── 모달 껍데기 ─────────────────────────── */

function Dialog({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 24,
        overflowY: 'auto',
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="bg-canvas rounded-lg"
        style={{
          width: '100%',
          maxWidth: wide ? 1100 : 640,
          padding: 24,
          boxShadow: '0 24px 64px rgba(0,0,0,0.24)',
        }}
      >
        <div className="flex items-center gap-md" style={{ marginBottom: 16 }}>
          <h2 className="text-card-title" style={{ margin: 0 }}>
            {title}
          </h2>
          <span className="flex-1" />
          <Button variant="tertiary" onClick={onClose}>
            닫기
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ─────────────────────────── 쓰기 — 한 번 ─────────────────────────── */

function ComposeDialog({
  classId,
  lessonId,
  stepId,
  prompt,
  fields,
  groupId,
  onClose,
  onDone,
}: {
  classId: string
  lessonId: LessonId
  stepId: string
  prompt: string
  fields?: FieldDef[]
  groupId: string | null
  onClose: () => void
  onDone: () => void
}) {
  const { user, repo } = useAuth()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const touched = useRef(false)

  useEffect(() => {
    if (!repo || !user) return
    let cancelled = false
    repo
      .getResponse(classId, lessonId, stepId, user.uid)
      .then((doc) => {
        if (cancelled || touched.current) return
        const latest = doc?.versions?.[doc.versions.length - 1]
        if (!latest) return
        const composed = composeFromFields(fields ?? [], (latest.payload ?? {}) as Record<string, unknown>)
        if (composed) setText(composed)
      })
      .catch((err) => console.warn('[광장] 내 답을 불러오지 못했다:', err))
    return () => {
      cancelled = true
    }
  }, [repo, user, classId, lessonId, stepId, fields])

  async function submit() {
    if (!repo || !user) return
    if (!text.trim()) {
      setError('내용을 적으세요.')
      return
    }
    try {
      await repo.upsertPost(classId, lessonId, stepId, {
        uid: user.uid,
        nickname: user.nickname || '이름 없음',
        groupId,
        content: text.trim(),
      })
      await repo.bumpParticipation(classId, user.uid, {})
      onDone()
    } catch (err) {
      console.error('[광장] 올리지 못했다:', err)
      setError('올리지 못했습니다. 잠시 뒤 다시 누르세요.')
    }
  }

  return (
    <Dialog title="내 생각 공유하기" onClose={onClose}>
      <p className="text-body" style={{ marginBottom: 12 }}>
        {prompt}
      </p>
      {text.trim() ? (
        <p className="caption" style={{ marginBottom: 8, opacity: 0.7 }}>
          내가 낸 답을 불러왔습니다. 그대로 올려도 됩니다.
        </p>
      ) : null}
      <textarea
        className="field"
        rows={6}
        value={text}
        aria-label="공유할 내용"
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          touched.current = true
          setText(e.target.value)
          setError(null)
        }}
        style={{ resize: 'vertical' }}
      />
      {error ? (
        <p role="alert" className="text-body-sm" style={{ fontWeight: 480, marginTop: 8 }}>
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-md" style={{ marginTop: 16 }}>
        <Button onClick={() => void submit()}>올리기</Button>
        <Caption>한 번만 올립니다. 화면에는 닉네임만 보입니다.</Caption>
      </div>
    </Dialog>
  )
}

/* ─────────────────────────── 벽 — 읽기만 ─────────────────────────── */

export function WallDialog({
  prompt,
  posts,
  onClose,
}: {
  prompt: string
  posts: Post[]
  onClose: () => void
}) {
  const list = useMemo(() => [...posts].sort((a, b) => b.createdAt - a.createdAt), [posts])

  return (
    <Dialog title="다른 사람의 생각" onClose={onClose} wide>
      <p className="text-body-sm" style={{ opacity: 0.72, marginBottom: 12 }}>
        {prompt}
      </p>
      {list.length === 0 ? (
        <p className="text-body" style={{ opacity: 0.6 }}>
          아직 올라온 글이 없습니다.
        </p>
      ) : (
        <div style={{ columnWidth: 300, columnGap: 16 }}>
          {list.map((p) => (
            <WallCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </Dialog>
  )
}

/* ─────────────────────────── 카드 ─────────────────────────── */

export function WallCard({ post }: { post: Post }) {
  return (
    <article
      className="bg-canvas rounded-lg"
      style={{
        boxShadow: 'inset 0 0 0 1px #e6e6e6',
        padding: 14,
        marginBottom: 12,
        breakInside: 'avoid',
        display: 'inline-block',
        width: '100%',
      }}
    >
      <div className="flex items-center gap-xs" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        {post.groupId ? <Badge solid>{post.groupId}모둠</Badge> : null}
        <span className="text-body-sm" style={{ fontWeight: 480 }}>
          {post.nickname}
        </span>
        <Caption>{relativeTime(post.createdAt)}</Caption>
      </div>
      <div className="text-body" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
        {postContent(post)}
      </div>
    </article>
  )
}
