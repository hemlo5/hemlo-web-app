import { Sidebar } from "@/components/sidebar"
import { NewsTicker } from "@/components/news-ticker"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-shell" style={{ display: "flex", minHeight: "100vh", background: "#000000" }}>
      <Sidebar />
      <div className="dashboard-content" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <NewsTicker />
        <div style={{ flex: 1, overflow: "hidden" }}>
          {children}
        </div>
      </div>
    </div>
  )
}
