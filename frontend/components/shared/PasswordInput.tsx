'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  className?: string
  autoComplete?: string
  required?: boolean
  autoFocus?: boolean
}

export default function PasswordInput({
  value,
  onChange,
  className = '',
  autoComplete = 'current-password',
  required,
  autoFocus,
}: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        className={`${className} pr-9`}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#CCCCCC] hover:text-[#555] transition-colors"
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}
