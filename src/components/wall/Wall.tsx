import { useEffect, useMemo, useRef, useState } from 'react'
import type { LessonId } from '@/content/types'
import {
  COMMENT_MAX,
  COMMENT_STARTERS,
  REACTIONS,
  WALL_SORTS,
  type WallSortKey,
} from '@/content/reactions'
import { useAuth } from '@/lib/auth'
import type { FieldDef } from '@/content/types'
import type { Post } from '@/lib/types'
import { Badge, Button, Caption, Notice } from '@/components/ui'

/**
 * 의견 광장.
 *
 * 「거꾸로 설계 연수실」의 담벼락 골격을 그대로 가져왔다(그 앱에서의 이름이다):
 * 활동 하단의 버튼 줄 → 모달 → 벽돌 배치,
 * 카드에 닉네임·상대 시각·내용, 한 줄 댓글, 강사의 고정/숨김, 실시간 구독.
 *
 * 바꾼 곳 (지시서 9.2):
 *  - 본인이 그 단계 응답을 제출한 뒤에만 열린다.
 *  - 좋아요 대신 반응 4종. 인기순 정렬 없음.
 *  - 글 수정은 덮어쓰기가 아니라 새 버전 쌓기.
 *  - 강사는 삭제가 아니라 숨김. 삭제는 작성자만.
 */

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

/* ─────────────────────────── ShareBar ─────────────────────────── */

