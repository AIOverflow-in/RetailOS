'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch } from 'react-redux'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { setAuth } from '@/store/authSlice'
import PasswordInput from '@/components/shared/PasswordInput'

export default function LoginPage() {
  const router = useRouter()
  const dispatch = useDispatch()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.login(username, password)
      dispatch(setAuth(res))
      router.replace('/dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full h-9 px-3 text-body border border-[#E5E5E5] rounded-lg bg-white text-foreground focus:outline-none focus:border-[#CCCCCC] transition-colors placeholder:text-[#CCC]"

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] px-4">
      <div className="w-full max-w-[320px]">

        {/* Logo */}
        <div className="mb-7 text-center">
          <h1 className="text-heading-sm font-bold tracking-tight text-foreground">RetailOS</h1>
          <p className="text-body-sm text-[#AAAAAA] mt-1">Sign in to your shop</p>
        </div>

        <div className="bg-white rounded-xl border border-[#E8E8E8] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-caption font-medium text-[#AAAAAA]">Username</p>
              <input
                className={inputClass}
                autoFocus
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-caption font-medium text-[#AAAAAA]">Password</p>
              <PasswordInput
                className={inputClass}
                value={password}
                onChange={setPassword}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 mt-1 text-body font-medium bg-foreground text-white rounded-lg hover:bg-foreground/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
