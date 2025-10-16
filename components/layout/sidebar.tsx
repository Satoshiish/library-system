"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  BookOpen,
  LayoutDashboard,
  Users,
  UserPlus,
  Plus,
  Search,
  LogOut,
  Menu,
  X,
  BookCopy,
} from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Books", href: "/books", icon: BookOpen },
  { name: "Add Book", href: "/books/add", icon: Plus },
  { name: "Borrowers", href: "/borrowers", icon: Users },
  { name: "Patrons", href: "/patron", icon: UserPlus },
  { name: "Transactions", href: "/transactions", icon: BookCopy },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated")
    router.push("/login")
  }

  const closeMenu = () => setIsMobileMenuOpen(false)

  return (
    <>
      {/* Mobile toggle button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          className="backdrop-blur-md border-muted shadow-sm"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 backdrop-blur-xl border-r border-border/30 bg-gradient-to-b from-sidebar/70 to-sidebar/40 text-sidebar-foreground shadow-xl transform transition-all duration-300 ease-in-out",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-border/30 backdrop-blur-lg">
            <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-2 rounded-xl shadow-md">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">Library</h1>
              <p className="text-sm text-muted-foreground">Management System</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 mt-2">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={closeMenu}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative",
                    isActive
                      ? "bg-gradient-to-r from-indigo-500/90 to-purple-500/80 text-white shadow-md"
                      : "hover:bg-muted/60 hover:text-foreground text-muted-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "absolute left-0 top-0 h-full w-1 rounded-r-lg transition-all",
                      isActive ? "bg-indigo-400" : "group-hover:bg-indigo-300/60"
                    )}
                  />
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="mt-auto border-t border-border/30 px-4 py-3">
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
              onClick={handleLogout}
            >
              <LogOut className="mr-3 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={closeMenu}
        />
      )}
    </>
  )
}
