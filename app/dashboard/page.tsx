"use client"

import { useState, useEffect } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookOpen, User, Clock, TrendingUp, Plus, Eye, Loader2 } from "lucide-react"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"

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

      // ✅ Fetch loans with borrower name (JOIN)
      const { data: loansData } = await supabase
        .from("loans")
        .select(`
          *,
          borrower:borrower_id(name)
        `)

      const activeLoans = loansData?.filter(l => l.status === "active") || []
      const overdueLoans = loansData?.filter(l => l.status === "overdue") || []

      // Fetch borrowers (for stats)
      const { data: borrowersData } = await supabase.from("borrowers").select("*")

      // Dashboard stats
      const totalBooks = booksData?.length || 0
      const availableBooks = booksData?.filter(b => b.status === "available").length || 0
      const checkedOutBooks = booksData?.filter(b => b.status === "checked_out").length || 0
      const reservedBooks = booksData?.filter(b => b.status === "reserved").length || 0
      const totalBorrowers = borrowersData?.length || 0
      const overdueBooksCount = overdueLoans?.filter(loan =>
        booksData?.some(b => b.id === loan.book_id)
      ).length || 0

      setDashboardStats({
        totalBooks,
        availableBooks,
        checkedOutBooks,
        reservedBooks,
        totalBorrowers,
        overdueBooks: overdueBooksCount,
      })

      // ✅ Recent activity now includes borrower name
      const recentActivityWithBooks = activeLoans.map(loan => {
        const book = booksData?.find(b => b.id === loan.book_id)
        return {
          ...loan,
          title: book?.title || "Unknown Book",
          author: book?.author || "Unknown Author",
          borrowerName: loan.borrower?.name || "Unknown Borrower",
        }
      })
      setRecentActivity(recentActivityWithBooks)

      // Popular books
      const checkoutCounts: Record<string, number> = {}
      loansData?.forEach(loan => {
        if (loan.status === "active" || loan.status === "returned") {
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
        ?.map(loan => {
          const book = booksData?.find(b => b.id === loan.book_id)
          if (!book) return null

          const dueDateObj = new Date(loan.due_date)
          const daysOverdue = Math.max(
            Math.floor((new Date().getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24)),
            0
          )

          return {
            ...book,
            borrower: loan.borrower?.name || "Unknown",
            dueDate: !isNaN(dueDateObj.getTime()) ? dueDateObj.toISOString().split("T")[0] : "Unknown",
            daysOverdue
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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    )
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 lg:ml-64 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
                <p className="text-muted-foreground">Library inventory overview and statistics</p>
              </div>
              <Link href="/books/add">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Book
                </Button>
              </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Books</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.totalBooks}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardStats.totalBooks > 0 && (
                      <span className="text-green-600">
                        +{dashboardStats.availableBooks} available
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Available</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.availableBooks}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardStats.totalBooks > 0
                      ? ((dashboardStats.availableBooks / dashboardStats.totalBooks) * 100).toFixed(1) + "% of total"
                      : "0%"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Checked Out</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.checkedOutBooks}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardStats.totalBooks > 0
                      ? ((dashboardStats.checkedOutBooks / dashboardStats.totalBooks) * 100).toFixed(1) + "% of total"
                      : "0%"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{dashboardStats.overdueBooks}</div>
                  <p className="text-xs text-muted-foreground">Requires attention</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity & Popular Books */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest library transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.map(activity => (
                      <div key={activity.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              activity.status === "active" ? "bg-blue-500" : "bg-red-500"
                            }`}
                          />
                          <div>
                            <p className="text-sm font-medium">{activity.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Loan by {activity.borrowerName}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(activity.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Link href="/activity">
                      <Button variant="outline" size="sm" className="w-full bg-transparent">
                        <Eye className="mr-2 h-4 w-4" />
                        View All Activity
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Popular Books */}
              <Card>
                <CardHeader>
                  <CardTitle>Popular Books</CardTitle>
                  <CardDescription>Most frequently checked out books</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {popularBooks.map((book, index) => (
                      <div key={book.title} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{book.title}</p>
                            <p className="text-xs text-muted-foreground">{book.author}</p>
                          </div>
                        </div>
                        <Badge variant="secondary">{book.checkouts} checkouts</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Overdue Books Alert */}
            {overdueBooks.length > 0 && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">Overdue Books</CardTitle>
                  <CardDescription>Books that need to be returned</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {overdueBooks.map(book => (
                      <div key={book.id} className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg">
                        <div>
                          <p className="font-medium">{book.title}</p>
                          <p className="text-sm text-muted-foreground">Borrowed by {book.borrower}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="destructive">{book.daysOverdue} days overdue</Badge>
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
