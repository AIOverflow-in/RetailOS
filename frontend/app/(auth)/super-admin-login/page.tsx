'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Shield, Mail, Lock, KeyRound, ArrowRight, Loader2 } from 'lucide-react'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export default function SuperAdminLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/super-admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      setSessionId(data.session_id)
      setStep('otp')
      toast.success('OTP sent to your registered email')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/super-admin/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, otp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid OTP')
      localStorage.setItem('sa_token', data.token)
      toast.success('Welcome, Super Admin')
      router.replace('/super-admin')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'OTP verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F4F4] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-[#111]">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-[#111]">Super Admin</h1>
            <p className="text-[13px] text-[#999] mt-0.5">RetailOS internal access</p>
          </div>
        </div>

        {step === 'credentials' ? (
          <form onSubmit={handleCredentials} className="bg-white rounded-xl border border-[#EBEBEB] p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#BBBBBB]">Username</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CCCCCC]" />
                <input
                  type="text"
                  autoFocus
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="chethanadmin"
                  className="w-full h-9 pl-9 pr-3 text-[13px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#AAAAAA] transition-colors placeholder:text-[#DDDDDD]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#BBBBBB]">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CCCCCC]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-9 pl-9 pr-3 text-[13px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#AAAAAA] transition-colors placeholder:text-[#DDDDDD]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 flex items-center justify-center gap-2 text-[13px] font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtp} className="bg-white rounded-xl border border-[#EBEBEB] p-6 space-y-4">
            <div className="text-center pb-1">
              <p className="text-[13px] text-[#555]">Enter the 6-digit OTP sent to your email</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#BBBBBB]">One-Time Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CCCCCC]" />
                <input
                  type="text"
                  autoFocus
                  required
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full h-9 pl-9 pr-3 text-[13px] font-mono tracking-widest border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#AAAAAA] transition-colors placeholder:text-[#DDDDDD]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full h-9 flex items-center justify-center gap-2 text-[13px] font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify & Sign In <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>

            <button
              type="button"
              onClick={() => { setStep('credentials'); setOtp('') }}
              className="w-full text-[12px] text-[#AAAAAA] hover:text-[#111] transition-colors"
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
