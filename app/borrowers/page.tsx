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

  // Overdue calculation function
  const isOverdue = (loan: any): boolean => {
    // Skip returned loans
    if (loan.status === "returned" || loan.returned_date) {
      return false
    }

    // Determine due date
    let dueDate: Date | null = null
    
    if (loan.due_date) {
      dueDate = new Date(loan.due_date)
    } else if (loan.doc_date) {
      dueDate = new Date(loan.doc_date)
    } else if (loan.created_at) {
      // Default to created_at + 14 days if no due date
      dueDate = new Date(loan.created_at)
      dueDate.setDate(dueDate.getDate() + 14)
    }

    if (!dueDate || isNaN(dueDate.getTime())) {
      return false
    }

    const today = new Date()
    dueDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    
    return dueDate < today
  }

  // Calculate days overdue
  const getDaysOverdue = (loan: any): number => {
    const dueDate = loan.due_date ? new Date(loan.due_date) : 
                   loan.doc_date ? new Date(loan.doc_date) : 
                   new Date(loan.created_at)
    
    // Add default loan period if no specific due date
    if (!loan.doc_date && !loan.due_date) {
      dueDate.setDate(dueDate.getDate() + 14)
    }
    
    const today = new Date()
    const diffTime = today.getTime() - dueDate.getTime()
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch patrons
        const { data: patronsData } = await supabase
          .from("patrons")
          .select("*")
          .order("member_since", { ascending: false })

        // Fetch loans with proper joins
        const { data: loansData } = await supabase
          .from("loans")
          .select(`
            *,
            patrons (*),
            books (*)
          `)
          .order("created_at", { ascending: false })

        // Format patrons data
        const formattedPatrons = (patronsData || []).map(patron => ({
          ...patron,
          status: patron.status === "archived" ? "inactive" : patron.status
        }))

        // Format loans data
        const formattedLoans = (loansData || []).map(loan => ({
          id: loan.id,
          status: loan.status,
          due_date: loan.due_date,
          doc_date: loan.doc_date,
          created_at: loan.created_at,
          loan_date: loan.loan_date,
          returned_date: loan.returned_date,
          patron_id: loan.patron_id,
          book_id: loan.book_id,
          patron: loan.patrons ? {
            id: loan.patrons.id,
            name: loan.patrons.full_name,
            email: loan.patrons.email,
            phone: loan.patrons.phone,
            status: loan.patrons.status,
            joined: loan.patrons.member_since,
          } : { name: "Unknown Patron", email: "Unknown", joined: "Unknown" },
          book: loan.books,
        }))

        setBorrowers(formattedPatrons)
        setLoans(formattedLoans)

      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Filter borrowers based on search term and status
  const filteredBorrowers = borrowers.filter(b => {
    const matchesSearch =
      b.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.phone?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || b.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Get active loans (not returned)
  const activeLoans = loans.filter(loan => 
    loan.status !== "returned" && !loan.returned_date
  )

  // Get overdue loans
  const overdueLoans = loans.filter(loan => isOverdue(loan))

  // Get loans by patron
  const getLoansByPatron = (patronId: string) => {
    return loans.filter(loan => loan.patron_id === patronId)
  }

  // Get active loans by patron
  const getActiveLoansByPatron = (patronId: string) => {
    return getLoansByPatron(patronId).filter(loan => 
      loan.status !== "returned" && !loan.returned_date
    )
  }

  // Get overdue loans by patron
  const getOverdueLoansByPatron = (patronId: string) => {
    return getLoansByPatron(patronId).filter(loan => isOverdue(loan))
  }

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
                Patrons
              </h1>
              <p className="text-muted-foreground">Manage library patrons and track borrowed books</p>
            </div>

            {/* Search & Filter */}
            <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
              <CardHeader>
                <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Search & Filter
                </CardTitle>
                <CardDescription>Find patrons and track their loans</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <Search className="h-5 w-5 text-indigo-600" />
                    </div>
                    <Input
                      placeholder="Search by name, email, or phone..."
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
                  Patrons ({filteredBorrowers.length})
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

              {/* Patrons Tab */}
              <TabsContent value="borrowers" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredBorrowers.map(patron => {
                    const patronLoans = getLoansByPatron(patron.id)
                    const patronActiveLoans = getActiveLoansByPatron(patron.id)
                    const patronOverdueLoans = getOverdueLoansByPatron(patron.id)

                    return (
                      <Card 
                        key={patron.id} 
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
                            <Badge className={cn("backdrop-blur-sm border", statusColors[patron.status] || statusColors.inactive)}>
                              {patron.status?.toUpperCase() || "UNKNOWN"}
                            </Badge>
                          </div>
                          <CardTitle className="text-lg text-foreground">{patron.full_name}</CardTitle>
                          <CardDescription>
                            Member since {patron.member_since ? new Date(patron.member_since).toLocaleDateString() : "Unknown"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-4 w-4 text-indigo-600" />
                              <span className="truncate">{patron.email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-4 w-4 text-indigo-600" />
                              <span>{patron.phone || "No phone"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-indigo-600" />
                              <span>Joined {patron.member_since ? new Date(patron.member_since).toLocaleDateString() : "Unknown"}</span>
                            </div>

                            {/* Patron loans summary */}
                            <div className="grid grid-cols-3 gap-2 pt-2">
                              <div className="text-center p-2 bg-blue-50/50 rounded-lg backdrop-blur-sm">
                                <div className="text-lg font-bold text-blue-600">{patronLoans.length}</div>
                                <div className="text-xs text-muted-foreground">Total</div>
                              </div>
                              <div className="text-center p-2 bg-green-50/50 rounded-lg backdrop-blur-sm">
                                <div className="text-lg font-bold text-green-600">{patronActiveLoans.length}</div>
                                <div className="text-xs text-muted-foreground">Active</div>
                              </div>
                              <div className="text-center p-2 bg-red-50/50 rounded-lg backdrop-blur-sm">
                                <div className="text-lg font-bold text-red-600">{patronOverdueLoans.length}</div>
                                <div className="text-xs text-muted-foreground">Overdue</div>
                              </div>
                            </div>

                            {/* Current active loans */}
                            {patronActiveLoans.length > 0 && (
                              <div className="mt-4 space-y-2">
                                <p className="font-medium text-sm text-foreground">Current Loans:</p>
                                {patronActiveLoans.slice(0, 3).map(loan => {
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
                                      <span className="truncate flex-1">{loan.book?.title || "Unknown Book"}</span>
                                      <Badge 
                                        variant="outline" 
                                        className={cn(
                                          "text-xs backdrop-blur-sm whitespace-nowrap",
                                          isLoanOverdue ? "border-red-200 text-red-700" : "border-green-200 text-green-700"
                                        )}
                                      >
                                        {isLoanOverdue ? `Overdue ${getDaysOverdue(loan)}d` : "Active"}
                                      </Badge>
                                    </div>
                                  )
                                })}
                                {patronActiveLoans.length > 3 && (
                                  <div className="text-center text-xs text-muted-foreground">
                                    +{patronActiveLoans.length - 3} more loans
                                  </div>
                                )}
                              </div>
                            )}

                            {patronActiveLoans.length === 0 && (
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
                    const daysOverdue = getDaysOverdue(loan)
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
                          <CardTitle className="text-lg text-foreground line-clamp-2">
                            {loan.book?.title || "Unknown Book"}
                          </CardTitle>
                          <CardDescription className="line-clamp-1">
                            Patron: {loan.patron?.name}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-indigo-600" />
                              <span>{loan.patron?.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-indigo-600" />
                              <span>
                                {loan.due_date 
                                  ? `Due: ${new Date(loan.due_date).toLocaleDateString()}`
                                  : `Borrowed: ${new Date(loan.created_at).toLocaleDateString()}`
                                }
                              </span>
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
                                {isLoanOverdue ? daysOverdue : "Active"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {isLoanOverdue ? "Days Overdue" : "Currently Borrowed"}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                  {activeLoans.length === 0 && (
                    <div className="col-span-full text-center py-12">
                      <BookCheck className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium text-foreground mb-2">No Active Loans</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        There are currently no active book loans. All books have been returned or no loans have been created yet.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Overdue Loans Tab */}
              <TabsContent value="overdue" className="space-y-6">
                {overdueLoans.length === 0 ? (
                  <Card className="backdrop-blur-xl border-green-200/50 bg-gradient-to-b from-green-50/10 to-green-50/5 text-center py-12">
                    <Clock className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Overdue Items</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
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
                        <CardDescription>
                          {overdueLoans.length} item{overdueLoans.length !== 1 ? 's' : ''} currently overdue
                        </CardDescription>
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
                              {overdueLoans.filter(loan => getDaysOverdue(loan) <= 7).length}
                            </div>
                            <div className="text-sm text-muted-foreground">1-7 Days</div>
                          </div>
                          <div className="text-center p-4 bg-red-100/50 rounded-lg backdrop-blur-sm border border-red-300/50">
                            <div className="text-2xl font-bold text-red-700">
                              {overdueLoans.filter(loan => getDaysOverdue(loan) > 7).length}
                            </div>
                            <div className="text-sm text-muted-foreground">8+ Days</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Overdue Items Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {overdueLoans
                        .sort((a, b) => getDaysOverdue(b) - getDaysOverdue(a))
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
                              <Badge className="bg-red-100 text-red-800 border-red-200 backdrop-blur-sm">
                                OVERDUE
                              </Badge>
                            </div>
                            <CardTitle className="text-lg text-foreground line-clamp-2">
                              {loan.book?.title || "Unknown Book"}
                            </CardTitle>
                            <CardDescription className="line-clamp-1">
                              Patron: {loan.patron?.name}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3 text-sm">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-red-600" />
                                <span>{loan.patron?.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-red-600" />
                                <span>
                                  {loan.due_date 
                                    ? `Due: ${new Date(loan.due_date).toLocaleDateString()}`
                                    : `Borrowed: ${new Date(loan.created_at).toLocaleDateString()}`
                                  }
                                </span>
                              </div>
                              <div className="text-center p-3 bg-red-50/50 rounded-lg backdrop-blur-sm mt-2 border border-red-200/50">
                                <div className="text-2xl font-bold text-red-600">
                                  {getDaysOverdue(loan)}
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