export function ShareBar({
  classId,
  lessonId,
  stepId,
  prompt,
  unlocked,
  fields,
}: {
  classId: string
  lessonId: LessonId
  stepId: string
  prompt: string
  /** 본인이 이 단계 응답을 제출했는가 */
  unlocked: boolean
  /**
   * 이 단계의 입력 칸.
   * 공유 상자를 열 때 내가 낸 답을 불러와 채우는 데 쓴다 —
   * 방금 쓴 것을 다시 치게 하면 같은 일을 두 번 시키는 것이다.
   */
  fields?: FieldDef[]
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
        <p className="text-body-sm">
          <strong>의견 광장은 내 답을 제출한 뒤에 열립니다.</strong> 남의 답을 먼저 보고 자기
          생각을 정하는 일을 막기 위해서입니다.
        </p>
      </Notice>
    )
  }

  const visible = posts.filter((p) => !p.isHidden)
  /* 내가 이미 올린 글. 있으면 새 글을 만들지 않고 그 아래에 이어 붙인다. */
  const myPost = posts.find((p) => p.uid === user?.uid) ?? null

  return (
    <>
      <div className="flex flex-wrap items-center gap-md no-print">
        <Button onClick={() => setComposing(true)}>
          {myPost ? '내 글에 이어서 쓰기' : '공유하기'}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          다른 사람 생각 보기 ({visible.length})
        </Button>
        <span className="text-body-sm" style={{ opacity: 0.66 }}>
          {prompt}
        </span>
      </div>

      {composing ? (
        <ComposeDialog
          classId={classId}
          lessonId={lessonId}
          stepId={stepId}
          prompt={prompt}
          fields={fields}
          myPost={myPost}
          onClose={() => setComposing(false)}
          onDone={() => {
            setComposing(false)
            setOpen(true)
          }}
        />
      ) : null}

      {open ? (
        <WallDialog
          classId={classId}
          lessonId={lessonId}
          stepId={stepId}
          prompt={prompt}
          posts={posts}
          onClose={() => setOpen(false)}
        />
      ) : null}
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

/* ─────────────────────────── 쓰기 ─────────────────────────── */

function ComposeDialog({
  classId,
  lessonId,
  stepId,
  prompt,
  fields,
  myPost,
  onClose,
  onDone,
}: {
  classId: string
  lessonId: LessonId
  stepId: string
  prompt: string
  fields?: FieldDef[]
  /** 내가 이미 올린 글. 있으면 새 글이 아니라 그 아래에 이어 붙인다. */
  myPost?: Post | null
  onClose: () => void
  onDone: () => void
}) {
  const { user, repo } = useAuth()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  /** 불러온 답을 그대로 낼 것인가, 고쳐서 낼 것인가 — 고친 적이 있으면 다시 덮지 않는다. */
  const touched = useRef(false)

  /*
   * 내가 낸 최신 답을 불러와 채운다.
   * 방금 쓴 것을 다시 치게 하면 같은 일을 두 번 시키는 것이다.
   * 숫자만 있는 칸은 문장이 되지 않으므로 뺀다.
   */
  useEffect(() => {
    if (!repo || !user) return
    let cancelled = false
    void repo.getResponse(classId, lessonId, stepId, user.uid).then((doc) => {
      if (cancelled || touched.current) return
      const latest = doc?.versions?.[doc.versions.length - 1]
      if (!latest) return
      const payload = latest.payload ?? {}
      /*
       * 이미 올린 글에 든 대목은 빼고 새로 쓴 것만 채운다.
       * 2차 응답을 낼 때 1차 문장까지 다시 붙어 같은 말이 두 번 적히지 않게 한다.
       */
      const already = myPost?.versions?.[myPost.versions.length - 1]?.content ?? ''
      const lines: string[] = []
      for (const f of fields ?? []) {
        const v = payload[f.key]
        const text =
          typeof v === 'string' ? v : Array.isArray(v) ? v.filter(Boolean).join(', ') : ''
        const t = text.trim()
        if (t && !already.includes(t)) lines.push(t)
      }
      if (lines.length > 0) setText(lines.join('\n\n'))
    })
    return () => {
      cancelled = true
    }
  }, [repo, user, classId, lessonId, stepId, fields, myPost])

  async function submit() {
    if (!repo || !user) return
    if (!text.trim()) {
      setError('내용을 적어 주세요.')
      return
    }
    /*
     * 이미 올린 글이 있으면 그 아래에 이어 붙인다.
     * 별도의 카드를 만들지 않는다 — 한 사람의 생각이 흩어지면 읽는 쪽이 이어 볼 수 없다.
     */
    const before = myPost?.versions?.[myPost.versions.length - 1]?.content ?? ''
    const content = before ? [before, text.trim()].join('\n\n') : text.trim()
    await repo.upsertPost(classId, lessonId, stepId, {
      uid: user.uid,
      nickname: user.nickname || '이름 없음',
      groupId: user.groupId,
      content,
    })
    await repo.bumpParticipation(classId, user.uid, {})
    onDone()
  }

  return (
    <Dialog title={myPost ? '내 글에 이어서 쓰기' : '내 생각 공유하기'} onClose={onClose}>
      <p className="text-body-sm" style={{ opacity: 0.72, marginBottom: 12 }}>
        {prompt}
      </p>
      {text.trim() ? (
        <p className="caption" style={{ marginBottom: 8, opacity: 0.7 }}>
          내가 낸 답을 불러왔습니다. 고쳐서 내도 됩니다.
        </p>
      ) : null}
      {myPost ? (
        <div
          className="rounded-md"
          style={{
            padding: '12px 14px',
            marginBottom: 12,
            background: '#f7f7f5',
            boxShadow: 'inset 0 0 0 1px #e6e6e6',
          }}
        >
          <Caption>이미 올린 내 글</Caption>
          <p className="text-body-sm" style={{ margin: '6px 0 0', whiteSpace: 'pre-line' }}>
            {myPost.versions[myPost.versions.length - 1]?.content}
          </p>
        </div>
      ) : null}
      <p className="caption" style={{ marginBottom: 8, opacity: 0.7 }}>
        {myPost
          ? '아래에 적은 것이 위 글 뒤에 이어 붙습니다. 새 카드가 생기지 않습니다.'
          : '한 사람이 한 글만 올립니다.'}
      </p>
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
          ⚠ {error}
        </p>
      ) : null}
      <div className="flex items-center gap-md" style={{ marginTop: 16 }}>
        <Button onClick={() => void submit()}>{myPost ? '이어 붙이기' : '올리기'}</Button>
        <Caption>화면에는 닉네임만 보입니다.</Caption>
      </div>
    </Dialog>
  )
}

/* ─────────────────────────── 벽 ─────────────────────────── */

