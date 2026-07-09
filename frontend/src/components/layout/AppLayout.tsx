import { Outlet } from "react-router-dom"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"
import { EmergencyFeedProvider } from "@/hooks/EmergencyFeedContext"

export function AppLayout() {
  return (
    <EmergencyFeedProvider>
      <div className="min-h-screen bg-bg">
        <Header />
        <Sidebar />
        <main className="ml-14 pt-14 p-6">
          <Outlet />
        </main>
      </div>
    </EmergencyFeedProvider>
  )
}
