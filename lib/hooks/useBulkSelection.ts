"use client"

import { useCallback, useMemo, useState } from "react"

/**
 * Generalized multi-select for bulk-cleanup flows (Mindful Purge, Deep Clean,
 * and the theme-unique purges). One selection Set drives all of them —
 * only the copy/target/suggested-ID source differs per theme.
 */
export function useBulkSelection(allIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const isSelected = useCallback((id: string) => selected.has(id), [selected])

  const selectAll = useCallback(() => {
    setSelected(new Set(allIds))
  }, [allIds])

  /** Select a specific subset (e.g. "select all suggested" within a larger candidate list). */
  const selectOnly = useCallback((ids: string[]) => {
    setSelected(new Set(ids))
  }, [])

  const clear = useCallback(() => {
    setSelected(new Set())
  }, [])

  const allSelected = useMemo(
    () => allIds.length > 0 && allIds.every(id => selected.has(id)),
    [allIds, selected],
  )

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(allIds))
  }, [allSelected, allIds])

  return {
    selected,
    count: selected.size,
    isSelected,
    toggle,
    selectAll,
    selectOnly,
    clear,
    allSelected,
    toggleAll,
  }
}