export function WallDialog({
  classId,
  lessonId,
  stepId,
  prompt,
  posts,
  onClose,
}: {
  classId: string
  lessonId: LessonId
  stepId: string
  prompt: string
  posts: Post[]
  onClose: () => void
}) {
  const { user, isInstructor } = useAuth()
  const [sort, setSort] = useState<WallSortKey>('unanswered')

  const list = useMemo(() => {
    const mine = user?.uid
    const visible = posts.filter((p) => !p.isHidden || p.uid === mine || isInstructor)
    const reactionCount = (p: Post) =>
      Object.values(p.reactions ?? {}).reduce((s, arr) => s + arr.length, 0)

    const sorted = [...visible]
    switch (sort) {
      case 'recent':
        sorted.sort((a, b) => b.createdAt - a.createdAt)
        break
      case 'unanswered':
      default:
        // 기본값: 아직 아무도 반응하지 않은 글이 먼저. 인기순은 만들지 않는다.
        sorted.sort(
          (a, b) => reactionCount(a) - reactionCount(b) || b.createdAt - a.createdAt,
        )
    }
    // 강사가 고정한 글은 언제나 맨 앞
    return sorted.sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
  }, [posts, sort, user, isInstructor])

  return (
    <Dialog title="다른 사람의 생각" onClose={onClose} wide>
      <p className="text-body-sm" style={{ opacity: 0.72, marginBottom: 12 }}>
        {prompt}
      </p>

      <div className="flex flex-wrap gap-xs no-print" style={{ marginBottom: 16 }}>
        {WALL_SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            className="tab"
            data-selected={sort === s.key}
            aria-pressed={sort === s.key}
            onClick={() => setSort(s.key)}
            style={{ fontSize: 14, minHeight: 40, padding: '6px 14px' }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="text-body" style={{ opacity: 0.6 }}>
          아직 올라온 글이 없습니다. 첫 글을 올려 보세요.
        </p>
      ) : (
        // 벽돌 배치. 1/2/3열 반응형.
        <div style={{ columnWidth: 300, columnGap: 16 }}>
          {list.map((p) => (
            <WallCard key={p.id} classId={classId} lessonId={lessonId} stepId={stepId} post={p} />
          ))}
        </div>
      )}
    </Dialog>
  )
}

/* ─────────────────────────── 카드 ─────────────────────────── */

