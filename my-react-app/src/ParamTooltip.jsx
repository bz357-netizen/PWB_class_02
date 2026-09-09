import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const DELAY_MS = 700

export default function ParamTooltip({ label, help }) {
  const anchorRef = useRef(null)
  const timerRef = useRef(0)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, flip: false })

  const clearTimer = () => {
    window.clearTimeout(timerRef.current)
    timerRef.current = 0
  }

  const hide = () => {
    clearTimer()
    setOpen(false)
  }

  const scheduleShow = () => {
    if (!help) return
    clearTimer()
    timerRef.current = window.setTimeout(() => {
      const box = anchorRef.current?.getBoundingClientRect()
      if (!box) return
      const flip = box.left < 240
      setPos({
        top: box.top + box.height / 2,
        left: flip ? box.right + 8 : box.left - 8,
        flip,
      })
      setOpen(true)
    }, DELAY_MS)
  }

  useEffect(() => () => clearTimer(), [])

  useEffect(() => {
    hide()
  }, [label, help])

  useEffect(() => {
    if (!open) return undefined
    const onScroll = () => hide()
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [open])

  if (!help) {
    return <span className="slider-label">{label}</span>
  }

  return (
    <>
      <span
        ref={anchorRef}
        className="slider-label has-help"
        onMouseEnter={scheduleShow}
        onMouseLeave={hide}
        onFocus={scheduleShow}
        onBlur={hide}
      >
        {label}
      </span>
      {open
        ? createPortal(
            <div
              className={`param-tooltip${pos.flip ? ' is-end' : ''}`}
              role="tooltip"
              style={{
                top: pos.top,
                left: pos.left,
              }}
            >
              {help}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
