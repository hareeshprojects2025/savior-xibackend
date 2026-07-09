import { NavLink } from "react-router-dom"
import { List, Map, BarChart3, MessageSquareText } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", icon: List, label: "Feed" },
  { to: "/map", icon: Map, label: "Map" },
  { to: "/stats", icon: BarChart3, label: "Stats" },
  { to: "/transcriptions", icon: MessageSquareText, label: "Transcriptions" },
]

export function Sidebar() {
  return (
    <nav className="fixed left-0 top-14 bottom-0 z-40 w-14 bg-white border-r border-gray-200 flex flex-col items-center gap-1 py-3 shadow-sm">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 w-11 py-2 rounded-xl text-[11px] font-semibold transition-all duration-150",
              isActive
                ? "bg-blue-50 text-blue-600 shadow-sm"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            )
          }
        >
          <Icon className="size-4" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}