export function WallCard({
  classId,
  lessonId,
  stepId,
  post,
}: {
  classId: string
  lessonId: LessonId
  stepId: string
  post: Post
}) {
  const { user, isInstructor, repo } = useAuth()
  const [comment, setComment] = useState('')
  const [showAllComments, setShowAllComments] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [revising, setRevising] = useState(false)
  const [reviseText, setReviseText] = useState('')

  const latest = post.versions[post.versions.length - 1]
  const mine = user?.uid === post.uid
  const myReaction = REACTIONS.find((r) => (post.reactions?.[r.key] ?? []).includes(user?.uid ?? ''))
  const comments = showAllComments ? post.comments : post.comments.slice(-3)

  /*
   * 긴 글은 접는다. 넉 줄쯤이면 무슨 말인지 알 수 있고, 더 궁금하면 펼치면 된다.
   * 줄 수로 재면 짧은 줄이 여럿인 글까지 걸리므로 글자 수도 함께 본다.
   */
  const body = latest?.content ?? ''
  const long = body.length > 160 || body.split('\n').length > 5

  async function react(key: string) {
    if (!repo || !user) return
    await repo.toggleReaction(classId, lessonId, stepId, post.id, user.uid, key)
  }

  async function send() {
    if (!repo || !user || !comment.trim()) return
    await repo.addComment(classId, lessonId, stepId, post.id, {
      uid: user.uid,
      nickname: user.nickname || '이름 없음',
      text: comment.trim().slice(0, COMMENT_MAX),
    })
    setComment('')
  }

  /*
   * 고치면 그 글이 바뀐다. 버전을 쌓지 않는다.
   *
   * 예전에는 v2·v3 로 쌓았는데, 같은 사람의 글이 여러 벌 보여
   * 읽는 쪽에서 어느 것이 지금 생각인지 알 수 없었다.
   * 생각의 변화를 남기는 자리는 응답(제출) 쪽이다 — 거기서는 그대로 쌓인다.
   */
  async function saveRevision() {
    if (!repo || !user || !reviseText.trim()) return
    await repo.upsertPost(classId, lessonId, stepId, {
      uid: post.uid,
      nickname: user.nickname || post.nickname,
      groupId: post.groupId,
      content: reviseText.trim(),
    })
    setRevising(false)
  }

  return (
    <article
      className="bg-canvas rounded-lg"
      style={{
        boxShadow: `inset 0 0 0 ${post.isPinned ? 2 : 1}px ${post.isPinned ? '#000' : '#e6e6e6'}`,
        padding: 14,
        marginBottom: 12,
        /* 여러 칸으로 나눠 그릴 때 카드가 칸 경계에서 잘리지 않게 한다 */
        breakInside: 'avoid',
        display: 'inline-block',
        width: '100%',
      }}
    >
      <div className="flex items-center gap-xs" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        {/* 모둠 이름으로 올린 글은 누가 눌렀는지보다 어느 모둠인지가 먼저다 */}
        {post.groupId ? <Badge solid>{post.groupId}모둠</Badge> : null}
        <span className="text-body-sm" style={{ fontWeight: 480 }}>
          {post.nickname}
        </span>
        <Caption>{relativeTime(post.createdAt)}</Caption>
        {post.isPinned ? <Badge solid>함께 보기</Badge> : null}
        {post.isHidden ? <Badge>숨김</Badge> : null}
      </div>

      {post.isHidden && mine ? (
        <Notice tone="cream">
          <p className="text-body-sm">
            강사가 이 글을 숨겼습니다. 사유: {post.hiddenReason || '사유 없음'}
          </p>
        </Notice>
      ) : null}

      {/*
        본문. 「내용」이라는 꼬리표는 없앴다 — 카드 안에서 그것이 본문인 것은 자명하고,
        스무 장을 훑을 때 한 줄이 아깝다.
        긴 글은 네 줄에서 접는다. 한 사람이 길게 쓰면 나머지가 화면 밖으로 밀려난다.
      */}
      <div
        className="text-body"
        style={{
          margin: '0 0 10px',
          whiteSpace: 'pre-wrap',
          ...(long && !expanded
            ? {
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden',
              }
            : null),
        }}
      >
        {latest?.content}
      </div>
      {long ? (
        <button
          type="button"
          className="btn-tertiary no-print"
          style={{ fontSize: 13, minHeight: 32, padding: 0, marginBottom: 10 }}
          aria-expanded={expanded}
          onClick={() => setExpanded((x) => !x)}
        >
          {expanded ? '접기' : '더 보기'}
        </button>
      ) : null}
      {post.latestV > 1 && latest?.changedReason ? (
        <p className="text-body-sm" style={{ margin: '0 0 10px', opacity: 0.78 }}>
          <span className="caption">바꾼 이유</span> {latest.changedReason}
        </p>
      ) : null}

      {/* 반응 4종. 좋아요 없음, 인기순 없음. */}
      {/*
        네 칸 격자로 둔다. 줄바꿈에 맡기면 375px 에서 3+1 로 접혀 한 줄을 더 먹는다.
        칸을 나눠 두면 어느 폭에서도 한 줄이고, 넷의 너비도 같아 눈이 편하다.
      */}
      <div
        className="no-print"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 4,
          marginBottom: 10,
        }}
      >
        {REACTIONS.map((r) => {
          const users = post.reactions?.[r.key] ?? []
          const on = myReaction?.key === r.key
          return (
            <button
              key={r.key}
              type="button"
              className="tab"
              aria-pressed={on}
              data-selected={on}
              title={r.meaning}
              /* 화면에는 두 글자만. 뜻은 마우스를 올리거나 낭독으로 들으면 나온다. */
              aria-label={`${r.label} — ${r.meaning}`}
              onClick={() => void react(r.key)}
              style={{
                fontSize: 14,
                minHeight: 40,
                padding: '6px 4px',
                width: '100%',
                whiteSpace: 'nowrap',
              }}
            >
              <span className="font-mono" aria-hidden style={{ marginRight: 3 }}>
                {r.mark}
              </span>
              {r.label}
              {users.length > 0 ? (
                <span className="font-mono text-caption" style={{ marginLeft: 6 }}>
                  {users.length}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {comments.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
          {comments.map((c) => (
            <li key={c.id} className="text-body-sm" style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 480 }}>{c.nickname}</span>{' '}
              <span style={{ opacity: 0.86 }}>{c.text}</span>
            </li>
          ))}
          {post.comments.length > 3 && !showAllComments ? (
            <li>
              <button
                type="button"
                className="btn-tertiary"
                style={{ padding: 0, minHeight: 32 }}
                onClick={() => setShowAllComments(true)}
              >
                댓글 {post.comments.length}개 모두 보기
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="no-print">
        <div className="flex gap-xxs" style={{ marginBottom: 6 }}>
          <input
            className="field"
            type="text"
            value={comment}
            maxLength={COMMENT_MAX}
            aria-label={`${post.nickname}의 글에 댓글 쓰기`}
            placeholder="한 줄 댓글"
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void send()
            }}
            style={{ minHeight: 40 }}
          />
          {/* 「남기기」가 두 줄로 접히지 않게 폭을 잡아 둔다 */}
          <Button
            variant="secondary"
            onClick={() => void send()}
            style={{ minHeight: 40, padding: '4px 14px', whiteSpace: 'nowrap' }}
          >
            남기기
          </Button>
        </div>
        {/*
          문장 틀은 접어 둔다.
          늘 펼쳐 두면 카드마다 세 줄을 먹는다 — 스무 장이면 예순 줄이다.
          필요한 사람만 펼치면 되고, 접혀 있어도 무엇이 있는지는 이름으로 안다.
        */}
        <details>
          <summary className="caption" style={{ cursor: 'pointer' }}>
            문장 틀
          </summary>
          <div className="flex flex-wrap gap-xxs" style={{ marginTop: 6 }}>
            {COMMENT_STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                className="btn-tertiary"
                style={{ fontSize: 13, minHeight: 32, padding: '4px 8px', opacity: 0.8 }}
                onClick={() => setComment(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </details>
      </div>

      {(mine || isInstructor) && !revising ? (
        <div className="flex flex-wrap gap-xs no-print" style={{ marginTop: 12 }}>
          {mine ? (
            <>
              <button
                type="button"
                className="btn-tertiary"
                style={{ fontSize: 13, minHeight: 32 }}
                onClick={() => {
                  setReviseText(latest?.content ?? '')
                  setRevising(true)
                }}
              >
                고치기
              </button>
              <button
                type="button"
                className="btn-tertiary"
                style={{ fontSize: 13, minHeight: 32 }}
                onClick={() => {
                  if (confirm('이 글을 지웁니다. 되돌릴 수 없습니다.')) {
                    void repo?.deletePost(classId, lessonId, stepId, post.id, user!.uid)
                  }
                }}
              >
                삭제
              </button>
            </>
          ) : null}
          {isInstructor ? (
            <>
              <button
                type="button"
                className="btn-tertiary"
                style={{ fontSize: 13, minHeight: 32 }}
                onClick={() => void repo?.pinPost(classId, lessonId, stepId, post.id, !post.isPinned)}
              >
                {post.isPinned ? '고정 해제' : '함께 보기(고정)'}
              </button>
              <button
                type="button"
                className="btn-tertiary"
                style={{ fontSize: 13, minHeight: 32 }}
                onClick={() => {
                  // 강사는 삭제하지 않는다. 숨김이고, 작성자에게 사유가 보인다.
                  const reason = post.isHidden ? '' : prompt('숨김 사유를 적어 주세요.') || ''
                  if (!post.isHidden && !reason) return
                  void repo?.hidePost(classId, lessonId, stepId, post.id, !post.isHidden, reason)
                }}
              >
                {post.isHidden ? '숨김 해제' : '숨김'}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {revising ? (
        <div className="flex flex-col gap-xs no-print" style={{ marginTop: 12 }}>
          <textarea
            className="field"
            rows={4}
            value={reviseText}
            aria-label="수정한 내용"
            onChange={(e) => setReviseText(e.target.value)}
          />
          <p className="caption">고치면 올려 둔 글이 이 내용으로 바뀝니다.</p>
          <div className="flex gap-xs">
            <Button onClick={() => void saveRevision()}>저장</Button>
            <Button variant="tertiary" onClick={() => setRevising(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  )
}
