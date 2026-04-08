'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { superAdminApi } from '@/lib/super-admin-api'

export default function SuperAdminLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await superAdminApi.login(username, password)
      setSessionId(res.session_id)
      setStep('otp')
      toast.success('OTP sent to your registered email')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await superAdminApi.verifyOTP(sessionId, otp)
      localStorage.setItem('sa_token', res.token)
      router.replace('/super-admin/dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid or expired OTP')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full h-9 px-3 text-[13px] border border-[#E5E5E5] rounded-lg bg-white text-foreground focus:outline-none focus:border-[#CCCCCC] transition-colors placeholder:text-[#CCC]"

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[320px]">

        <div className="mb-7 text-center">
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">RetailOS</h1>
          <p className="text-[12px] text-[#AAAAAA] mt-1">Super Admin</p>
        </div>

        <div className="bg-white rounded-xl border border-[#E8E8E8] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          {step === 'credentials' ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-[#AAAAAA]">Username</p>
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
                <p className="text-[11px] font-medium text-[#AAAAAA]">Password</p>
                <input
                  className={inputClass}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-9 mt-1 text-[13px] font-medium bg-foreground text-white rounded-lg hover:bg-foreground/90 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Verifying...' : 'Continue'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-3">
              <p className="text-[12px] text-[#888] text-center mb-2">
                Enter the 6-digit code sent to your email
              </p>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-[#AAAAAA]">OTP Code</p>
                <input
                  className={`${inputClass} text-center tracking-[0.3em] text-[16px] font-mono`}
                  autoFocus
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full h-9 mt-1 text-[13px] font-medium bg-foreground text-white rounded-lg hover:bg-foreground/90 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Verifying...' : 'Verify & Sign in'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('credentials'); setOtp('') }}
                className="w-full text-[12px] text-[#AAAAAA] hover:text-[#333] transition-colors mt-1"
              >
                Back to login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
