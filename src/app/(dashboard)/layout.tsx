import { Sidebar } from "@/components/sidebar"
import { AppFooter } from "@/components/app-footer"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-shell" style={{ display: "flex", minHeight: "100vh", background: "#15191d" }}>
      <Sidebar />
      <div className="dashboard-content" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", paddingTop: 65 }}>
        <div style={{ flex: "1 0 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
          {children}
        </div>
        <AppFooter />
      </div>
    </div>
  )
}
