'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  total: number
  limit: number
  onChange: (page: number) => void
}

function getPages(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  if (current <= 4) return [1, 2, 3, 4, 5, '…', total]
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]

  return [1, '…', current - 1, current, current + 1, '…', total]
}

export default function Pagination({ page, total, limit, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  const from = (page - 1) * limit + 1
  const to   = Math.min(page * limit, total)
  const pages = getPages(page, totalPages)

  return (
    <div className="flex items-center justify-between pt-1">

      {/* Count */}
      <p className="text-body-sm text-[#AAAAAA]">
        Showing <span className="text-[#555] font-medium">{from}–{to}</span> of{' '}
        <span className="text-[#555] font-medium">{total.toLocaleString()}</span>
      </p>

      {/* Page buttons */}
      <div className="flex items-center gap-1">

        {/* Prev */}
        <button
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[#999] hover:bg-[#F2F2F2] hover:text-[#111] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Page numbers */}
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-body-sm text-[#CCCCCC]">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-md text-body-sm font-medium transition-colors',
                p === page
                  ? 'bg-[#111] text-white'
                  : 'text-[#666] hover:bg-[#F2F2F2] hover:text-[#111]'
              )}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[#999] hover:bg-[#F2F2F2] hover:text-[#111] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
