import { useEffect, useRef } from 'react'
import { saveProgress, startProgress } from './progress_store'

const DEBOUNCE_MS = 500

/**
 * Saves the step the person is looking at, half a second after they stop moving.
 *
 * Nothing is saved on first render: opening the walkthrough must not overwrite a saved step
 * before the person had the chance to continue from it. When the step first changes, the step
 * they started on is saved too, so it counts as viewed.
 */
export function useSaveProgress(procedureSlug: string, stepIndex: number, totalSteps: number) {
  const startStep = useRef(stepIndex)
  const startSaved = useRef(false)
  const latest = useRef({ procedureSlug, stepIndex, totalSteps })
  const pending = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    latest.current = { procedureSlug, stepIndex, totalSteps }
  }, [procedureSlug, stepIndex, totalSteps])

  useEffect(() => {
    startProgress()
  }, [])

  useEffect(() => {
    if (stepIndex === startStep.current && !startSaved.current) return
    if (!startSaved.current) {
      startSaved.current = true
      saveProgress(procedureSlug, startStep.current, totalSteps)
    }
    pending.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      pending.current = false
      saveProgress(procedureSlug, stepIndex, totalSteps)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer.current)
  }, [procedureSlug, stepIndex, totalSteps])

  // Do not lose the last move when the person leaves the page
  useEffect(() => {
    const flush = () => {
      if (!pending.current) return
      pending.current = false
      const { procedureSlug: slug, stepIndex: step, totalSteps: total } = latest.current
      saveProgress(slug, step, total)
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])
}
