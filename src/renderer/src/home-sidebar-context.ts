import { createContext, useContext } from 'react'

export type SourceFilter = 'all' | 'github' | 'gitlab' | 'local'

export type HomeSidebarState = {
  sourceFilter: SourceFilter
  setSourceFilter: (filter: SourceFilter) => void
}

export const HomeSidebarContext = createContext<HomeSidebarState>({
  sourceFilter: 'all',
  setSourceFilter: () => undefined
})

export function useHomeSidebar(): HomeSidebarState {
  return useContext(HomeSidebarContext)
}
