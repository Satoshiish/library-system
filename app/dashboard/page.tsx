"use client"

import { useState, useEffect } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookOpen, User, Clock, TrendingUp, Plus, Eye, Loader2, ArrowUpRight, Users, BookCopy } from "lucide-react"
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

  // ✅ FIXED: Use the EXACT same overdue calculation as transactions page
  const isOverdue = (loan: any): boolean => {
    // If already returned, not overdue
    if (loan.status === "returned" || loan.returned_date) {
      return false
    }

    // Use doc_date as due date if available, otherwise use created_at + estimated period
    const dueDate = loan.doc_date ? new Date(loan.doc_date) : new Date(loan.created_at)
    
    // Add default loan period (14 days) if no specific due date
    if (!loan.doc_date) {
      dueDate.setDate(dueDate.getDate() + 14)
    }
    
    const today = new Date()
    
    dueDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    
    return dueDate < today
  }

  // ✅ FIXED: Calculate days overdue - same as transactions
  const getDaysOverdue = (loan: any): number => {
    const dueDate = loan.doc_date ? new Date(loan.doc_date) : new Date(loan.created_at)
    
    // Add default loan period if no specific due date
    if (!loan.doc_date) {
      dueDate.setDate(dueDate.getDate() + 14)
    }
    
    const today = new Date()
    const diffTime = today.getTime() - dueDate.getTime()
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  }

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true)
      try {
        // Fetch books
        const { data: booksData } = await supabase.from("books").select("*")

        // ✅ FIXED: Fetch loans with proper schema alignment
        const { data: loansData } = await supabase
          .from("loans")
          .select(`
            *,
            patrons!inner (id, full_name, email, phone, status, member_since),
            books:book_id (id, title, author, category, status)
          `)
          .order("created_at", { ascending: false })

        // Fetch patrons (for stats)
        const { data: patronsData } = await supabase.from("patrons").select("*")

        console.log("📊 Loans Data for Dashboard:", loansData)
        console.log("📊 Schema Fields for Loans:", loansData?.[0] ? Object.keys(loansData[0]) : "No loans data")

        // Dashboard stats
        const totalBooks = booksData?.length || 0
        const availableBooks = booksData?.filter(b => b.status === "available").length || 0
        const checkedOutBooks = booksData?.filter(b => b.status === "checked_out").length || 0
        const reservedBooks = booksData?.filter(b => b.status === "reserved").length || 0
        const totalBorrowers = patronsData?.length || 0

        // ✅ FIXED: Use the EXACT same overdue calculation as transactions page
        const overdueLoans = loansData?.filter(loan => isOverdue(loan)) || []

        const overdueBooksCount = overdueLoans.length

        console.log("📊 Overdue Calculation Results:", {
          totalLoans: loansData?.length,
          overdueLoansCount: overdueLoans.length,
          overdueLoanDetails: overdueLoans.map(loan => ({
            id: loan.id,
            doc_date: loan.doc_date,
            created_at: loan.created_at,
            status: loan.status,
            returned_date: loan.returned_date,
            book_title: loan.books?.title,
            patron: loan.patrons?.full_name,
            daysOverdue: getDaysOverdue(loan)
          }))
        })

        setDashboardStats({
          totalBooks,
          availableBooks,
          checkedOutBooks,
          reservedBooks,
          totalBorrowers,
          overdueBooks: overdueBooksCount,
        })

        // ✅ FIXED: Recent activity - use loans data with patron info
        const activeLoans = loansData?.filter(l => 
          l.status === "active" || l.status === "borrowed" || (!l.returned_date && l.status !== "returned")
        ) || []
        
        const recentActivityWithBooks = activeLoans.slice(0, 5).map(loan => ({
          ...loan,
          title: loan.books?.title || "Unknown Book",
          author: loan.books?.author || "Unknown Author",
          borrowerName: loan.patrons?.full_name || "Unknown Borrower",
        }))

        setRecentActivity(recentActivityWithBooks)

        // Popular books - count checkouts from loans
        const checkoutCounts: Record<string, number> = {}
        loansData?.forEach(loan => {
          if (loan.status === "active" || loan.status === "returned" || loan.status === "borrowed") {
            const bookId = loan.book_id
            if (bookId) {
              checkoutCounts[bookId] = (checkoutCounts[bookId] || 0) + 1
            }
          }
        })

        const popularBooksList = Object.entries(checkoutCounts)
          .map(([book_id, count]) => {
            const book = booksData?.find(b => b.id === book_id)
            if (!book) return null
            return { 
              id: book_id,
              title: book.title, 
              author: book.author, 
              checkouts: count 
            }
          })
          .filter(Boolean)
          .sort((a: any, b: any) => b.checkouts - a.checkouts)
          .slice(0, 5)

        setPopularBooks(popularBooksList)

        // Overdue books for display
        const overdueBooksList = overdueLoans
          .map(loan => {
            const book = booksData?.find(b => b.id === loan.book_id)
            if (!book) return null

            const daysOverdue = getDaysOverdue(loan)

            return {
              id: book.id,
              title: book.title,
              author: book.author,
              borrower: loan.patrons?.full_name || "Unknown",
              dueDate: loan.doc_date || new Date(loan.created_at).toISOString().split("T")[0],
              daysOverdue,
              loanId: loan.id,
              patronId: loan.patron_id
            }
          })
          .filter(Boolean)

        console.log("📊 Overdue Books for Display:", overdueBooksList)
        setOverdueBooks(overdueBooksList)

      } catch (err) {
        console.error("Error fetching dashboard data:", err)
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

              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Overdue</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-red-500/20 to-orange-500/20">
                    <Clock className="h-4 w-4 text-red-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{dashboardStats.overdueBooks}</div>
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
                  <CardTitle className="text-sm font-medium text-foreground/80">Total Borrowers</CardTitle>
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

            {/* Recent Activity & Popular Books */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader>
                  <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Recent Activity
                  </CardTitle>
                  <CardDescription>Latest library transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.map(activity => (
                      <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full transition-all",
                              activity.status === "active" || activity.status === "borrowed"
                                ? "bg-gradient-to-r from-blue-500 to-cyan-500" 
                                : "bg-gradient-to-r from-red-500 to-orange-500"
                            )}
                          />
                          <div>
                            <p className="text-sm font-medium">{activity.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Loan by {activity.borrowerName}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                          {new Date(activity.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                    {recentActivity.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No recent activity</p>
                    )}
                  </div>
                  <div className="mt-4">
                    <Link href="/transactions">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full bg-transparent backdrop-blur-sm border-border/50 hover:bg-muted/30"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View All Activity
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
                          <div>
                            <p className="text-sm font-medium">{book.title}</p>
                            <p className="text-xs text-muted-foreground">{book.author}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="backdrop-blur-sm bg-muted/50">
                          {book.checkouts} checkouts
                        </Badge>
                      </div>
                    ))}
                    {popularBooks.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No popular books data</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Overdue Books Alert */}
            {overdueBooks.length > 0 && (
              <Card className="backdrop-blur-xl border-destructive/50 bg-gradient-to-b from-destructive/5 to-destructive/10 shadow-lg shadow-red-500/10">
                <CardHeader>
                  <CardTitle className="text-destructive flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Overdue Books
                  </CardTitle>
                  <CardDescription>
                    {overdueBooks.length} book{overdueBooks.length !== 1 ? 's' : ''} that need to be returned
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
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}