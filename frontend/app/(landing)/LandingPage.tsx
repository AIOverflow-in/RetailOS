import Link from 'next/link'
import {
  ShoppingCart,
  Package,
  BarChart3,
  FileText,
  Users,
  Shield,
  CheckCircle2,
  ArrowRight,
  Zap,
  Clock,
  IndianRupee,
} from 'lucide-react'

// ─── Data ────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: ShoppingCart,
    title: 'Lightning-fast Billing',
    description:
      'Search products by name or company, pick a batch, enter quantity — bill done in under 30 seconds. Auto-calculates CGST, SGST, and IGST on every line item.',
  },
  {
    icon: Package,
    title: 'Batch & Expiry Tracking',
    description:
      'Add stock with batch numbers, buying price, MRP, and expiry dates. The system warns you about expired and near-expiry batches and prevents overselling automatically.',
  },
  {
    icon: BarChart3,
    title: 'GST Reports & CSV Export',
    description:
      'Generate GST summary reports for any date range. Slab-wise breakdown (0%, 5%, 12%, 18%, 28%) with taxable value, CGST, SGST, IGST — exportable as CSV for your CA.',
  },
  {
    icon: FileText,
    title: 'Indian-standard Invoices',
    description:
      'Sequential bill numbers in the format INV/0042/25-26, aligned with Indian financial year (April–March). Each invoice carries HSN codes and GST breakdown per item.',
  },
  {
    icon: Users,
    title: 'Customer Profiles',
    description:
      'Look up customers by their 10-digit phone number. New patients are created automatically on first purchase. Visit count tracked across orders.',
  },
  {
    icon: Shield,
    title: 'Secure Multi-tenant Architecture',
    description:
      "Each shop gets a completely isolated PostgreSQL schema. Your data is never mixed with another shop's. JWT-secured sessions with 8-hour expiry.",
  },
]

const steps = [
  {
    number: '01',
    title: 'Add your stock',
    description:
      'Create products with HSN codes and add batches with MRP, buying price, selling price, and expiry date. Your inventory is live instantly.',
  },
  {
    number: '02',
    title: 'Bill in seconds',
    description:
      'Search by product name or company, select a batch, enter quantity. GST is computed automatically. Complete the bill and print — done.',
  },
  {
    number: '03',
    title: 'File GST with one click',
    description:
      'Open the Reports tab, pick a date range, and download the slab-wise CSV. Hand it to your CA — no manual number-crunching required.',
  },
]

const stats = [
  { value: '< 30s', label: 'Average bill creation time' },
  { value: '100%', label: 'GST compliant (CGST/SGST/IGST)' },
  { value: '₹0', label: 'Setup or hidden fees' },
  { value: '24 / 7', label: 'Cloud availability' },
]

// ─── Sections ─────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-white flex items-center justify-center">
            <span className="text-zinc-950 font-bold text-sm">R</span>
          </div>
          <span className="font-semibold text-white text-lg tracking-tight">RetailOS</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </nav>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-100 transition-colors"
        >
          Sign in
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative pt-40 pb-28 px-4 sm:px-6 text-center overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[600px] w-[600px] rounded-full bg-white/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-zinc-400 mb-8">
          <Zap className="h-3 w-3 text-yellow-400" />
          GST-compliant billing built for Indian shops
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight tracking-tight">
          Bill faster.{' '}
          <span className="text-zinc-400">Track stock.</span>
          <br />
          File GST with confidence.
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          RetailOS is a complete billing and inventory system for Indian medical and grocery shops.
          CGST, SGST, IGST — calculated automatically on every invoice.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 transition-colors"
          >
            Start billing today
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 rounded-md border border-white/10 px-6 py-3 text-sm font-medium text-zinc-300 hover:bg-white/5 transition-colors"
          >
            See how it works
          </a>
        </div>

        <p className="mt-5 text-xs text-zinc-500">
          No setup fee &nbsp;·&nbsp; No credit card required &nbsp;·&nbsp; ₹10 / shop / month
        </p>
      </div>
    </section>
  )
}

