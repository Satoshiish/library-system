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
  CheckCircle,
  BookX
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

interface Patron {
  id: string
  full_name: string
  email: string
  phone?: string
  member_since: string
  status: "active" | "inactive" | "archived"
}

interface Book {
  id: string
  title: string
  isbn?: string
  author?: string
}

interface Loan {
  id: string
  status: string
  due_date: string
  loan_date: string
  returned_date?: string
  created_at: string
  patron_id: string
  book_id: string
  patron: {
    id: string
    name: string
    email: string
    status: string
  }
  book: Book
}

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<Patron[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [activeTab, setActiveTab] = useState("borrowers")
  const [loading, setLoading] = useState(true)
  const [selectedPatron, setSelectedPatron] = useState<Patron | null>(null)
  const [showPatronDetail, setShowPatronDetail] = useState(false)

  // Overdue calculation function - matching transaction logic
  const isOverdue = (loan: Loan): boolean => {
    if (loan.status === "returned" || loan.returned_date) {
      return false
    }
    
    const dueDate = new Date(loan.due_date)
    const today = new Date()
    
    dueDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    
    return dueDate < today
  }

  // Calculate days overdue - matching transaction logic
  const getDaysOverdue = (loan: Loan): number => {
    if (!isOverdue(loan)) return 0
    
    const dueDate = new Date(loan.due_date)
    const today = new Date()
    
    const diffTime = today.getTime() - dueDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return Math.max(0, diffDays)
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch patrons (using your existing patrons table)
        const { data: patronsData, error: patronsError } = await supabase
          .from("patrons")
          .select("*")
          .order("member_since", { ascending: false })

        if (patronsError) {
          console.error("Error fetching patrons:", patronsError)
          return
        }

        // Fetch loans with proper joins - matching transaction structure
        const { data: loansData, error: loansError } = await supabase
          .from("loans")
          .select(`
            *,
            patrons!loans_patron_id_fkey (
              id,
              full_name,
              email,
              phone,
              status,
              member_since
            ),
            books!loans_book_id_fkey (
              id,
              title,
              isbn,
              author
            )
          `)
          .order("created_at", { ascending: false })

        if (loansError) {
          console.error("Error fetching loans:", loansError)
          
          // Fallback: try simple query if join fails
          const { data: simpleLoans } = await supabase
            .from("loans")
            .select("*")
            .order("created_at", { ascending: false })
          
          if (simpleLoans) {
            // Manually link data if joins fail
            const { data: allBooks } = await supabase.from("books").select("*")
            const { data: allPatrons } = await supabase.from("patrons").select("*")
            
            const formattedLoans: Loan[] = simpleLoans.map(loan => {
              const patron = allPatrons?.find(p => p.id === loan.patron_id)
              const book = allBooks?.find(b => b.id === loan.book_id)
              
              return {
                id: loan.id,
                status: loan.status,
                due_date: loan.due_date,
                loan_date: loan.loan_date,
                created_at: loan.created_at,
                returned_date: loan.returned_date,
                patron_id: loan.patron_id,
                book_id: loan.book_id,
                patron: patron ? {
                  id: patron.id,
                  name: patron.full_name,
                  email: patron.email,
                  status: patron.status,
                } : { id: "", name: "Unknown Patron", email: "Unknown", status: "unknown" },
                book: book || { id: "", title: "Unknown Book" },
              }
            })
            setLoans(formattedLoans)
          }
        } else {
          // Format loans data with proper typing
          const formattedLoans: Loan[] = (loansData || []).map(loan => ({
            id: loan.id,
            status: loan.status,
            due_date: loan.due_date,
            loan_date: loan.loan_date,
            created_at: loan.created_at,
            returned_date: loan.returned_date,
            patron_id: loan.patron_id,
            book_id: loan.book_id,
            patron: loan.patrons ? {
              id: loan.patrons.id,
              name: loan.patrons.full_name,
              email: loan.patrons.email,
              status: loan.patrons.status,
            } : { id: "", name: "Unknown Patron", email: "Unknown", status: "unknown" },
            book: loan.books || { id: "", title: "Unknown Book" },
          }))
          setLoans(formattedLoans)
        }

        // Format patrons data
        const formattedPatrons = (patronsData || []).map(patron => ({
          ...patron,
          status: patron.status === "archived" ? "inactive" : patron.status
        }))

        setBorrowers(formattedPatrons)

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

  // Get active loans (not returned) - matching transaction logic
  const activeLoans = loans.filter(loan => 
    loan.status !== "returned" && !loan.returned_date
  )

  // Get overdue loans - matching transaction logic
  const overdueLoans = loans.filter(loan => isOverdue(loan))

  // Get returned loans (loan history)
  const returnedLoans = loans.filter(loan => 
    loan.status === "returned" || loan.returned_date
  )

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

  // Get returned loans by patron (loan history)
  const getReturnedLoansByPatron = (patronId: string) => {
    return getLoansByPatron(patronId).filter(loan => 
      loan.status === "returned" || loan.returned_date
    )
  }

  // View patron profile with detailed loan history
  const handleViewProfile = (patron: Patron) => {
    setSelectedPatron(patron)
    setShowPatronDetail(true)
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

            {/* Patron Detail Modal */}
            {showPatronDetail && selectedPatron && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-2xl shadow-indigo-500/20">
                  <CardHeader className="border-b border-border/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-2xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                          {selectedPatron.full_name}
                        </CardTitle>
                        <CardDescription>
                          Patron Profile • Member since {formatDate(selectedPatron.member_since)}
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPatronDetail(false)}
                        className="backdrop-blur-sm border-border/50"
                      >
                        Close
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Patron Information */}
                      <div className="lg:col-span-1 space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Contact Information</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex items-center gap-3">
                              <Mail className="h-4 w-4 text-indigo-600" />
                              <div>
                                <p className="text-sm font-medium">Email</p>
                                <p className="text-sm text-muted-foreground">{selectedPatron.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Phone className="h-4 w-4 text-indigo-600" />
                              <div>
                                <p className="text-sm font-medium">Phone</p>
                                <p className="text-sm text-muted-foreground">{selectedPatron.phone || "Not provided"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Calendar className="h-4 w-4 text-indigo-600" />
                              <div>
                                <p className="text-sm font-medium">Member Since</p>
                                <p className="text-sm text-muted-foreground">{formatDate(selectedPatron.member_since)}</p>
                              </div>
                            </div>
                            <div className="pt-2">
                              <Badge className={cn("backdrop-blur-sm border", statusColors[selectedPatron.status] || statusColors.inactive)}>
                                {selectedPatron.status?.toUpperCase()}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Loan Statistics */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Loan Statistics</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="text-center p-3 bg-blue-50/50 rounded-lg backdrop-blur-sm border border-blue-200/50">
                                <div className="text-xl font-bold text-blue-600">{getLoansByPatron(selectedPatron.id).length}</div>
                                <div className="text-xs text-muted-foreground">Total Loans</div>
                              </div>
                              <div className="text-center p-3 bg-green-50/50 rounded-lg backdrop-blur-sm border border-green-200/50">
                                <div className="text-xl font-bold text-green-600">{getActiveLoansByPatron(selectedPatron.id).length}</div>
                                <div className="text-xs text-muted-foreground">Active</div>
                              </div>
                              <div className="text-center p-3 bg-red-50/50 rounded-lg backdrop-blur-sm border border-red-200/50">
                                <div className="text-xl font-bold text-red-600">{getOverdueLoansByPatron(selectedPatron.id).length}</div>
                                <div className="text-xs text-muted-foreground">Overdue</div>
                              </div>
                              <div className="text-center p-3 bg-gray-50/50 rounded-lg backdrop-blur-sm border border-gray-200/50">
                                <div className="text-xl font-bold text-gray-600">{getReturnedLoansByPatron(selectedPatron.id).length}</div>
                                <div className="text-xs text-muted-foreground">Returned</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Loan History */}
                      <div className="lg:col-span-2 space-y-6">
                        {/* Active Loans */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <BookCheck className="h-5 w-5 text-blue-600" />
                              Active Loans ({getActiveLoansByPatron(selectedPatron.id).length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {getActiveLoansByPatron(selectedPatron.id).length > 0 ? (
                              <div className="space-y-3">
                                {getActiveLoansByPatron(selectedPatron.id).map(loan => {
                                  const isLoanOverdue = isOverdue(loan)
                                  return (
                                    <div
                                      key={loan.id}
                                      className={cn(
                                        "flex items-center justify-between p-3 rounded-lg backdrop-blur-sm border",
                                        isLoanOverdue
                                          ? "bg-red-50/50 border-red-200/50"
                                          : "bg-blue-50/50 border-blue-200/50"
                                      )}
                                    >
                                      <div className="flex-1">
                                        <p className="font-medium text-sm">{loan.book?.title || "Unknown Book"}</p>
                                        <p className="text-xs text-muted-foreground">
                                          Borrowed: {formatDate(loan.loan_date)} • 
                                          Due: {loan.due_date ? formatDate(loan.due_date) : "Not set"}
                                        </p>
                                      </div>
                                      <Badge
                                        className={cn(
                                          "backdrop-blur-sm whitespace-nowrap",
                                          isLoanOverdue
                                            ? "bg-red-100 text-red-800 border-red-200"
                                            : "bg-blue-100 text-blue-800 border-blue-200"
                                        )}
                                      >
                                        {isLoanOverdue ? `Overdue ${getDaysOverdue(loan)}d` : "Active"}
                                      </Badge>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-6 text-muted-foreground">
                                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No active loans</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Loan History */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              Loan History ({getReturnedLoansByPatron(selectedPatron.id).length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {getReturnedLoansByPatron(selectedPatron.id).length > 0 ? (
                              <div className="space-y-3 max-h-80 overflow-y-auto">
                                {getReturnedLoansByPatron(selectedPatron.id)
                                  .sort((a, b) => new Date(b.returned_date!).getTime() - new Date(a.returned_date!).getTime())
                                  .map(loan => (
                                    <div
                                      key={loan.id}
                                      className="flex items-center justify-between p-3 rounded-lg backdrop-blur-sm border border-green-200/50 bg-green-50/50"
                                    >
                                      <div className="flex-1">
                                        <p className="font-medium text-sm">{loan.book?.title || "Unknown Book"}</p>
                                        <p className="text-xs text-muted-foreground">
                                          Borrowed: {formatDate(loan.loan_date)} • 
                                          Returned: {loan.returned_date ? formatDate(loan.returned_date) : "Unknown"}
                                        </p>
                                      </div>
                                      <Badge className="bg-green-100 text-green-800 border-green-200 backdrop-blur-sm">
                                        Returned
                                      </Badge>
                                    </div>
                                  ))
                                }
                              </div>
                            ) : (
                              <div className="text-center py-6 text-muted-foreground">
                                <BookX className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No loan history</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

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
                    const patronReturnedLoans = getReturnedLoansByPatron(patron.id)

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
                            Member since {formatDate(patron.member_since)}
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

                            {/* Patron loans summary */}
                            <div className="grid grid-cols-4 gap-2 pt-2">
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
                              <div className="text-center p-2 bg-gray-50/50 rounded-lg backdrop-blur-sm">
                                <div className="text-lg font-bold text-gray-600">{patronReturnedLoans.length}</div>
                                <div className="text-xs text-muted-foreground">History</div>
                              </div>
                            </div>

                            {/* Current active loans preview */}
                            {patronActiveLoans.length > 0 && (
                              <div className="mt-4 space-y-2">
                                <p className="font-medium text-sm text-foreground">Current Loans:</p>
                                {patronActiveLoans.slice(0, 2).map(loan => {
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
                                      <span className="truncate flex-1 text-xs">{loan.book?.title || "Unknown Book"}</span>
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
                                {patronActiveLoans.length > 2 && (
                                  <div className="text-center text-xs text-muted-foreground">
                                    +{patronActiveLoans.length - 2} more active loans
                                  </div>
                                )}
                              </div>
                            )}

                            {patronActiveLoans.length === 0 && patronReturnedLoans.length > 0 && (
                              <div className="text-center p-2 bg-gray-50/50 rounded-lg backdrop-blur-sm mt-2">
                                <p className="text-xs text-muted-foreground">
                                  {patronReturnedLoans.length} previous loan{patronReturnedLoans.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                            )}

                            {patronLoans.length === 0 && (
                              <div className="text-center p-2 bg-gray-50/50 rounded-lg backdrop-blur-sm mt-2">
                                <p className="text-xs text-muted-foreground">No loan history</p>
                              </div>
                            )}
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full mt-4 bg-background/50 backdrop-blur-sm border-border/50 hover:bg-indigo-50 hover:border-indigo-200"
                            onClick={() => handleViewProfile(patron)}
                          >
                            <Eye className="mr-2 h-3 w-3 text-indigo-600" />
                            View Profile & Loans
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
                                  ? `Due: ${formatDate(loan.due_date)}`
                                  : `Borrowed: ${formatDate(loan.created_at)}`
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
                                    ? `Due: ${formatDate(loan.due_date)}`
                                    : `Borrowed: ${formatDate(loan.created_at)}`
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