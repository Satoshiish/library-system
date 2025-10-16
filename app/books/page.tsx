"use client"

import { useState, useEffect } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Book,
  Calendar,
  User,
  Loader2,
  X,
  BookOpen,
  Filter,
  RefreshCw,
} from "lucide-react"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusColors = {
  available: "bg-green-100 text-green-800 border-green-200",
  borrowed: "bg-red-100 text-red-800 border-red-200",
  reserved: "bg-yellow-100 text-yellow-800 border-yellow-200",
  active: "bg-blue-100 text-blue-800 border-blue-200",
}

export default function BooksPage() {
  const [books, setBooks] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [loading, setLoading] = useState<boolean>(true)
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null)
  const [viewingBook, setViewingBook] = useState<any | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false)
  const [bookToDelete, setBookToDelete] = useState<any | null>(null)
  const [deleteError, setDeleteError] = useState<string>("")

  // Helper function to get status description
  const getStatusDescription = (status: string) => {
    const descriptions = {
      available: "Book is available for borrowing",
      borrowed: "Book is currently on loan",
      reserved: "Book is reserved for someone",
      active: "Book is actively on loan",
    }
    return descriptions[status] || "Unknown status"
  }

  // Helper function to format user role display
  const formatUserRole = (role: string) => {
    const roleMap: { [key: string]: string } = {
      admin: "Admin",
      librarian: "Librarian",
      user: "User",
      member: "Member",
    }
    return roleMap[role] || role
  }

  // ✅ IMPROVED: Fetch books with reliable status checking
  const fetchBooks = async () => {
    setLoading(true)

    try {
      const previousBooks = books // Store current state to detect changes

      // First, get all books
      const { data: allBooks, error: booksError } = await supabase
        .from("books")
        .select("*")
        .order("created_at", { ascending: false })

      if (booksError) throw booksError

      // Then, get active loans to check which books are currently borrowed
      const { data: activeLoans, error: loansError } = await supabase
        .from("loans")
        .select("book_id, status")
        .in("status", ["active", "borrowed"]) // Books that are currently out

      if (loansError) {
        console.error("Error fetching loans:", loansError)
      }

      // Create a set of book IDs that are currently borrowed
      const borrowedBookIds = new Set((activeLoans || []).map((loan) => loan.book_id))

      // Enhance books with accurate status and user data
      const enhancedBooks = await Promise.all(
        (allBooks || []).map(async (book) => {
          // Determine actual status based on loans
          let actualStatus = book.status

          // If book is in active loans, it should be borrowed
          if (borrowedBookIds.has(book.id)) {
            actualStatus = "borrowed"
          } else if (actualStatus === "borrowed") {
            // If book shows as borrowed but no active loan, correct to available
            actualStatus = "available"
          }

          // Fetch user data
          let addedByUser = null
          if (book.added_by) {
            try {
              const { data: user } = await supabase
                .from("users")
                .select("full_name, email, role")
                .eq("id", book.added_by)
                .single()
              addedByUser = user
            } catch (userError) {
              console.error(`Error fetching user ${book.added_by}:`, userError)
            }
          }

          return {
            ...book,
            status: actualStatus, // Use calculated status
            added_by_user: addedByUser,
          }
        }),
      )

      console.log("📚 Enhanced books with accurate status:", enhancedBooks)
      setBooks(enhancedBooks)

      // Show notifications for status changes
      if (previousBooks.length > 0) {
        enhancedBooks.forEach((newBook) => {
          const oldBook = previousBooks.find((b) => b.id === newBook.id)
          if (oldBook && oldBook.status !== newBook.status) {
            console.log(`🔄 Book status changed: ${oldBook.title} from ${oldBook.status} to ${newBook.status}`)
            toast.info(`Book status updated`, {
              description: `"${newBook.title}" is now ${newBook.status.replace("_", " ")}`,
            })
          }
        })
      }
    } catch (error) {
      console.error("Failed to fetch books:", error)
      toast.error("Failed to load books")
      setBooks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBooks()
  }, [searchTerm, statusFilter, categoryFilter])

  // Real-time subscriptions for automatic updates
  useEffect(() => {
    // Subscribe to real-time changes in books table
    const booksSubscription = supabase
      .channel("books-changes")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen for all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "books",
        },
        (payload) => {
          console.log("📚 Real-time book update:", payload)
          toast.info("Book data updated", {
            description: "Refreshing book list...",
          })
          fetchBooks()
        },
      )
      .subscribe()

    // Subscribe to loans table changes to detect book status changes
    const loansSubscription = supabase
      .channel("loans-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "loans",
        },
        (payload) => {
          console.log("📖 Loan transaction update detected:", payload)
          toast.info("Loan status changed", {
            description: "Updating book availability...",
          })
          fetchBooks()
        },
      )
      .subscribe()

    // Cleanup subscriptions
    return () => {
      booksSubscription.unsubscribe()
      loansSubscription.unsubscribe()
    }
  }, [])

  // Optional: Auto-refresh every 30 seconds for reliability
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        console.log("🔄 Auto-refreshing books data...")
        fetchBooks()
      }
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [loading])

  // ✅ FIXED: Handle empty/null categories properly
  const categories = Array.from(
    new Set(
      books
        .map((book) => book.category)
        .filter((category) => category && category.trim() !== "") // Remove empty/null categories
        .map((category) => category.trim()), // Trim whitespace
    ),
  ).sort() // Sort alphabetically

  // Filter books based on search and filters
  const filteredBooks = books.filter((book) => {
    const matchesSearch =
      !searchTerm ||
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.isbn.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || book.status === statusFilter
    const matchesCategory = categoryFilter === "all" || book.category === categoryFilter

    return matchesSearch && matchesStatus && matchesCategory
  })

  // Open delete modal
  const confirmDelete = (book: any) => {
    setBookToDelete(book)
    setDeleteModalOpen(true)
    setDeleteError("") // Clear previous errors
  }

  // ✅ DEBUGGED: Delete book function with better error handling
  const handleDelete = async () => {
    if (!bookToDelete) return

    setDeletingBookId(bookToDelete.id)
    setDeleteError("")

    try {
      console.log("Attempting to delete book:", bookToDelete.id, bookToDelete.title)

      // Debug: Check book ID type and value
      console.log("Book ID type:", typeof bookToDelete.id, "Value:", bookToDelete.id)

      const { error } = await supabase.from("books").delete().eq("id", bookToDelete.id)

      if (error) {
        console.error("❌ Delete error details:", error)

        // Provide more specific error messages
        if (error.code === "23503") {
          setDeleteError("Cannot delete book: It may be referenced by other records (loans, etc.)")
        } else if (error.code === "42501") {
          setDeleteError("Permission denied: You don't have rights to delete books")
        } else {
          setDeleteError(`Failed to delete book: ${error.message}`)
        }
        return
      }

      console.log("✅ Book deleted successfully")
      toast.success("Book deleted successfully")

      // Update UI immediately
      setBooks((prev) => prev.filter((b) => b.id !== bookToDelete.id))

      // Close modal on success
      setDeleteModalOpen(false)
      setBookToDelete(null)
    } catch (err) {
      console.error("❌ Unexpected error during delete:", err)
      setDeleteError("Failed to delete book. Please try again.")
      toast.error("Failed to delete book")
    } finally {
      setDeletingBookId(null)
    }
  }

  // Close delete modal
  const closeDeleteModal = () => {
    setDeleteModalOpen(false)
    setBookToDelete(null)
    setDeleteError("")
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-100/50">
        <Sidebar />
        <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Books
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Manage your library inventory with real-time updates
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={fetchBooks}
                  disabled={loading}
                  className="w-full sm:w-auto backdrop-blur-sm border-border/50 hover:bg-green-50 hover:border-green-200 text-sm sm:text-base bg-transparent"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Refresh
                </Button>
                <Link href="/books/add" className="flex-1 sm:flex-none">
                  <Button
                    className={cn(
                      "w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700",
                      "text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40",
                      "transition-all duration-300 transform hover:scale-[1.02]",
                      "border-0 text-sm sm:text-base",
                    )}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Book
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stats Cards - CHANGE: responsive grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Total Books</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-indigo-500/20 to-purple-500/20">
                    <Book className="h-4 w-4 text-indigo-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{books.length}</div>
                  <p className="text-xs sm:text-base text-muted-foreground">All books in library</p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Available</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-green-500/20 to-emerald-500/20">
                    <Book className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {books.filter((b) => b.status === "available").length}
                  </div>
                  <p className="text-xs sm:text-base text-muted-foreground">Ready to borrow</p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Borrowed</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-red-500/20 to-orange-500/20">
                    <Book className="h-4 w-4 text-red-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {books.filter((b) => b.status === "borrowed").length}
                  </div>
                  <p className="text-xs sm:text-base text-muted-foreground">Currently on loan</p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Reserved</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-yellow-500/20 to-amber-500/20">
                    <Book className="h-4 w-4 text-yellow-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {books.filter((b) => b.status === "reserved").length}
                  </div>
                  <p className="text-xs sm:text-base text-muted-foreground">On hold</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-base sm:text-lg lg:text-xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Search & Filter
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Find books by title, author, or ISBN</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 sm:space-y-4">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <Search className="h-5 w-5 text-indigo-600" />
                    </div>
                    <Input
                      placeholder="Search books..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-11 bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-10 sm:h-11 text-sm sm:text-base"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                        <Filter className="h-4 w-4 text-indigo-600" />
                        Status
                      </label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="bg-background/50 border-border/50">
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="borrowed">Borrowed</SelectItem>
                          <SelectItem value="reserved">Reserved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* ✅ FIXED: Category filter with proper validation */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-indigo-600" />
                        Category
                      </label>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="bg-background/50 border-border/50">
                          <SelectValue placeholder="Filter by category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map((category) => (
                            <SelectItem
                              key={category}
                              value={category}
                              // Ensure the value is never empty
                              disabled={!category || category.trim() === ""}
                            >
                              {category || "Uncategorized"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Books Display */}
            <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
              <CardHeader className="pb-3 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <CardTitle className="text-base sm:text-lg lg:text-xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Book Inventory ({filteredBooks.length} {filteredBooks.length === 1 ? "book" : "books"})
                  </CardTitle>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Real-time updates active
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading books...</p>
                  </div>
                ) : filteredBooks.length === 0 ? (
                  <div className="text-center py-8">
                    <Book className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No books found</h3>
                    <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
                    <Link href="/books/add">
                      <Button
                        className={cn(
                          "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700",
                          "text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40",
                        )}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Book
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {filteredBooks.map((book) => (
                      <Card
                        key={book.id}
                        className={cn(
                          "backdrop-blur-sm border-border/30 bg-gradient-to-b from-background/50 to-background/30",
                          "hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300",
                          "hover:scale-[1.02] hover:border-indigo-300/50",
                        )}
                      >
                        <CardContent className="p-3 sm:p-4">
                          <div className="space-y-2 sm:space-y-3">
                            {/* Title and Status Row */}
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm sm:text-base lg:text-lg leading-tight text-foreground line-clamp-2 break-words">
                                  {book.title}
                                </h3>
                                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                  <User className="h-3 w-3 flex-shrink-0 text-indigo-600" />
                                  <span className="truncate">{book.author}</span>
                                </p>
                              </div>
                              <Badge
                                className={cn(
                                  "flex-shrink-0 text-xs border backdrop-blur-sm cursor-help whitespace-nowrap",
                                  statusColors[book.status] || "bg-gray-100 text-gray-800 border-gray-200",
                                )}
                                title={getStatusDescription(book.status)}
                              >
                                {book.status.replace("_", " ").toUpperCase()}
                              </Badge>
                            </div>

                            {/* Book Details - CHANGE: responsive grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 text-xs sm:text-sm">
                              <div className="flex items-center gap-2 min-w-0">
                                <Book className="h-3 w-3 text-indigo-600 flex-shrink-0" />
                                <span className="text-muted-foreground whitespace-nowrap">ISBN:</span>
                                <span className="font-mono text-xs break-all bg-muted/50 px-2 py-1 rounded truncate min-w-0">
                                  {book.isbn}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-muted-foreground whitespace-nowrap">Category:</span>
                                <Badge
                                  variant="outline"
                                  className="text-xs sm:text-sm backdrop-blur-sm truncate max-w-[120px]"
                                >
                                  {book.category || "Uncategorized"}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 min-w-0">
                                <Calendar className="h-3 w-3 text-indigo-600 flex-shrink-0" />
                                <span className="text-muted-foreground whitespace-nowrap">Added:</span>
                                <span className="whitespace-nowrap">
                                  {new Date(book.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 min-w-0">
                                <User className="h-3 w-3 text-indigo-600 flex-shrink-0" />
                                <span className="text-muted-foreground whitespace-nowrap">Added by:</span>
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className="font-medium text-sm sm:text-base truncate max-w-[100px]">
                                    {book.added_by_user?.email || "Unknown"}
                                  </span>
                                  {book.added_by_user?.role && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs sm:text-sm capitalize backdrop-blur-sm whitespace-nowrap"
                                    >
                                      {formatUserRole(book.added_by_user.role)}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons - CHANGE: responsive layout */}
                            <div className="flex flex-col sm:flex-row gap-2 pt-2 sm:pt-3 border-t border-border/30">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 bg-background/50 backdrop-blur-sm border-border/50 hover:bg-indigo-50 hover:border-indigo-200 text-xs sm:text-sm"
                                onClick={() => setViewingBook(book)}
                              >
                                <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-indigo-600" />
                                View Details
                              </Button>
                              <Link href={`/books/edit/${book.id}`} className="flex-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full bg-background/50 backdrop-blur-sm border-border/50 hover:bg-blue-50 hover:border-blue-200 text-xs sm:text-sm"
                                >
                                  <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-blue-600" />
                                  Edit Book
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-destructive hover:text-destructive bg-background/50 backdrop-blur-sm border-border/50 hover:bg-red-50 hover:border-red-200 text-xs sm:text-sm"
                                onClick={() => confirmDelete(book)}
                                disabled={deletingBookId === book.id}
                              >
                                {deletingBookId === book.id ? (
                                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                )}
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>

        {/* View Details Modal - CHANGE: responsive modal */}
        {viewingBook && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 p-4 sm:p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto relative shadow-2xl shadow-indigo-500/10">
              <button
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setViewingBook(null)}
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent break-words">
                {viewingBook.title}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                  <strong className="whitespace-nowrap">Author:</strong>
                  <span className="text-right break-words ml-2">{viewingBook.author}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                  <strong className="whitespace-nowrap">ISBN:</strong>
                  <span className="font-mono text-right break-all ml-2">{viewingBook.isbn}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                  <strong className="whitespace-nowrap">Category:</strong>
                  <span className="text-right break-words ml-2">{viewingBook.category || "Uncategorized"}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                  <strong className="whitespace-nowrap">Status:</strong>
                  <Badge
                    className={cn("text-xs sm:text-sm whitespace-nowrap", statusColors[viewingBook.status])}
                    title={getStatusDescription(viewingBook.status)}
                  >
                    {viewingBook.status.replace("_", " ").toUpperCase()}
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                  <strong className="whitespace-nowrap">Added:</strong>
                  <span className="text-right whitespace-nowrap ml-2">
                    {new Date(viewingBook.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-start p-2 bg-muted/30 rounded">
                  <strong className="whitespace-nowrap">Added by:</strong>
                  <div className="text-right ml-2">
                    <div className="break-words">{viewingBook.added_by_user?.email || "Unknown"}</div>
                    {viewingBook.added_by_user?.role && (
                      <Badge
                        variant="outline"
                        className="text-xs sm:text-sm capitalize mt-1 backdrop-blur-sm whitespace-nowrap"
                      >
                        {formatUserRole(viewingBook.added_by_user.role)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  onClick={() => setViewingBook(null)}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal - CHANGE: responsive modal */}
        {deleteModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 p-4 sm:p-6 rounded-lg w-full max-w-md relative shadow-2xl shadow-indigo-500/10">
              <button
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={closeDeleteModal}
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-lg font-semibold mb-2 text-destructive">Delete Book</h3>
              <p className="text-sm text-muted-foreground mb-4 break-words">
                Are you sure you want to delete "<strong>{bookToDelete?.title}</strong>" by {bookToDelete?.author}? This
                action cannot be undone.
              </p>

              {deleteError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded p-3 mb-4 backdrop-blur-sm">
                  <p className="text-destructive text-sm break-words">{deleteError}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={closeDeleteModal}
                  disabled={deletingBookId !== null}
                  className="backdrop-blur-sm border-border/50 text-sm sm:text-base bg-transparent"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deletingBookId !== null}
                  className="backdrop-blur-sm text-sm sm:text-base"
                >
                  {deletingBookId ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Book
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
