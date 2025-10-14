"use client"

import { useState, useEffect } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  User,
  AlertTriangle,
  Eye,
  Mail,
  Phone,
  Calendar,
  Loader2,
  BookOpen,
  Filter,
  Users,
  BookCheck,
  Clock,
  X,
} from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const statusColors = {
  active: "bg-green-100 text-green-800 border-green-200",
  inactive: "bg-gray-100 text-gray-800 border-gray-200",
  overdue: "bg-red-100 text-red-800 border-red-200",
}

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<any[]>([])
  const [loans, setLoans] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [activeTab, setActiveTab] = useState("borrowers")
  const [loading, setLoading] = useState(true)
  const [selectedPatron, setSelectedPatron] = useState<any | null>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  // Overdue check helper
  const isOverdue = (loan: any): boolean => {
    if (loan.status === "returned" || loan.returned_date) return false
    const due = loan.due_date ? new Date(loan.due_date) : new Date(loan.created_at)
    due.setDate(due.getDate() + 14)
    return due < new Date()
  }

  const getDaysOverdue = (loan: any): number => {
    const dueDate = loan.due_date ? new Date(loan.due_date) : new Date(loan.created_at)
    dueDate.setDate(dueDate.getDate() + 14)
    const diff = Date.now() - dueDate.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: patronsData } = await supabase.from("patrons").select("*")
      const { data: loansData } = await supabase
        .from("loans")
        .select(`*, patrons(*), books(*)`)
        .order("created_at", { ascending: false })
      setBorrowers(patronsData || [])
      setLoans(loansData || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const filteredBorrowers = borrowers.filter(b => {
    const matchesSearch =
      b.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || b.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getLoansByPatron = (patronId: string) => loans.filter(l => l.patron_id === patronId)

  const openProfile = (patron: any) => {
    setSelectedPatron(patron)
    setIsProfileOpen(true)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-100/50">
        <Sidebar />
        <main className="flex-1 p-6 lg:ml-64">
          {/* ... existing header, filters, and tabs code ... */}

          {/* Patrons List */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="borrowers">Patrons</TabsTrigger>
              <TabsTrigger value="active-loans">Active Loans</TabsTrigger>
              <TabsTrigger value="overdue">Overdue</TabsTrigger>
            </TabsList>

            <TabsContent value="borrowers">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBorrowers.map(patron => {
                  const patronLoans = getLoansByPatron(patron.id)
                  const activeLoans = patronLoans.filter(l => !l.returned_date)
                  return (
                    <Card key={patron.id}>
                      <CardHeader>
                        <CardTitle>{patron.full_name}</CardTitle>
                        <CardDescription>{patron.email}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm mb-3">
                          <p>Total Loans: {patronLoans.length}</p>
                          <p>Active: {activeLoans.length}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => openProfile(patron)}
                          className="w-full"
                        >
                          <Eye className="h-4 w-4 mr-2" /> View Profile
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>
          </Tabs>

          {/* Patron Profile Modal */}
          <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex justify-between items-center">
                  Patron Profile
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsProfileOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </DialogTitle>
              </DialogHeader>
              {selectedPatron && (
                <div className="space-y-4">
                  <div className="p-3 border rounded-lg bg-gray-50">
                    <h3 className="font-semibold text-lg">
                      {selectedPatron.full_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedPatron.email} • {selectedPatron.phone || "No phone"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Member since{" "}
                      {selectedPatron.member_since
                        ? new Date(selectedPatron.member_since).toLocaleDateString()
                        : "Unknown"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-indigo-600">Loan History</h4>
                    {getLoansByPatron(selectedPatron.id).length > 0 ? (
                      getLoansByPatron(selectedPatron.id).map(loan => (
                        <div
                          key={loan.id}
                          className={cn(
                            "flex justify-between p-2 border rounded-md",
                            isOverdue(loan)
                              ? "bg-red-50 border-red-200"
                              : loan.returned_date
                              ? "bg-green-50 border-green-200"
                              : "bg-blue-50 border-blue-200"
                          )}
                        >
                          <span className="truncate">{loan.books?.title || "Untitled"}</span>
                          <span className="text-xs text-muted-foreground">
                            {loan.returned_date
                              ? "Returned"
                              : isOverdue(loan)
                              ? `Overdue (${getDaysOverdue(loan)}d)`
                              : "Active"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No loan history.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </AuthGuard>
  )
}