function Stats() {
  return (
    <section className="border-y border-white/10 bg-white/[0.02] py-12 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-3xl font-bold text-white">{s.value}</div>
            <div className="mt-1 text-sm text-zinc-500">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="py-24 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Everything a medical shop needs
          </h2>
          <p className="mt-4 text-zinc-400 max-w-xl mx-auto">
            Built specifically for the Indian retail workflow — no bloat, no unnecessary features,
            nothing missing.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => {
            const Icon = f.icon
            return (
              <article
                key={f.title}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.06] transition-colors"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.description}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function GSTCallout() {
  return (
    <section className="py-16 px-4 sm:px-6 border-y border-white/10 bg-white/[0.02]">
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center gap-10">
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
            GST Engine
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Auto-split CGST, SGST &amp; IGST — every time
          </h2>
          <p className="text-zinc-400 leading-relaxed mb-6">
            Select whether the sale is in-state or out-of-state and RetailOS handles the rest.
            In-state orders split tax into 50% CGST + 50% SGST. Out-of-state orders apply full
            IGST. Every line item carries its own slab (0%, 5%, 12%, 18%, 28%) with HSN code.
          </p>
          <ul className="space-y-2">
            {[
              'Per-item GST rate selection',
              'Automatic CGST / SGST / IGST computation',
              'Slab-wise report for GST return filing',
              'CSV export ready for your chartered accountant',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-zinc-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex-1 w-full max-w-sm md:max-w-none">
          <div className="rounded-xl border border-white/10 bg-zinc-900 p-5 font-mono text-xs">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
              <span className="ml-2 text-zinc-500">INV/0042/25-26</span>
            </div>
            <div className="space-y-2 text-zinc-300">
              <div className="flex justify-between border-b border-white/5 pb-2 mb-3">
                <span className="text-zinc-500">Product</span>
                <span className="text-zinc-500">GST%</span>
                <span className="text-zinc-500">Total</span>
              </div>
              <div className="flex justify-between">
                <span>Paracetamol 500mg</span>
                <span className="text-yellow-400">12%</span>
                <span>₹89.60</span>
              </div>
              <div className="flex justify-between">
                <span>Vitamin D3 60K</span>
                <span className="text-yellow-400">5%</span>
                <span>₹126.00</span>
              </div>
              <div className="flex justify-between">
                <span>BP Monitor Strip</span>
                <span className="text-yellow-400">18%</span>
                <span>₹236.00</span>
              </div>
              <div className="border-t border-white/10 pt-3 mt-3 space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>Taxable value</span><span>₹393.72</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>CGST</span><span>₹28.94</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>SGST</span><span>₹28.94</span>
                </div>
                <div className="flex justify-between font-bold text-white text-sm pt-1 border-t border-white/10">
                  <span>Grand Total</span><span>₹451.60</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Up and running in minutes
          </h2>
          <p className="mt-4 text-zinc-400 max-w-lg mx-auto">
            No training required. If you can type a product name, you can use RetailOS.
          </p>
        </div>

        <div className="relative grid md:grid-cols-3 gap-8">
          <div
            aria-hidden
            className="hidden md:block absolute top-8 left-[calc(16.66%+2rem)] right-[calc(16.66%+2rem)] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />
          {steps.map((step) => (
            <div key={step.number} className="relative text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-2xl font-bold text-zinc-500 mb-5">
                {step.number}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function InventoryShowcase() {
  return (
    <section className="py-16 px-4 sm:px-6 border-y border-white/10 bg-white/[0.02]">
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row-reverse items-center gap-10">
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
            Inventory
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Know exactly what's on your shelf
          </h2>
          <p className="text-zinc-400 leading-relaxed mb-6">
            Every purchase is logged as a batch with expiry date, MRP, buying price, and selling
            price. RetailOS deducts stock automatically on every sale and highlights items that are
            running low or approaching expiry.
          </p>
          <ul className="space-y-2">
            {[
              'Price hierarchy enforced: Buying < Selling < MRP',
              'Color-coded expiry: expired, expiring soon, healthy',
              'Low-stock indicator (under 10 units)',
              'Search by product, company, or batch number',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-zinc-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex-1 w-full max-w-sm md:max-w-none overflow-x-auto">
          <div className="rounded-xl border border-white/10 bg-zinc-900 overflow-hidden text-xs min-w-[320px]">
            <div className="grid grid-cols-4 gap-2 px-4 py-3 text-zinc-500 border-b border-white/5">
              <span>Product</span>
              <span>Expiry</span>
              <span>MRP</span>
              <span>Stock</span>
            </div>
            {[
              { name: 'Amoxicillin 500mg', expiry: 'Dec 2026', mrp: '₹80', stock: 240, status: 'ok' },
              { name: 'Metformin 500mg', expiry: 'May 2025', mrp: '₹45', stock: 12, status: 'expired' },
              { name: 'Azithromycin 250mg', expiry: 'Jun 2025', mrp: '₹120', stock: 8, status: 'expiring' },
              { name: 'Pantoprazole 40mg', expiry: 'Mar 2027', mrp: '₹95', stock: 0, status: 'out' },
            ].map((row) => (
              <div
                key={row.name}
                className={`grid grid-cols-4 gap-2 px-4 py-3 border-b border-white/5 last:border-0 ${row.status === 'expired' ? 'opacity-40' : ''}`}
              >
                <span className="text-zinc-200 truncate">{row.name}</span>
                <span className={
                  row.status === 'expiring' ? 'text-orange-400'
                  : row.status === 'expired' ? 'text-red-400'
                  : 'text-zinc-400'
                }>
                  {row.expiry}
                </span>
                <span className="text-zinc-300">{row.mrp}</span>
                <span className={
                  row.stock === 0 ? 'text-red-400'
                  : row.stock < 10 ? 'text-orange-400'
                  : 'text-emerald-400'
                }>
                  {row.stock === 0 ? 'Out' : row.stock}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section id="pricing" className="py-24 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-white">
          Honest pricing. No surprises.
        </h2>
        <p className="mt-4 text-zinc-400">One plan. Everything included. Cancel any time.</p>
      </div>

      <div className="mx-auto max-w-sm">
        <div className="rounded-2xl border border-white/20 bg-white/[0.05] p-8 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-white/10 mb-5">
            <IndianRupee className="h-6 w-6 text-white" />
          </div>
          <div className="text-5xl font-bold text-white mb-1">₹10</div>
          <div className="text-zinc-400 text-sm mb-8">per shop / per month</div>

          <ul className="space-y-3 text-left mb-8">
            {[
              'Unlimited bills & invoices',
              'Unlimited products & batches',
              'Complete order history',
              'GST reports + CSV export',
              'Customer management',
              'Secure cloud storage (NeonDB)',
              'Multi-device access (web)',
              'No setup fee, ever',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-zinc-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <Link
            href="/login"
            className="block w-full rounded-md bg-white py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 transition-colors"
          >
            Get started — ₹10/month
          </Link>
          <p className="mt-3 text-xs text-zinc-500 flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" />
            Setup in under 5 minutes
          </p>
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="py-24 px-4 sm:px-6 border-t border-white/10">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white">
          Ready to modernize your shop?
        </h2>
        <p className="mt-4 text-zinc-400 max-w-lg mx-auto">
          Join medical and grocery shops already using RetailOS to bill faster, manage stock
          confidently, and file GST without stress.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-white px-8 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 transition-colors"
          >
            Start for ₹10/month
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/10 py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-white flex items-center justify-center">
            <span className="text-zinc-950 font-bold text-xs">R</span>
          </div>
          <span className="font-semibold text-white text-sm">RetailOS</span>
        </div>
        <p className="text-xs text-zinc-500 text-center">
          GST-compliant billing &amp; inventory for Indian medical and grocery shops.
        </p>
        <Link href="/login" className="text-xs text-zinc-400 hover:text-white transition-colors">
          Sign in →
        </Link>
      </div>
    </footer>
  )
}

// ─── Root Export ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Features />
        <GSTCallout />
        <HowItWorks />
        <InventoryShowcase />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
