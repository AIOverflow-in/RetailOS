'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
  type FormEvent,
} from 'react'
import { X, ArrowRight, MessageCircle } from 'lucide-react'

// ─── Config ──────────────────────────────────────────────────────────────────

// WhatsApp business number. wa.me requires the country code with no leading
// "+", spaces, or dashes — e.g. 9073055125 becomes 919073055125. Set via the
// NEXT_PUBLIC_WHATSAPP_NUMBER env var (must be NEXT_PUBLIC_ to reach the
// browser, since this is a client component). Falls back to the default below.
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919073055125'

// ─── Context ───────────────────────────────────────────────────────────────────

type LeadContextValue = {
  open: (intent?: string) => void
}

const LeadContext = createContext<LeadContextValue | null>(null)

export function useLead() {
  const ctx = useContext(LeadContext)
  if (!ctx) throw new Error('useLead must be used inside <LeadProvider>')
  return ctx
}

// ─── Provider + Modal ───────────────────────────────────────────────────────────

export function LeadProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [intent, setIntent] = useState<string | undefined>(undefined)

  const open = useCallback((nextIntent?: string) => {
    setIntent(nextIntent)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  // Close on Escape and lock body scroll while the modal is open.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen, close])

  return (
    <LeadContext.Provider value={{ open }}>
      {children}
      {isOpen && <LeadModal intent={intent} onClose={close} />}
    </LeadContext.Provider>
  )
}

function buildWhatsAppUrl(fields: {
  name: string
  shop: string
  city: string
  phone: string
  message: string
  intent?: string
}) {
  const lines = [
    'Hi SellOS team! 👋',
    '',
    fields.intent
      ? `I'm interested in SellOS (${fields.intent}).`
      : "I'd like to know more about SellOS for my shop.",
    '',
    `Name: ${fields.name}`,
    `Shop: ${fields.shop}`,
    fields.city ? `City: ${fields.city}` : null,
    fields.phone ? `Phone: ${fields.phone}` : null,
    fields.message ? `\n${fields.message}` : null,
  ].filter((l) => l !== null)

  const text = encodeURIComponent(lines.join('\n'))
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`
}

function LeadModal({ intent, onClose }: { intent?: string; onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const url = buildWhatsAppUrl({
      name: String(data.get('name') ?? '').trim(),
      shop: String(data.get('shop') ?? '').trim(),
      city: String(data.get('city') ?? '').trim(),
      phone: String(data.get('phone') ?? '').trim(),
      message: String(data.get('message') ?? '').trim(),
      intent,
    })
    setSubmitting(true)
    // Meta Pixel lead signal — no-op until the pixel is live (see app/layout.tsx).
    ;(window as { fbq?: (...a: unknown[]) => void }).fbq?.('track', 'Lead')
    // Open WhatsApp (web or app) in a new tab with the prefilled message.
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-modal-title"
    >
      {/* Backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 sm:p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-zinc-500 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 mb-4">
            <MessageCircle className="h-5 w-5 text-emerald-400" />
          </div>
          <h3 id="lead-modal-title" className="text-xl font-bold text-white">
            Let&apos;s get your shop set up
          </h3>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            Fill in a few details and we&apos;ll continue the conversation on WhatsApp —
            no calls, no spam.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Your name" name="name" placeholder="Ramesh Kumar" required />
          <Field label="Shop name" name="shop" placeholder="Kumar Medical Store" required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="City" name="city" placeholder="Kolkata" />
            <Field
              label="Phone"
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="9XXXXXXXXX"
            />
          </div>
          <div>
            <label htmlFor="lead-message" className="block text-xs font-medium text-zinc-400 mb-1.5">
              Anything you&apos;d like to ask? <span className="text-zinc-600">(optional)</span>
            </label>
            <textarea
              id="lead-message"
              name="message"
              rows={3}
              placeholder="e.g. Can I import my existing stock list?"
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors disabled:opacity-60"
          >
            <MessageCircle className="h-4 w-4" />
            Continue on WhatsApp
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-center text-[11px] text-zinc-600">
            Opens WhatsApp with your details pre-filled. You send the final message.
          </p>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  name,
  type = 'text',
  placeholder,
  required,
  inputMode,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
  inputMode?: 'tel' | 'text'
}) {
  const id = `lead-${name}`
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-zinc-400 mb-1.5">
        {label}
        {required && <span className="text-emerald-400"> *</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
      />
    </div>
  )
}

// ─── Reusable CTA button that opens the lead form ──────────────────────────────

type LeadButtonProps = {
  children: ReactNode
  intent?: string
  className?: string
}

export function LeadButton({ children, intent, className }: LeadButtonProps) {
  const { open } = useLead()
  return (
    <button type="button" onClick={() => open(intent)} className={className}>
      {children}
    </button>
  )
}
