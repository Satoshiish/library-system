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
  Clock
} from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import { cn } from "@/lib/utils"

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // ✅ FIXED: Fetch from patrons table
        const { data: patronsData } = await supabase
          .from("patrons")
          .select("*")
          .order("member_since", { ascending: false })

        // ✅ FIXED: Use the EXACT same query as transactions page
        const { data: loansData } = await supabase
          .from("loans")
          .select(`
            *,
            patrons:patron_id (id, full_name, email, phone, status, member_since),
            books:book_id (id, title, author, category)
          `)
          .order("created_at", { ascending: false })

        console.log("📊 Patrons Data:", patronsData)
        console.log("📊 Loans Data for Borrowers:", loansData)

        // Format patrons data
        const formattedPatrons = (patronsData || []).map(patron => ({
          ...patron,
          joined: patron.member_since || "Unknown",
          status: patron.status === "archived" ? "inactive" : patron.status
        }))

        // Flatten joined objects for loans - use same structure as transactions
        const flattenedLoans = (loansData || []).map(loan => ({
          id: loan.id,
          status: loan.status,
          due_date: loan.due_date,
          created_at: loan.created_at,
          loan_date: loan.loan_date,
          returned_date: loan.returned_date,
          patron_id: loan.patron_id,
          book_id: loan.book_id,
          patron: loan.patrons 
            ? {
                id: loan.patrons.id,
                name: loan.patrons.full_name,
                email: loan.patrons.email,
                phone: loan.patrons.phone,
                status: loan.patrons.status,
                joined: loan.patrons.member_since,
              }
            : { name: "Unknown", email: "Unknown", joined: "Unknown" },
          book: loan.books,
        }))

        setBorrowers(formattedPatrons)
        setLoans(flattenedLoans)

        console.log("📊 Final Loans Count:", flattenedLoans.length)
        console.log("📊 Final Patrons Count:", formattedPatrons.length)

      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // ✅ FIXED: Use the SAME overdue calculation as transactions page
  const isOverdue = (loan: any): boolean => {
    if (loan.status === "returned" || loan.returned_date) {
      return false
    }
    
    const dueDate = new Date(loan.due_date)
    const today = new Date()
    
    dueDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    
    return dueDate < today
  }

  // ✅ FIXED: Calculate days overdue - same as transactions
  const getDaysOverdue = (dueDate: string): number => {
    const due = new Date(dueDate)
    const today = new Date()
    const diffTime = today.getTime() - due.getTime()
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  }

  // ✅ FIXED: Filter borrowers based on search term and status
  const filteredBorrowers = borrowers.filter(b => {
    const matchesSearch =
      b.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.phone?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || b.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // ✅ FIXED: Get ALL loans (not filtered by search for accurate counts)
  const activeLoans = loans.filter(loan => 
    loan.status === "active" || loan.status === "borrowed"
  )

  // ✅ FIXED: Get overdue loans using SAME logic as transactions
  const overdueLoans = loans.filter(loan => isOverdue(loan))

  console.log("📊 Active Loans Count:", activeLoans.length)
  console.log("📊 Overdue Loans Count:", overdueLoans.length)
  console.log("📊 Overdue Loan Details:", overdueLoans.map(loan => ({
    id: loan.id,
    due_date: loan.due_date,
    status: loan.status,
    book_title: loan.book?.title,
    patron_name: loan.patron?.name
  })))

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-100/50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <span className="text-muted-foreground">Loading data...</span>
        </div>
      </div>
    )
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-100/50">
        <Sidebar />
        <main className="flex-1 lg:ml-64 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="mb-4">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Borrowers
              </h1>
              <p className="text-muted-foreground">Manage library members and track borrowed books</p>
            </div>

            {/* Search & Filter */}
            <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
              <CardHeader>
                <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Search & Filter
                </CardTitle>
                <CardDescription>Find borrowers and track their loans</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <Search className="h-5 w-5 text-indigo-600" />
                    </div>
                    <Input
                      placeholder="Search borrowers, books, or emails..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-11 bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                      <Filter className="h-4 w-4 text-indigo-600" />
                      Status
                    </label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-48 bg-background/50 border-border/50 h-11">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 backdrop-blur-sm bg-background/50 border-border/30">
                <TabsTrigger 
                  value="borrowers" 
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
                >
                  <Users className="h-4 w-4" />
                  Borrowers ({filteredBorrowers.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="active-loans"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
                >
                  <BookCheck className="h-4 w-4" />
                  Active Loans ({activeLoans.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="overdue"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-orange-500 data-[state=active]:text-white"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Overdue ({overdueLoans.length})
                </TabsTrigger>
              </TabsList>

              {/* Borrowers Tab */}
              <TabsContent value="borrowers" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredBorrowers.map(borrower => {
                    // ✅ FIXED: Get loans for this specific patron
                    const borrowerLoans = loans.filter(l => l.patron_id === borrower.id)
                    const borrowerActiveLoans = borrowerLoans.filter(l => 
                      l.status === "active" || l.status === "borrowed"
                    )
                    const borrowerOverdueLoans = borrowerLoans.filter(loan => isOverdue(loan))

                    console.log(`📊 Borrower ${borrower.full_name}:`, {
                      totalLoans: borrowerLoans.length,
                      activeLoans: borrowerActiveLoans.length,
                      overdueLoans: borrowerOverdueLoans.length
                    })

                    return (
                      <Card 
                        key={borrower.id} 
                        className={cn(
                          "backdrop-blur-sm border-border/30 bg-gradient-to-b from-background/50 to-background/30",
                          "hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300",
                          "hover:scale-[1.02] hover:border-indigo-300/50"
                        )}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="p-2 rounded-lg bg-gradient-to-tr from-indigo-500/20 to-purple-500/20">
                              <User className="h-5 w-5 text-indigo-600" />
                            </div>
                            <Badge className={cn("backdrop-blur-sm border", statusColors[borrower.status])}>
                              {borrower.status?.toUpperCase() || "UNKNOWN"}
                            </Badge>
                          </div>
                          <CardTitle className="text-lg text-foreground">{borrower.full_name}</CardTitle>
                          <CardDescription>Member since {borrower.member_since || "Unknown"}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-4 w-4 text-indigo-600" />
                              <span className="truncate">{borrower.email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-4 w-4 text-indigo-600" />
                              <span>{borrower.phone || "No phone"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-indigo-600" />
                              <span>Joined {borrower.member_since || "Unknown"}</span>
                            </div>

                            {/* Borrower loans */}
                            <div className="grid grid-cols-2 gap-4 pt-2">
                              <div className="text-center p-3 bg-green-50/50 rounded-lg backdrop-blur-sm">
                                <div className="text-2xl font-bold text-green-600">{borrowerActiveLoans.length}</div>
                                <div className="text-xs text-muted-foreground">Active Loans</div>
                              </div>
                              <div className="text-center p-3 bg-red-50/50 rounded-lg backdrop-blur-sm">
                                <div className="text-2xl font-bold text-red-600">{borrowerOverdueLoans.length}</div>
                                <div className="text-xs text-muted-foreground">Overdue</div>
                              </div>
                            </div>

                            {/* List books */}
                            {borrowerActiveLoans.length > 0 && (
                              <div className="mt-4 space-y-2">
                                <p className="font-medium text-sm text-foreground">Current Loans:</p>
                                {borrowerActiveLoans.map(loan => {
                                  const isLoanOverdue = isOverdue(loan)
                                  return (
                                    <div 
                                      key={loan.id} 
                                      className={cn(
                                        "flex justify-between text-sm p-2 rounded backdrop-blur-sm",
                                        isLoanOverdue 
                                          ? "bg-red-50/50 border border-red-200/50" 
                                          : "bg-green-50/50 border border-green-200/50"
                                      )}
                                    >
                                      <span className="truncate">{loan.book?.title || "Unknown Book"}</span>
                                      <Badge 
                                        variant="outline" 
                                        className={cn(
                                          "text-xs backdrop-blur-sm",
                                          isLoanOverdue ? "border-red-200 text-red-700" : "border-green-200 text-green-700"
                                        )}
                                      >
                                        {isLoanOverdue ? "OVERDUE" : "ACTIVE"}
                                      </Badge>
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {borrowerActiveLoans.length === 0 && (
                              <div className="text-center p-3 bg-gray-50/50 rounded-lg backdrop-blur-sm mt-4">
                                <p className="text-sm text-muted-foreground">No active loans</p>
                              </div>
                            )}
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full mt-4 bg-background/50 backdrop-blur-sm border-border/50 hover:bg-indigo-50 hover:border-indigo-200"
                          >
                            <Eye className="mr-2 h-3 w-3 text-indigo-600" />
                            View Profile
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </TabsContent>

              {/* Active Loans Tab */}
              <TabsContent value="active-loans" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeLoans.map(loan => {
                    const daysUntilDue = getDaysOverdue(loan.due_date)
                    const isLoanOverdue = isOverdue(loan)
                    
                    return (
                      <Card 
                        key={loan.id} 
                        className={cn(
                          "backdrop-blur-sm border-border/30 bg-gradient-to-b from-background/50 to-background/30",
                          "hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300",
                          "hover:scale-[1.02] hover:border-indigo-300/50",
                          isLoanOverdue && "border-red-200/50 bg-red-50/10"
                        )}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="p-2 rounded-lg bg-gradient-to-tr from-blue-500/20 to-cyan-500/20">
                              <BookOpen className="h-5 w-5 text-blue-600" />
                            </div>
                            <Badge className={cn(
                              "backdrop-blur-sm",
                              isLoanOverdue ? "bg-red-100 text-red-800 border-red-200" : "bg-blue-100 text-blue-800 border-blue-200"
                            )}>
                              {isLoanOverdue ? "OVERDUE" : "ACTIVE"}
                            </Badge>
                          </div>
                          <CardTitle className="text-lg text-foreground">{loan.book?.title}</CardTitle>
                          <CardDescription>Borrower: {loan.patron?.name}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-indigo-600" />
                              <span>{loan.patron?.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-indigo-600" />
                              <span>Due: {new Date(loan.due_date).toLocaleDateString()}</span>
                            </div>
                            <div className={cn(
                              "text-center p-3 rounded-lg backdrop-blur-sm mt-2",
                              isLoanOverdue 
                                ? "bg-red-50/50 border border-red-200/50" 
                                : "bg-blue-50/50 border border-blue-200/50"
                            )}>
                              <div className={cn(
                                "text-2xl font-bold",
                                isLoanOverdue ? "text-red-600" : "text-blue-600"
                              )}>
                                {isLoanOverdue ? daysUntilDue : Math.abs(daysUntilDue)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {isLoanOverdue ? "Days Overdue" : "Days Until Due"}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                  {activeLoans.length === 0 && (
                    <div className="col-span-full text-center py-8">
                      <BookCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">No Active Loans</h3>
                      <p className="text-muted-foreground">There are currently no active book loans.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Overdue Loans Tab */}
              <TabsContent value="overdue" className="space-y-6">
                {overdueLoans.length === 0 ? (
                  <Card className="backdrop-blur-xl border-border/30 text-center py-8">
                    <Clock className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Overdue Items</h3>
                    <p className="text-muted-foreground">
                      Great! All items have been returned on time or are not yet due.
                    </p>
                  </Card>
                ) : (
                  <>
                    {/* Overdue Summary */}
                    <Card className="backdrop-blur-xl border-red-200/50 bg-gradient-to-b from-red-50/10 to-red-50/5 shadow-lg shadow-red-500/10">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-600">
                          <AlertTriangle className="h-5 w-5" />
                          Overdue Items Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-center p-4 bg-red-50/50 rounded-lg backdrop-blur-sm border border-red-200/50">
                            <div className="text-2xl font-bold text-red-600">
                              {overdueLoans.length}
                            </div>
                            <div className="text-sm text-muted-foreground">Total Overdue</div>
                          </div>
                          <div className="text-center p-4 bg-orange-50/50 rounded-lg backdrop-blur-sm border border-orange-200/50">
                            <div className="text-2xl font-bold text-orange-600">
                              {overdueLoans.filter(loan => getDaysOverdue(loan.due_date) <= 7).length}
                            </div>
                            <div className="text-sm text-muted-foreground">1-7 Days Overdue</div>
                          </div>
                          <div className="text-center p-4 bg-red-100/50 rounded-lg backdrop-blur-sm border border-red-300/50">
                            <div className="text-2xl font-bold text-red-700">
                              {overdueLoans.filter(loan => getDaysOverdue(loan.due_date) > 7).length}
                            </div>
                            <div className="text-sm text-muted-foreground">8+ Days Overdue</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Overdue Items Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {overdueLoans
                        .sort((a, b) => getDaysOverdue(b.due_date) - getDaysOverdue(a.due_date))
                        .map(loan => (
                        <Card 
                          key={loan.id} 
                          className={cn(
                            "backdrop-blur-sm border-red-200/50 bg-gradient-to-b from-red-50/10 to-red-50/5",
                            "hover:shadow-lg hover:shadow-red-500/10 transition-all duration-300",
                            "hover:scale-[1.02] hover:border-red-300/50"
                          )}
                        >
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="p-2 rounded-lg bg-gradient-to-tr from-red-500/20 to-orange-500/20">
                                <Clock className="h-5 w-5 text-red-600" />
                              </div>
                              <Badge className="bg-red-100 text-red-800 border-red-200 backdrop-blur-sm">OVERDUE</Badge>
                            </div>
                            <CardTitle className="text-lg text-foreground">{loan.book?.title}</CardTitle>
                            <CardDescription>Borrower: {loan.patron?.name}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3 text-sm">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-red-600" />
                                <span>{loan.patron?.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-red-600" />
                                <span>Due: {new Date(loan.due_date).toLocaleDateString()}</span>
                              </div>
                              <div className="text-center p-3 bg-red-50/50 rounded-lg backdrop-blur-sm mt-2">
                                <div className="text-2xl font-bold text-red-600">
                                  {getDaysOverdue(loan.due_date)}
                                </div>
                                <div className="text-xs text-muted-foreground">Days Overdue</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}