import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'

/**
 * 강사 화면 배경음악 — 교사 연수용 웹앱(2022co)의 MusicToggle 을 그대로 옮겼다.
 *
 * 음원을 배포에 올리지 않는다. 강사 노트북의 파일을 그 자리에서 열어 브라우저가 직접 재생한다 —
 * 그래서 Cloudflare 의 용량 제한도, 리포 용량도, 음질을 깎을 이유도 없다.
 * 학생은 이 컴포넌트를 아예 받지 않는다 (진행 콘솔에서만 그린다).
 *
 * 버튼은 하나다. 파일이 아직 없으면 첫 번째 누름이 파일 선택창을 열고, 그 뒤로는 켜기/끄기만 반복한다.
 * 기본은 꺼진 상태다.
 */
export function MusicToggle() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const [name, setName] = useState('')
  const [playing, setPlaying] = useState(false)

  // 떠날 때 blob 주소를 돌려준다 — 안 그러면 파일이 메모리에 계속 남는다
  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  const load = (file: File) => {
    const a = audioRef.current
    if (!a) return
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = URL.createObjectURL(file)
    a.src = urlRef.current
    a.loop = true // 한 시간짜리로 두 시간을 덮으려면 돌아야 한다
    a.volume = 0.5 // 말소리를 덮지 않을 정도로 시작한다. 더 키우려면 시스템 볼륨.
    setName(file.name)
    void a.play().catch(() => {
      /* 브라우저가 막으면 다음 누름에 다시 시도한다 */
    })
  }

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (!urlRef.current) {
      inputRef.current?.click()
      return
    }
    if (a.paused) void a.play().catch(() => {})
    else a.pause()
  }

  return (
    <>
      <Button
        variant={playing ? 'primary' : 'tertiary'}
        aria-pressed={playing}
        onClick={toggle}
        title={name ? `${name} — 다른 곡으로 바꾸려면 새로고침` : '노트북에 있는 음악 파일을 고릅니다'}
      >
        ♫ 음악 {playing ? '끄기' : '켜기'}
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) load(f)
          e.target.value = '' // 같은 파일을 다시 골라도 change 가 뜨게 한다
        }}
      />
      {/* 상태는 엘리먼트가 알려 주는 것만 믿는다 — 재생이 막히면 버튼도 꺼진 채로 있어야 한다 */}
      <audio ref={audioRef} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    </>
  )
}
