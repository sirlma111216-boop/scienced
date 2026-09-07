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
import type { Post } from '@/lib/types'
import { Badge, Button, Caption, Notice } from '@/components/ui'

/**
 * 의견 광장.
 *
 * 기존 담벼락의 골격을 그대로 쓴다: 활동 하단의 버튼 줄 → 모달 → 벽돌 배치,
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
}: {
  classId: string
  lessonId: LessonId
  stepId: string
  prompt: string
  /** 본인이 이 단계 응답을 제출했는가 */
  unlocked: boolean
}) {
  const { repo } = useAuth()
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

  return (
    <>
      <div className="flex flex-wrap items-center gap-md no-print">
        <Button onClick={() => setComposing(true)}>공유하기</Button>
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
  onClose,
  onDone,
}: {
  classId: string
  lessonId: LessonId
  stepId: string
  prompt: string
  onClose: () => void
  onDone: () => void
}) {
  const { user, repo } = useAuth()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!repo || !user) return
    if (!text.trim()) {
      setError('내용을 적어 주세요.')
      return
    }
    await repo.addPost(classId, lessonId, stepId, {
      uid: user.uid,
      nickname: user.nickname || '이름 없음',
      groupId: user.groupId,
      content: text.trim(),
    })
    await repo.bumpParticipation(classId, user.uid, {})
    onDone()
  }

  return (
    <Dialog title="내 생각 공유하기" onClose={onClose}>
      <p className="text-body-sm" style={{ opacity: 0.72, marginBottom: 12 }}>
        {prompt}
      </p>
      <textarea
        className="field"
        rows={6}
        value={text}
        aria-label="공유할 내용"
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
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
        <Button onClick={() => void submit()}>올리기</Button>
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
      case 'pinned':
        sorted.sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.createdAt - a.createdAt)
        break
      case 'mine':
        sorted.sort((a, b) => {
          const am = Object.values(a.reactions ?? {}).some((u) => u.includes(mine ?? ''))
          const bm = Object.values(b.reactions ?? {}).some((u) => u.includes(mine ?? ''))
          return Number(bm) - Number(am) || b.createdAt - a.createdAt
        })
        break
      case 'group':
        sorted.sort((a, b) => {
          const g = user?.groupId
          return Number(b.groupId === g) - Number(a.groupId === g) || b.createdAt - a.createdAt
        })
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
  const [revising, setRevising] = useState(false)
  const [reviseText, setReviseText] = useState('')
  const [reviseReason, setReviseReason] = useState('')

  const latest = post.versions[post.versions.length - 1]
  const mine = user?.uid === post.uid
  const myReaction = REACTIONS.find((r) => (post.reactions?.[r.key] ?? []).includes(user?.uid ?? ''))
  const comments = showAllComments ? post.comments : post.comments.slice(-4)

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

  async function saveRevision() {
    if (!repo || !reviseText.trim() || !reviseReason.trim()) return
    await repo.revisePost(classId, lessonId, stepId, post.id, reviseText.trim(), reviseReason.trim())
    setRevising(false)
  }

  return (
    <article
      className="bg-canvas rounded-lg"
      style={{
        boxShadow: `inset 0 0 0 ${post.isPinned ? 2 : 1}px ${post.isPinned ? '#000' : '#e6e6e6'}`,
        padding: 16,
        marginBottom: 16,
        breakInside: 'avoid',
      }}
    >
      <div className="flex items-center gap-xs" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <span className="text-body-sm" style={{ fontWeight: 480 }}>
          {post.nickname}
        </span>
        <Caption>{relativeTime(post.createdAt)}</Caption>
        {post.latestV > 1 ? <Badge>v{post.latestV}</Badge> : null}
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

      <dl style={{ margin: 0 }}>
        <dt className="caption">내용</dt>
        <dd className="text-body" style={{ margin: '4px 0 12px', whiteSpace: 'pre-wrap' }}>
          {latest?.content}
        </dd>
        {post.latestV > 1 && latest?.changedReason ? (
          <>
            <dt className="caption">무엇을 왜 바꿨는가</dt>
            <dd className="text-body-sm" style={{ margin: '4px 0 12px', opacity: 0.78 }}>
              {latest.changedReason}
            </dd>
          </>
        ) : null}
      </dl>

      {/* 반응 4종. 좋아요 없음, 인기순 없음. */}
      <div className="flex flex-wrap gap-xs no-print" style={{ marginBottom: 12 }}>
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
              onClick={() => void react(r.key)}
              style={{ fontSize: 14, minHeight: 40, padding: '6px 12px' }}
            >
              <span className="font-mono" aria-hidden style={{ marginRight: 4 }}>
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
          {post.comments.length > 4 && !showAllComments ? (
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
        <div className="flex gap-xs" style={{ marginBottom: 8 }}>
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
            style={{ minHeight: 44 }}
          />
          <Button variant="secondary" onClick={() => void send()}>
            남기기
          </Button>
        </div>
        <div className="flex flex-wrap gap-xxs">
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
                새 버전으로 수정
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
          <input
            className="field"
            type="text"
            value={reviseReason}
            aria-label="무엇을 왜 바꿨는가"
            placeholder="무엇을 왜 바꿨는가 (필수)"
            onChange={(e) => setReviseReason(e.target.value)}
          />
          <p className="caption">이전 버전은 지워지지 않고 함께 남습니다.</p>
          <div className="flex gap-xs">
            <Button onClick={() => void saveRevision()}>v{post.latestV + 1}로 저장</Button>
            <Button variant="tertiary" onClick={() => setRevising(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  )
}
