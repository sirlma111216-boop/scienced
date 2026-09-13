import { createContext, useContext } from 'react'
import type { TheoryEntry } from '@/content/types'

/**
 * 이론 배경을 본문에 이어 주는 통로 (5차 K.3).
 *
 * 본문의 쉬운 말에 점선 밑줄을 긋고 누르면 정식 용어 카드가 뜬다.
 * 그 카드가 「이론 배경에서 자세히 보기」를 누르면 차시의 이론 배경 화면으로 간다.
 * 본문을 그리는 부품(개념 카드 등)이 차시의 이론 항목과 그 이동 방법을 알아야 하므로
 * 여기서 한 번에 내려보낸다. prop 으로 층층이 넘기면 카드 하나 고칠 때마다 다섯 곳을 고친다.
 */
export interface TheoryContextValue {
  entries: TheoryEntry[]
  /** 이론 배경 화면의 해당 항목으로 간다. 없으면 팝오버에 그 단추가 나오지 않는다. */
  openEntry?: (entryId: string) => void
}

const TheoryContext = createContext<TheoryContextValue>({ entries: [] })

export const TheoryProvider = TheoryContext.Provider

export function useTheory(): TheoryContextValue {
  return useContext(TheoryContext)
}
