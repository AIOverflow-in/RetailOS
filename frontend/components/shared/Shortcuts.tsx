'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Keyboard } from 'lucide-react'
import { NAV } from '@/components/shared/Sidebar'
import { focusField } from '@/lib/focusField'

const GROUPS: { title: string; items: [keys: string, what: string][] }[] = [
  {
    title: 'Go to',
    items: [
      ...NAV.map(({ label }, i): [string, string] => [`Alt + ${i + 1}`, label]),
      ['Alt + N', 'New bill (first product box)'],
      ['/', 'Search on this page'],
    ],
  },
  {
    title: 'Billing',
    items: [
      ['F2 / Alt + P', 'Customer phone'],
      ['Enter', 'Pick product → Qty'],
      ['Enter (Qty / Price)', 'Next line'],
      ['Alt + D', 'Delete this line'],
      ['Ctrl + Enter', 'Place order'],
    ],
  },
  { title: 'Help', items: [['?', 'Show / hide this panel']] },
]

const POS_KEY = 'shortcuts_pos'
const BTN = 40

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

export default function Shortcuts() {
  const router = useRouter()
  const pathname = usePathname()
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  // Offsets from the left/bottom of the viewport; default sits right of the icon rail and above the sidebar's Sign out row.
  const [pos, setPos] = useState({ left: 68, bottom: 64 })
  const drag = useRef<{ x: number; y: number; left: number; bottom: number; moved: boolean } | null>(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null')
      if (saved && typeof saved.left === 'number' && typeof saved.bottom === 'number') setPos(saved)
    } catch {}
    // A smaller window than when it was placed must not leave the button off-screen.
    const clamp = () => setPos(p => ({
      left: Math.min(p.left, Math.max(0, window.innerWidth - BTN)),
      bottom: Math.min(p.bottom, Math.max(0, window.innerHeight - BTN)),
    }))
    clamp()
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPinned(false); return }
      // e.code, not e.key: Option+digit on a Mac types symbols.
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const n = /^Digit([1-9])$/.exec(e.code)
        if (n && NAV[+n[1] - 1]) { e.preventDefault(); router.push(NAV[+n[1] - 1].href); return }
        if (e.code === 'KeyN') {
          e.preventDefault()
          if (pathname.startsWith('/billing')) focusField(null, 'product')
          else router.push('/billing')
          return
        }
        if (e.code === 'KeyP') { e.preventDefault(); document.querySelector<HTMLElement>('[data-field="phone"]')?.focus(); return }
      }
      if (e.key === 'F2') { e.preventDefault(); document.querySelector<HTMLElement>('[data-field="phone"]')?.focus(); return }
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
      const isQuestion = e.key === '?' || (e.code === 'Slash' && e.shiftKey)
      if (e.key === '/' && !isQuestion) {
        const el = document.querySelector<HTMLElement>('[data-search]')
        if (el) { e.preventDefault(); el.focus() }
      } else if (isQuestion) {
        setPinned(p => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router, pathname])

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, left: pos.left, bottom: pos.bottom, moved: false }
  }
  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 4) return
    d.moved = true
    setPos({
      left: Math.min(Math.max(0, d.left + dx), window.innerWidth - BTN),
      bottom: Math.min(Math.max(0, d.bottom - dy), window.innerHeight - BTN),
    })
  }
  function onPointerUp() {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.moved) {
      try { localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch {}
    } else {
      setPinned(p => !p)
    }
  }

  const open = hover || pinned
  // Open the card towards the side with room.
  const down = typeof window !== 'undefined' && window.innerHeight - pos.bottom - BTN < 380
  const right = typeof window !== 'undefined' && pos.left > window.innerWidth - 300

  return (
    <div
      className="hidden lg:block fixed z-50 print:hidden"
      style={{ left: pos.left, bottom: pos.bottom }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {open && (
        <div className={`absolute ${down ? 'top-full pt-2' : 'bottom-full pb-2'} ${right ? 'right-0' : 'left-0'}`}>
          <div className="w-64 max-h-[85vh] overflow-y-auto bg-white border border-[#EBEBEB] rounded-lg shadow-xl p-3 space-y-3">
            {GROUPS.map(g => (
              <div key={g.title}>
                <p className="text-caption font-medium text-label mb-1">{g.title}</p>
                {g.items.map(([keys, what]) => (
                  <div key={keys + what} className="flex items-center justify-between gap-2 py-0.5">
                    <span className="text-body-sm text-[#555]">{what}</span>
                    <kbd className="shrink-0 text-[11px] font-mono px-1.5 py-0.5 rounded border border-[#E5E5E5] bg-[#F7F7F7] text-[#333]">{keys}</kbd>
                  </div>
                ))}
              </div>
            ))}
            <p className="text-caption text-[#AAAAAA]">Drag the button to move it.</p>
          </div>
        </div>
      )}
      <button
        type="button"
        aria-label="Keyboard shortcuts"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="w-[40px] h-[40px] flex items-center justify-center rounded-full bg-[#111] text-white shadow-lg cursor-grab active:cursor-grabbing touch-none select-none hover:bg-[#333] transition-colors"
      >
        <Keyboard strokeWidth={1.5} className="w-4 h-4" />
      </button>
    </div>
  )
}
