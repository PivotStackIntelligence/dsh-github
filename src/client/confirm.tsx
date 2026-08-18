/**
 * Inline confirm / prompt modal used for destructive operations and
 * single-step creation flows. It traps focus, closes on Escape, and returns
 * focus to the previously focused element on unmount. No external UI library.
 * Author: bugmaker2 · PivotStack Intelligence
 */
import { useEffect, useRef, useState } from 'react'

/** One form field rendered inside the modal (input or checkbox). */
export interface ConfirmField {
  id: string
  kind: 'input' | 'checkbox'
  /** aria-label for inputs, visible label for checkboxes. */
  label: string
  /** Placeholder for inputs. */
  placeholder?: string
  /** Initial value (string for input, boolean for checkbox). */
  initial?: string | boolean
}

export interface ConfirmModalProps {
  title: string
  message: string
  detail?: string
  fields?: ConfirmField[]
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
  onConfirm: (values: Record<string, string>, checks: Record<string, boolean>) => void
  onCancel: () => void
}

/** Render a self-contained confirm / prompt modal. */
export function ConfirmModal({
  title, message, detail, fields = [], confirmLabel, cancelLabel, danger = false, onConfirm, onCancel,
}: ConfirmModalProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const field of fields) if (field.kind === 'input') initial[field.id] = typeof field.initial === 'string' ? field.initial : ''
    return initial
  })
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const field of fields) if (field.kind === 'checkbox') initial[field.id] = field.initial === true
    return initial
  })
  const rootRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    confirmRef.current?.focus()
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCancel()
        return
      }
      if (event.key !== 'Tab' || rootRef.current === null) return
      const focusable = [...rootRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')]
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      const active = document.activeElement
      if (event.shiftKey && active === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      previousFocus.current?.focus()
    }
  }, [onCancel])

  return <div className="dsh-github-modal-root" role="dialog" aria-modal="true" aria-label={title}>
    <div className="dsh-github-modal-mask" onClick={onCancel} />
    <div className={`dsh-github-modal${danger ? ' danger' : ''}`} ref={rootRef}>
      <h3 className="dsh-github-modal-title">{title}</h3>
      <p className="dsh-github-modal-message">{message}</p>
      {detail ? <p className="dsh-github-modal-detail">{detail}</p> : null}
      {fields.length > 0 ? <div className="dsh-github-modal-fields">
        {fields.map(field => field.kind === 'input'
          ? <input key={field.id} className="dsh-github-modal-input" value={values[field.id] ?? ''} placeholder={field.placeholder ?? field.label} aria-label={field.label} onChange={event => setValues(previous => ({ ...previous, [field.id]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); confirmRef.current?.click() } }} />
          : <label key={field.id} className="dsh-github-modal-checkbox"><input type="checkbox" checked={checks[field.id] ?? false} onChange={event => setChecks(previous => ({ ...previous, [field.id]: event.target.checked }))} /><span>{field.label}</span></label>)}
      </div> : null}
      <div className="dsh-github-modal-actions">
        <button type="button" className="dsh-github-btn" onClick={onCancel}>{cancelLabel}</button>
        <button type="button" ref={confirmRef} className={`dsh-github-btn${danger ? ' danger' : ' primary'}`} onClick={() => onConfirm(values, checks)}>{confirmLabel}</button>
      </div>
    </div>
  </div>
}
