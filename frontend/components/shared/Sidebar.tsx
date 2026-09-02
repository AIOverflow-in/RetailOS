'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useDispatch } from 'react-redux'
import { clearAuth } from '@/store/authSlice'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Receipt, Package, ClipboardList, BarChart2,
  Users, LogOut, Plus, Settings, Truck,
  PanelLeftOpen, PanelLeftClose, Menu, X,
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',    label: 'Dashboard',    Icon: LayoutDashboard },
  { href: '/billing',      label: 'Billing',      Icon: Receipt },
  { href: '/inventory',    label: 'Inventory',    Icon: Package },
  { href: '/distributors', label: 'Distributors', Icon: Truck },
  { href: '/orders',       label: 'Orders',       Icon: ClipboardList },
  { href: '/customers',    label: 'Customers',    Icon: Users },
  { href: '/reports',      label: 'Reports',      Icon: BarChart2 },
  { href: '/settings',     label: 'Settings',     Icon: Settings },
]

/* Shared by the desktop text panel and the mobile drawer. Row height and icon size
   step down at lg so the desktop panel keeps its original dimensions exactly. */
function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 px-2 py-2 space-y-[1px] overflow-y-auto">
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'group flex items-center gap-2 px-2 py-2.5 lg:py-[6px] rounded-md transition-colors',
              active ? 'bg-[#F2F2F2]' : 'hover:bg-[#F7F7F7]'
            )}
          >
            <Icon
              strokeWidth={active ? 2 : 1.5}
              className={cn(
                'w-4 h-4 lg:w-3.5 lg:h-3.5 shrink-0 transition-colors',
                active ? 'text-[#111]' : 'text-[#AAAAAA] group-hover:text-[#333]'
              )}
            />
            <span className={cn(
              'flex-1 text-body transition-colors',
              active ? 'text-[#111] font-semibold' : 'text-[#666] group-hover:text-[#111]'
            )}>
              {label}
            </span>
            <Plus
              strokeWidth={1.5}
              className="w-3 h-3 text-[#DDDDDD] group-hover:text-[#AAAAAA] transition-colors"
            />
          </Link>
        )
      })}
    </nav>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const dispatch = useDispatch()
  const [shopName, setShopName] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    setShopName(localStorage.getItem('shop_name'))
    setExpanded(localStorage.getItem('sidebar_collapsed') !== '1')
  }, [])

  // Close the drawer on navigation, and whenever the viewport grows past lg.
  useEffect(() => { setDrawerOpen(false) }, [pathname])
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => mq.matches && setDrawerOpen(false)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Don't let the page scroll behind an open drawer.
  useEffect(() => {
    if (!drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [drawerOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const activeNav = NAV.find(({ href }) => pathname.startsWith(href))

  function toggleExpanded() {
    setExpanded(v => {
      localStorage.setItem('sidebar_collapsed', v ? '1' : '0')
      return !v
    })
  }

  function logout() {
    dispatch(clearAuth())
    router.replace('/login')
  }

  return (
    <>
      {/* ── Mobile top bar (below lg) ──────────── */}
      <header className="lg:hidden shrink-0 flex items-center gap-2 h-12 px-2 bg-white border-b border-[#EBEBEB] print:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-[#666] hover:bg-black/[0.06] transition-colors"
        >
          <Menu strokeWidth={1.5} className="w-5 h-5" />
        </button>
        <p suppressHydrationWarning className="flex-1 text-body font-semibold text-[#111] truncate">
          {activeNav?.label ?? shopName ?? 'SellOS'}
        </p>
        <button
          onClick={logout}
          aria-label="Sign out"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-[#999] hover:bg-black/[0.06] hover:text-[#333] transition-colors"
        >
          <LogOut strokeWidth={1.5} className="w-[18px] h-[18px]" />
        </button>
      </header>

      {/* ── Mobile drawer ─────────────────────── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 print:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[264px] max-w-[85vw] flex flex-col bg-white shadow-xl">
            <div className="flex items-center gap-2 px-3 h-12 border-b border-[#EBEBEB] shrink-0">
              <div className="w-7 h-7 rounded-lg bg-[#111] flex items-center justify-center shrink-0">
                <span className="text-white text-caption font-bold tracking-tight">S</span>
              </div>
              <p suppressHydrationWarning className="flex-1 text-body font-semibold text-[#111] truncate">
                {shopName ?? 'SellOS'}
              </p>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-[#999] hover:bg-black/[0.06] transition-colors"
              >
                <X strokeWidth={1.5} className="w-5 h-5" />
              </button>
            </div>

            <NavList pathname={pathname} onNavigate={() => setDrawerOpen(false)} />

            <div className="px-2 py-2 border-t border-[#F0F0F0] shrink-0">
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-2 py-2.5 rounded-md text-body-sm text-[#888] hover:bg-[#F7F7F7] hover:text-[#333] transition-colors"
              >
                <LogOut strokeWidth={1.5} className="w-4 h-4 shrink-0" />
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Desktop sidebar (lg and up) — unchanged ─ */}
      <div className="hidden lg:flex h-screen shrink-0 print:hidden">

      {/* ── Icon rail ─────────────────────────── */}
      <aside className="flex flex-col w-[56px] shrink-0 bg-[#F0F0F0] items-center pt-3 pb-4 gap-1">

        {/* Logo */}
        <div className="w-8 h-8 rounded-xl bg-[#111] flex items-center justify-center mb-2 shrink-0">
          <span className="text-white text-caption font-bold tracking-tight">R</span>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleExpanded}
          title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-[#999] hover:bg-black/[0.06] hover:text-[#333] transition-all shrink-0 mb-1"
        >
          {expanded
            ? <PanelLeftClose strokeWidth={1.5} className="w-4 h-4" />
            : <PanelLeftOpen  strokeWidth={1.5} className="w-4 h-4" />}
        </button>

        {/* Nav icons */}
        {NAV.map(({ href, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={href.slice(1)}
              className={cn(
                'w-8 h-8 flex items-center justify-center rounded-xl transition-all shrink-0',
                active ? 'bg-[#111] text-white' : 'text-[#999] hover:bg-black/[0.06] hover:text-[#333]'
              )}
            >
              <Icon strokeWidth={active ? 2 : 1.5} className="w-4 h-4" />
            </Link>
          )
        })}

        <div className="flex-1" />

        {/* User avatar */}
        <button
          onClick={logout}
          title="Sign out"
          suppressHydrationWarning
          className="w-7 h-7 rounded-full bg-[#555] flex items-center justify-center text-white text-caption-sm font-semibold hover:bg-[#111] transition-colors shrink-0"
        >
          {shopName?.[0]?.toUpperCase() ?? 'U'}
        </button>
      </aside>

      {/* ── Text panel ────────────────────────── */}
      {expanded && (
      <aside className="flex flex-col w-[224px] shrink-0 bg-white border-r border-[#EBEBEB]">

        {/* Header — shop name + active page tab */}
        <div className="px-4 pt-[14px] border-b border-[#EBEBEB]">
          <div className="flex items-center justify-between mb-[10px]">
            <p suppressHydrationWarning className="text-body font-semibold text-[#111] truncate leading-tight">
              {shopName ?? 'SellOS'}
            </p>
            <LogOut
              strokeWidth={1.5}
              onClick={logout}
              className="w-3 h-3 text-[#CCCCCC] shrink-0 cursor-pointer hover:text-[#333] transition-colors ml-2"
            />
          </div>
          {/* Active page tab — underline style like the reference */}
          <div className="flex gap-4">
            {activeNav && (
              <span className="text-body-sm font-medium text-[#111] pb-[9px] border-b-[1.5px] border-[#111]">
                {activeNav.label}
              </span>
            )}
            <span className="text-body-sm text-[#BBBBBB] pb-[9px]">SellOS</span>
          </div>
        </div>

        {/* Nav items */}
        <NavList pathname={pathname} />

        {/* Sign out row */}
        <div className="px-2 py-2.5 border-t border-[#F0F0F0]">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-2 py-[6px] rounded-md text-body-sm text-[#AAAAAA] hover:bg-[#F7F7F7] hover:text-[#333] transition-colors"
          >
            <LogOut strokeWidth={1.5} className="w-3.5 h-3.5 shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      )}
      </div>
    </>
  )
}
