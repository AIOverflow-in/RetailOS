import AuthGuard from '@/components/shared/AuthGuard'
import Sidebar from '@/components/shared/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen bg-[#F4F4F4] print:bg-white">
        <Sidebar />
        <main className="flex-1 overflow-y-auto print:overflow-visible relative">
          <div className="max-w-6xl mx-auto p-8 print:max-w-none print:p-0">
            {children}
          </div>
          <div className="fixed bottom-3 right-3 px-2 py-0.5 bg-black/60 text-white text-[10px] rounded font-mono tracking-wide print:hidden z-50">
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
