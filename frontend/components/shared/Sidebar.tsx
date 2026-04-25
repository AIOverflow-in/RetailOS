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
  PanelLeftOpen, PanelLeftClose,
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

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const dispatch = useDispatch()
  const [shopName, setShopName] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    setShopName(localStorage.getItem('shop_name'))
  }, [])

  const activeNav = NAV.find(({ href }) => pathname.startsWith(href))

  function logout() {
    dispatch(clearAuth())
    router.replace('/login')
  }

  return (
    <div className="flex h-screen shrink-0 print:hidden">

      {/* ── Icon rail ─────────────────────────── */}
      <aside className="flex flex-col w-[56px] shrink-0 bg-[#F0F0F0] items-center pt-3 pb-4 gap-1">

        {/* Logo */}
        <div className="w-8 h-8 rounded-xl bg-[#111] flex items-center justify-center mb-2 shrink-0">
          <span className="text-white text-caption font-bold tracking-tight">R</span>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
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
              {shopName ?? 'RetailOS'}
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
            <span className="text-body-sm text-[#BBBBBB] pb-[9px]">RetailOS</span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-2 space-y-[1px] overflow-y-auto">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'group flex items-center gap-2 px-2 py-[6px] rounded-md transition-colors',
                  active ? 'bg-[#F2F2F2]' : 'hover:bg-[#F7F7F7]'
                )}
              >
                <Icon
                  strokeWidth={active ? 2 : 1.5}
                  className={cn(
                    'w-3.5 h-3.5 shrink-0 transition-colors',
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
  )
}
