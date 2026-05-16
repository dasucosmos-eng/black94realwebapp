'use client'

import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   ExpandableText

   Truncates long text after N lines. Tap "See more" to expand.

   - Local state (no external store — zero dependency)
   - Real <button> for reliable click/touch handling
   - scrollHeight > clientHeight for overflow detection
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ExpandableTextProps {
  id: string
  text: string
  maxLines?: number
  className?: string
  style?: React.CSSProperties
  linkColor?: string
  renderContent?: (text: string) => ReactNode
}

export function ExpandableText({
  id,
  text,
  maxLines = 4,
  className,
  style,
  linkColor = '#FFFFFF',
  renderContent,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false)
  /* undefined = not yet measured, false = measured & fits, true = measured & overflows */
  const [needsTruncation, setNeedsTruncation] = useState<boolean | undefined>(undefined)
  const textRef = useRef<HTMLDivElement>(null)

  /* ── Detect overflow after mount ── */
  useEffect(() => {
    const el = textRef.current
    if (!el || !text) {
      setNeedsTruncation(false)
      return
    }
    const raf = requestAnimationFrame(() => {
      setNeedsTruncation(el.scrollHeight > el.clientHeight + 2)
    })
    return () => cancelAnimationFrame(raf)
  }, [text, maxLines])

  if (!text) return null

  /* ── Short text → just render it (only after measurement confirms it fits) ── */
  if (needsTruncation === false && !expanded) {
    return (
      <div className={className} style={style}>
        {renderContent ? renderContent(text) : text}
      </div>
    )
  }

  return (
    <div className={cn('relative', className)} style={style}>
      <div
        ref={textRef}
        className="whitespace-pre-wrap break-words"
        style={
          expanded
            ? { display: 'block', overflow: 'visible' }
            : {
                display: '-webkit-box',
                WebkitLineClamp: String(maxLines),
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden',
              }
        }
      >
        {renderContent ? renderContent(text) : text}
      </div>

      {needsTruncation && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          className={cn(
            'inline cursor-pointer select-none font-semibold',
            'bg-transparent border-none p-0 m-0',
            'hover:underline focus-visible:outline-none',
            'focus-visible:ring-2 focus-visible:ring-[#FFFFFF]/50',
            'focus-visible:ring-offset-1 rounded-sm ml-0.5'
          )}
          style={{ color: linkColor, fontSize: 'inherit', lineHeight: 'inherit' }}
        >
          {expanded ? 'See less' : 'See more'}
        </button>
      )}
    </div>
  )
}

export default ExpandableText
