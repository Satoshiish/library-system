"use client"

import { useState, useEffect } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookOpen, User, Clock, TrendingUp, Plus, Eye, Loader2, ArrowUpRight, Users, BookCopy, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"
import { cn } from "@/lib/utils"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardPage() {
  const [dashboardStats, setDashboardStats] = useState({
    totalBooks: 0,
    availableBooks: 0,
    checkedOutBooks: 0,
    reservedBooks: 0,
    totalBorrowers: 0,
    overdueBooks: 0,
  })
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [popularBooks, setPopularBooks] = useState<any[]>([])
  const [overdueBooks, setOverdueBooks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      console.log("🔄 Starting dashboard data fetch...")

      // Fetch books
      const { data: booksData, error: booksError } = await supabase
        .from("books")
        .select("*")
      if (booksError) console.error("❌ Books fetch error:", booksError)
      else console.log("✅ Books data:", booksData?.length)

      // Fetch patrons FIRST to ensure we have the data
      const { data: patronsData, error: patronsError } = await supabase
        .from("patrons")
        .select("*")
      if (patronsError) console.error("❌ Patrons fetch error:", patronsError)
      else console.log("✅ Patrons data:", patronsData?.length)

      // Create patron map for quick lookup
      const patronMap = new Map(patronsData?.map(p => [p.id, p]) || [])
      console.log("🗺️ Patron map created with", patronMap.size, "entries")

      // ✅ FIXED: Try different query approaches for loans
      let loansData: any[] = []
      let loansError: any = null

      // Approach 1: Try with joins first
      const { data: loansData1, error: error1 } = await supabase
        .from("loans")
        .select(`
          *,
          patrons (*),
          books (*)
        `)
        .order("created_at", { ascending: false })

      if (!error1 && loansData1 && loansData1.length > 0) {
        console.log("✅ Approach 1 - Joined loans data:", loansData1.length)
        loansData = loansData1
        
        // Debug: Check if patron data is included
        if (loansData1[0]?.patrons) {
          console.log("🔍 First loan patron data:", loansData1[0].patrons)
        } else {
          console.log("⚠️ No patron data in joined query")
        }
      } else {
        console.log("❌ Approach 1 failed:", error1)
        
        // Approach 2: Basic loans query as fallback
        const { data: loansData2, error: error2 } = await supabase
          .from("loans")
          .select("*")
          .order("created_at", { ascending: false })

        if (!error2 && loansData2) {
          console.log("✅ Approach 2 - Basic loans data:", loansData2.length)
          loansData = loansData2
        } else {
          console.log("❌ Approach 2 failed:", error2)
        }
      }

      // 🧩 Create book map for quick lookup
      const bookMap = new Map(booksData?.map(b => [b.id, b]) || [])

      // If we have loans but no joined data, manually attach book/patron details
      loansData = loansData.map(loan => {
        const patronFromMap = patronMap.get(loan.patron_id)
        const bookFromMap = bookMap.get(loan.book_id)
        
        console.log(`🔍 Loan ${loan.id}:`, {
          patron_id: loan.patron_id,
          hasJoinedPatron: !!loan.patrons,
          hasMappedPatron: !!patronFromMap,
          patronName: patronFromMap?.full_name || 'No name found'
        })

        return {
          ...loan,
          books: loan.books || bookFromMap || null,
          patrons: loan.patrons || patronFromMap || null,
        }
      })

      // 📊 Calculate stats
      const totalBooks = booksData?.length || 0
      const availableBooks = booksData?.filter(b => b.status === "available").length || 0
      const checkedOutBooks = booksData?.filter(b => b.status === "checked_out").length || 0
      const reservedBooks = booksData?.filter(b => b.status === "reserved").length || 0
      const totalBorrowers = patronsData?.length || 0

      // ✅ Overdue calculation
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const overdueLoans = loansData.filter(loan => {
        if (loan.status === "returned" || loan.returned_date) return false

        let dueDate: Date | null = null
        if (loan.due_date) dueDate = new Date(loan.due_date)
        else if (loan.doc_date) dueDate = new Date(loan.doc_date)
        else if (loan.created_at) {
          dueDate = new Date(loan.created_at)
          dueDate.setDate(dueDate.getDate() + 14)
        }

        if (!dueDate || isNaN(dueDate.getTime())) return false
        dueDate.setHours(0, 0, 0, 0)
        return dueDate < today
      })

      const overdueBooksCount = overdueLoans.length

      // Update stats
      setDashboardStats({
        totalBooks,
        availableBooks,
        checkedOutBooks,
        reservedBooks,
        totalBorrowers,
        overdueBooks: overdueBooksCount,
      })

      // ✅ Recent activity - IMPROVED patron name resolution
      const recentActivityData = loansData.slice(0, 5).map(loan => {
        // Get patron name with multiple fallbacks
        let borrowerName = `Patron ${loan.patron_id}`;
        
        // Try joined patron data first
        if (loan.patrons?.full_name) {
          borrowerName = loan.patrons.full_name;
          console.log(`✅ Using joined patron data for ${loan.patron_id}: ${borrowerName}`)
        } 
        // Fallback to patron map
        else {
          const patron = patronMap.get(loan.patron_id);
          if (patron?.full_name) {
            borrowerName = patron.full_name;
            console.log(`✅ Using mapped patron data for ${loan.patron_id}: ${borrowerName}`)
          } else {
            console.log(`❌ No patron name found for ${loan.patron_id}`)
          }
        }

        return {
          id: loan.id,
          title: loan.books?.title || `Book ${loan.book_id}`,
          author: loan.books?.author || "Unknown Author",
          borrowerName: borrowerName,
          status: loan.status,
          created_at: loan.created_at,
          returned_date: loan.returned_date,
        }
      })
      setRecentActivity(recentActivityData)

      // Popular books
      const checkoutCounts: Record<string, number> = {}
      loansData.forEach(loan => {
        if (loan.book_id) {
          checkoutCounts[loan.book_id] = (checkoutCounts[loan.book_id] || 0) + 1
        }
      })
      const popularBooksList = Object.entries(checkoutCounts)
        .map(([book_id, count]) => {
          const book = booksData?.find(b => b.id === book_id)
          if (!book) return null
          return { id: book_id, title: book.title, author: book.author, checkouts: count }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.checkouts - a.checkouts)
        .slice(0, 5)
      setPopularBooks(popularBooksList)

      // ✅ Overdue books - IMPROVED patron name resolution
      const overdueBooksList = overdueLoans.map(loan => {
        const dueDate = loan.due_date
          ? new Date(loan.due_date)
          : loan.doc_date
          ? new Date(loan.doc_date)
          : new Date(loan.created_at)
        if (!loan.doc_date && !loan.due_date) dueDate.setDate(dueDate.getDate() + 14)

        const daysOverdue = Math.max(
          0,
          Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        )

        // Get patron name with multiple fallbacks
        let borrowerName = `Patron ${loan.patron_id}`;
        
        if (loan.patrons?.full_name) {
          borrowerName = loan.patrons.full_name;
        } else {
          const patron = patronMap.get(loan.patron_id);
          if (patron?.full_name) {
            borrowerName = patron.full_name;
          }
        }

        return {
          id: loan.id,
          title: loan.books?.title || `Book ${loan.book_id}`,
          author: loan.books?.author || "Unknown Author",
          borrower: borrowerName,
          dueDate: dueDate.toISOString(),
          daysOverdue,
        }
      })
      setOverdueBooks(overdueBooksList)

      // Debug log to verify patron names are working
      console.log("🔍 FINAL Patron name resolution check:", {
        totalLoans: loansData.length,
        totalPatrons: patronsData?.length,
        patronMapSize: patronMap.size,
        sampleRecentActivity: recentActivityData[0] ? {
          loanId: recentActivityData[0].id,
          borrowerName: recentActivityData[0].borrowerName,
          hasProperName: !recentActivityData[0].borrowerName.includes('Patron ')
        } : 'No recent activity'
      })

    } catch (err) {
      console.error("❌ Error fetching dashboard data:", err)
    } finally {
      setLoading(false)
    }
  }

  fetchDashboardData()
}, [])


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-100/50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
          <p className="text-muted-foreground">Loading dashboard...</p>
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Dashboard
                </h1>
                <p className="text-muted-foreground">Library inventory overview and statistics</p>
              </div>
              <div className="flex gap-2">
                <Link href="/books/add">
                  <Button className={cn(
                    "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700",
                    "text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40",
                    "transition-all duration-300 transform hover:scale-[1.02]",
                    "border-0 backdrop-blur-sm"
                  )}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Book
                  </Button>
                </Link>
                <Link href="/transactions">
                  <Button variant="outline" className="backdrop-blur-sm border-border/50">
                    <Eye className="mr-2 h-4 w-4" />
                    View Transactions
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Total Books</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-indigo-500/20 to-purple-500/20">
                    <BookOpen className="h-4 w-4 text-indigo-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{dashboardStats.totalBooks}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3 text-green-600" />
                    <span className="text-green-600">
                      +{dashboardStats.availableBooks} available
                    </span>
                  </p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Available</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-green-500/20 to-emerald-500/20">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{dashboardStats.availableBooks}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardStats.totalBooks > 0
                      ? ((dashboardStats.availableBooks / dashboardStats.totalBooks) * 100).toFixed(1) + "% of total"
                      : "0%"}
                  </p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Checked Out</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-blue-500/20 to-cyan-500/20">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{dashboardStats.checkedOutBooks}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardStats.totalBooks > 0
                      ? ((dashboardStats.checkedOutBooks / dashboardStats.totalBooks) * 100).toFixed(1) + "% of total"
                      : "0%"}
                  </p>
                </CardContent>
              </Card>

              <Card className={cn(
                "backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg",
                dashboardStats.overdueBooks > 0 
                  ? "border-red-200/50 shadow-red-500/10" 
                  : "shadow-indigo-500/10"
              )}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Overdue</CardTitle>
                  <div className={cn(
                    "p-2 rounded-lg",
                    dashboardStats.overdueBooks > 0
                      ? "bg-gradient-to-tr from-red-500/20 to-orange-500/20"
                      : "bg-gradient-to-tr from-green-500/20 to-emerald-500/20"
                  )}>
                    <Clock className={cn(
                      "h-4 w-4",
                      dashboardStats.overdueBooks > 0 ? "text-red-600" : "text-green-600"
                    )} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    "text-2xl font-bold",
                    dashboardStats.overdueBooks > 0 ? "text-destructive" : "text-foreground"
                  )}>
                    {dashboardStats.overdueBooks}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardStats.overdueBooks > 0 ? "Requires attention" : "All clear!"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Additional Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Total Patrons</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-purple-500/20 to-pink-500/20">
                    <Users className="h-4 w-4 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{dashboardStats.totalBorrowers}</div>
                  <p className="text-xs text-muted-foreground">Active library members</p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Reserved</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-amber-500/20 to-yellow-500/20">
                    <BookCopy className="h-4 w-4 text-amber-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{dashboardStats.reservedBooks}</div>
                  <p className="text-xs text-muted-foreground">Books on hold</p>
                </CardContent>
              </Card>
            </div>

            {/* Overdue Books Alert */}
            {overdueBooks.length > 0 && (
              <Card className="backdrop-blur-xl border-destructive/50 bg-gradient-to-b from-destructive/5 to-destructive/10 shadow-lg shadow-red-500/10">
                <CardHeader>
                  <CardTitle className="text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Overdue Books - Requires Attention!
                  </CardTitle>
                  <CardDescription>
                    {overdueBooks.length} book{overdueBooks.length !== 1 ? 's' : ''} that need to be returned immediately
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {overdueBooks.map(book => (
                      <div key={book.loanId} className="flex items-center justify-between p-4 bg-destructive/10 rounded-lg backdrop-blur-sm border border-destructive/20">
                        <div className="flex-1">
                          <p className="font-medium">{book.title}</p>
                          <p className="text-sm text-muted-foreground">
                            by {book.author} • Borrowed by {book.borrower}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="destructive" className="backdrop-blur-sm">
                            {book.daysOverdue} day{book.daysOverdue !== 1 ? 's' : ''} overdue
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Due: {new Date(book.dueDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Link href="/transactions?filter=overdue">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full bg-transparent backdrop-blur-sm border-destructive/50 hover:bg-destructive/10 text-destructive"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View All Overdue Transactions
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No Overdue Books Message */}
            {overdueBooks.length === 0 && dashboardStats.overdueBooks === 0 && (
              <Card className="backdrop-blur-xl border-green-200/50 bg-gradient-to-b from-green-50/10 to-green-50/5 shadow-lg shadow-green-500/10">
                <CardHeader>
                  <CardTitle className="text-green-600 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    All Clear!
                  </CardTitle>
                  <CardDescription>
                    No overdue books. All items are returned on time or not yet due.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            {/* Recent Activity & Popular Books */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader>
                  <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Recent Activity
                  </CardTitle>
                  <CardDescription>Latest library transactions and book movements</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.map(activity => {
                      // Determine action type and styling based on status
                      const getActionInfo = () => {
                        switch (activity.status) {
                          case "returned":
                            return {
                              action: "Returned",
                              color: "bg-gradient-to-r from-green-500 to-emerald-500",
                              textColor: "text-green-600"
                            }
                          case "borrowed":
                          case "active":
                            return {
                              action: "Checked Out",
                              color: "bg-gradient-to-r from-blue-500 to-cyan-500",
                              textColor: "text-blue-600"
                            }
                          case "reserved":
                            return {
                              action: "Reserved",
                              color: "bg-gradient-to-r from-amber-500 to-yellow-500",
                              textColor: "text-amber-600"
                            }
                          default:
                            return {
                              action: "Processed",
                              color: "bg-gradient-to-r from-gray-500 to-gray-400",
                              textColor: "text-gray-600"
                            }
                        }
                      }

                      const actionInfo = getActionInfo()

                      return (
                        <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors group">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full transition-all flex-shrink-0",
                                actionInfo.color
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate text-foreground">
                                {activity.title}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                <span className={actionInfo.textColor}>{actionInfo.action}</span> 
                                {" by "}
                                <span className="font-medium text-foreground/90">{activity.borrowerName}</span>
                              </p>
                              {activity.author && activity.author !== "Unknown Author" && (
                                <p className="text-xs text-muted-foreground truncate mt-1">
                                  by {activity.author}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ml-2">
                            {new Date(activity.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      )
                    })}
                    {recentActivity.length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-3">
                          <BookOpen className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground font-medium">No recent activity</p>
                        <p className="text-sm text-muted-foreground mt-1">Library transactions will appear here</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    <Link href="/transactions">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full bg-transparent backdrop-blur-sm border-border/50 hover:bg-muted/30 hover:border-indigo-200 transition-colors"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View All Transactions
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Popular Books */}
              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader>
                  <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Popular Books
                  </CardTitle>
                  <CardDescription>Most frequently checked out books</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {popularBooks.map((book, index) => (
                      <div key={book.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white",
                            index === 0 ? "bg-gradient-to-r from-amber-500 to-yellow-500" :
                            index === 1 ? "bg-gradient-to-r from-gray-500 to-gray-400" :
                            index === 2 ? "bg-gradient-to-r from-orange-500 to-red-500" :
                            "bg-gradient-to-r from-indigo-500 to-purple-500"
                          )}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{book.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="backdrop-blur-sm bg-muted/50 whitespace-nowrap">
                          {book.checkouts} checkout{book.checkouts !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    ))}
                    {popularBooks.length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-3">
                          <TrendingUp className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground font-medium">No popular books data</p>
                        <p className="text-sm text-muted-foreground mt-1">Checkout data will appear here</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}