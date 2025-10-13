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

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true)
      try {
        // Fetch books
        const { data: booksData } = await supabase.from("books").select("*")

        // ✅ Fetch loans with borrower and book info - FIXED: Proper overdue calculation
        const { data: loansData } = await supabase
          .from("loans")
          .select(`
            *,
            borrower:borrower_id(name),
            books:book_id(title, status)
          `)

        // Fetch borrowers (for stats)
        const { data: borrowersData } = await supabase.from("borrowers").select("*")

        // Dashboard stats
        const totalBooks = booksData?.length || 0
        const availableBooks = booksData?.filter(b => b.status === "available").length || 0
        const checkedOutBooks = booksData?.filter(b => b.status === "checked_out").length || 0
        const reservedBooks = booksData?.filter(b => b.status === "reserved").length || 0
        const totalBorrowers = borrowersData?.length || 0

        // ✅ FIXED: Proper overdue calculation - Count loans that are overdue, not book status
        const today = new Date()
        today.setHours(0, 0, 0, 0) // Normalize to start of day for accurate comparison

        const overdueLoans = loansData?.filter(loan => {
          // Skip returned loans
          if (loan.status === "returned" || loan.returned_date) return false
          
          // Check if due date is in the past
          const dueDate = new Date(loan.due_date)
          dueDate.setHours(0, 0, 0, 0) // Normalize to start of day
          
          return dueDate < today
        }) || []

        const overdueBooksCount = overdueLoans.length

        console.log("📊 Dashboard Stats:", {
          totalBooks,
          availableBooks,
          checkedOutBooks,
          reservedBooks,
          totalBorrowers,
          overdueBooksCount,
          totalLoans: loansData?.length,
          overdueLoans: overdueLoans.length,
          overdueLoanDetails: overdueLoans.map(loan => ({
            id: loan.id,
            due_date: loan.due_date,
            status: loan.status,
            book_title: loan.books?.title,
            borrower: loan.borrower?.name
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

        // ✅ Recent activity now includes borrower name
        const activeLoans = loansData?.filter(l => l.status === "active" || l.status === "borrowed") || []
        const recentActivityWithBooks = activeLoans.map(loan => {
          const book = booksData?.find(b => b.id === loan.book_id)
          return {
            ...loan,
            title: book?.title || loan.books?.title || "Unknown Book",
            author: book?.author || "Unknown Author",
            borrowerName: loan.borrower?.name || "Unknown Borrower",
          }
        })
        setRecentActivity(recentActivityWithBooks.slice(0, 5)) // Limit to 5 most recent

        // Popular books
        const checkoutCounts: Record<string, number> = {}
        loansData?.forEach(loan => {
          if (loan.status === "active" || loan.status === "returned" || loan.status === "borrowed") {
            checkoutCounts[loan.book_id] = (checkoutCounts[loan.book_id] || 0) + 1
          }
        })

        const popularBooksList = Object.entries(checkoutCounts)
          .map(([book_id, count]) => {
            const book = booksData?.find(b => b.id === book_id)
            if (!book) return null
            return { title: book.title, author: book.author, checkouts: count }
          })
          .filter(Boolean)
          .sort((a, b) => b.checkouts - a.checkouts)
          .slice(0, 5)

        setPopularBooks(popularBooksList)

        // Overdue books (already includes borrower info)
        const overdueBooksList = overdueLoans
          .map(loan => {
            const book = booksData?.find(b => b.id === loan.book_id)
            if (!book) return null

            const dueDateObj = new Date(loan.due_date)
            const daysOverdue = Math.max(
              Math.floor((today.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24)),
              0
            )

            return {
              ...book,
              borrower: loan.borrower?.name || "Unknown",
              dueDate: !isNaN(dueDateObj.getTime()) ? dueDateObj.toISOString().split("T")[0] : "Unknown",
              daysOverdue,
              loanId: loan.id
            }
          })
          .filter(Boolean)

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
                  <p className="text-xs text-muted-foreground">Requires attention</p>
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
                      <div key={book.title} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors">
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
                  <CardTitle className="text-destructive">Overdue Books</CardTitle>
                  <CardDescription>Books that need to be returned</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {overdueBooks.map(book => (
                      <div key={book.loanId} className="flex items-center justify-between p-4 bg-destructive/10 rounded-lg backdrop-blur-sm border border-destructive/20">
                        <div>
                          <p className="font-medium">{book.title}</p>
                          <p className="text-sm text-muted-foreground">Borrowed by {book.borrower}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="destructive" className="backdrop-blur-sm">
                            {book.daysOverdue} days overdue
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">Due: {book.dueDate}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}