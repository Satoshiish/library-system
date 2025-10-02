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
} from "lucide-react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const statusColors = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  overdue: "bg-red-100 text-red-800",
}

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<any[]>([])
  const [loans, setLoans] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [activeTab, setActiveTab] = useState("borrowers")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch borrowers
        const { data: borrowersData } = await supabase.from("borrowers").select("*")

        // Fetch loans with borrower and book info
        const { data: loansData } = await supabase
          .from("loans")
          .select(`
            *,
            borrowers:borrower_id (id, name, email, phone, status, member_since),
            books:book_id (id, title, author, category)
          `)

        // Flatten joined objects and use member_since directly
        const flattenedLoans = (loansData || []).map(loan => ({
          id: loan.id,
          status: loan.status,
          due_date: loan.due_date,
          borrower: loan.borrowers
            ? {
                ...loan.borrowers,
                joined: loan.borrowers.member_since || "Unknown",
              }
            : { name: "Unknown", joined: "Unknown" },
          book: loan.books,
        }))

        // Format borrowers with joined date directly
        const formattedBorrowers = (borrowersData || []).map(b => ({
          ...b,
          joined: b.member_since || "Unknown",
        }))

        setBorrowers(formattedBorrowers)
        setLoans(flattenedLoans)
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredBorrowers = borrowers.filter(b => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || b.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const filteredLoans = loans.filter(loan => {
    const matchesSearch =
      loan.book?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.borrower?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const activeLoans = filteredLoans.filter(loan => loan.status === "active")
  const overdueLoans = filteredLoans.filter(loan => loan.status === "overdue")

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate)
    const today = new Date()
    const diffTime = due.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading data...</span>
      </div>
    )
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 lg:ml-64 p-6">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-foreground">Borrowers</h1>
            <p className="text-muted-foreground">Manage library members and track borrowed books</p>
          </div>

          {/* Search & Filter */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Search & Filter</CardTitle>
              <CardDescription>Find borrowers and track their loans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search borrowers or books..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="borrowers">Borrowers ({filteredBorrowers.length})</TabsTrigger>
              <TabsTrigger value="active-loans">Active Loans ({activeLoans.length})</TabsTrigger>
              <TabsTrigger value="overdue">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Overdue ({overdueLoans.length})
                </div>
              </TabsTrigger>
            </TabsList>

            {/* Borrowers Tab */}
            <TabsContent value="borrowers" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBorrowers.map(b => {
                  const borrowerActiveLoans = loans.filter(l => l.borrower.id === b.id && l.status === "active")
                  const borrowerOverdueLoans = loans.filter(l => l.borrower.id === b.id && l.status === "overdue")
                  return (
                    <Card key={b.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <User className="h-5 w-5 text-muted-foreground" />
                          <Badge className={statusColors[b.status]}>{b.status.toUpperCase()}</Badge>
                        </div>
                        <CardTitle className="text-lg">{b.name}</CardTitle>
                        <CardDescription>Member since {b.member_since || "Unknown"}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate">{b.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{b.phone}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>Joined {b.member_since || "Unknown"}</span>
                          </div>

                          {/* Borrower loans */}
                          <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-primary">{borrowerActiveLoans.length}</div>
                              <div className="text-xs text-muted-foreground">Active Loans</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-red-600">{borrowerOverdueLoans.length}</div>
                              <div className="text-xs text-muted-foreground">Overdue Loans</div>
                            </div>
                          </div>

                          {/* List books */}
                          {borrowerActiveLoans.length + borrowerOverdueLoans.length > 0 && (
                            <div className="mt-4 space-y-2">
                              <p className="font-medium text-sm">Loans:</p>
                              {borrowerActiveLoans.concat(borrowerOverdueLoans).map(loan => (
                                <div key={loan.id} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                                  <span>{loan.book?.title || "Unknown Book"}</span>
                                  <span className={loan.status === "overdue" ? "text-red-600" : "text-green-600"}>
                                    {loan.status.toUpperCase()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button variant="outline" size="sm" className="w-full mt-4 bg-transparent">
                          <Eye className="mr-2 h-3 w-3" />
                          View Profile
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>

            {/* Active Loans Tab */}
            <TabsContent value="active-loans" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeLoans.map(loan => (
                  <Card key={loan.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                        <Badge className={statusColors["active"]}>ACTIVE</Badge>
                      </div>
                      <CardTitle className="text-lg">{loan.book?.title}</CardTitle>
                      <CardDescription>Borrower: {loan.borrower?.name}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Due: {loan.due_date}</span>
                        </div>
                        <div className="text-center pt-2">
                          <div className="text-2xl font-bold text-primary">{getDaysUntilDue(loan.due_date)}</div>
                          <div className="text-xs text-muted-foreground">Days Until Due</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Overdue Loans Tab */}
            <TabsContent value="overdue" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {overdueLoans.map(loan => (
                  <Card key={loan.id} className="hover:shadow-md transition-shadow border border-red-200">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                        <Badge className={statusColors["overdue"]}>OVERDUE</Badge>
                      </div>
                      <CardTitle className="text-lg">{loan.book?.title}</CardTitle>
                      <CardDescription>Borrower: {loan.borrower?.name}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Due: {loan.due_date}</span>
                        </div>
                        <div className="text-center pt-2">
                          <div className="text-2xl font-bold text-red-600">{Math.abs(getDaysUntilDue(loan.due_date))}</div>
                          <div className="text-xs text-muted-foreground">Days Overdue</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </AuthGuard>
  )
}
