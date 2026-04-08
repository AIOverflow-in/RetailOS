import AuthGuard from '@/components/shared/AuthGuard'
import Sidebar from '@/components/shared/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen bg-[#F4F4F4] print:bg-white">
        <Sidebar />
        <main className="flex-1 overflow-y-auto print:overflow-visible">
          <div className="max-w-6xl mx-auto p-8 print:max-w-none print:p-0">
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
