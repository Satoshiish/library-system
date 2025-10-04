"use client"

import { useState, useEffect } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Edit, Trash2, Eye, Book, Calendar, User, Loader2, X } from "lucide-react"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const statusColors = {
  available: "bg-green-100 text-green-800",
  checked_out: "bg-red-100 text-red-800",
  reserved: "bg-yellow-100 text-yellow-800",
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

  // ✅ IMPROVED: Fetch books with reliable user data for all user types
  const fetchBooks = async () => {
    setLoading(true)
    
    try {
      // Try multiple join approaches
      const joinAttempts = [
        // Attempt 1: Standard join
        supabase.from("books").select(`
          *,
          users!inner(full_name, email, role)
        `),
        // Attempt 2: Explicit foreign key
        supabase.from("books").select(`
          *,
          users!books_added_by_fkey(full_name, email, role)
        `),
        // Attempt 3: Simple join (your current approach)
        supabase.from("books").select(`
          *,
          added_by_user:users(full_name, email, role)
        `)
      ]

      let booksData = null
      let lastError = null

      // Try each join approach until one works
      for (const attempt of joinAttempts) {
        let query = attempt
        
        if (searchTerm) {
          query = query.or(`title.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%,isbn.ilike.%${searchTerm}%`)
        }
        if (categoryFilter !== "all") {
          query = query.eq("category", categoryFilter)
        }
        if (statusFilter !== "all") {
          query = query.eq("status", statusFilter)
        }

        const { data, error } = await query.order("created_at", { ascending: false })
        
        if (!error && data) {
          booksData = data
          console.log("Join successful with data:", data)
          break
        }
        lastError = error
      }

      // If all joins failed, use manual approach
      if (!booksData) {
        console.log("All joins failed, using manual approach. Last error:", lastError)
        const { data: simpleBooks, error: simpleError } = await supabase
          .from("books")
          .select("*")
          .order("created_at", { ascending: false })

        if (simpleError) throw simpleError

        // Manually fetch user data for each book
        booksData = await Promise.all(
          (simpleBooks || []).map(async (book) => {
            if (book.added_by) {
              try {
                const { data: user } = await supabase
                  .from("users")
                  .select("full_name, email, role")
                  .eq("id", book.added_by)
                  .single()
                return { ...book, added_by_user: user || null }
              } catch (userError) {
                console.error(`Error fetching user ${book.added_by}:`, userError)
                return { ...book, added_by_user: null }
              }
            }
            return { ...book, added_by_user: null }
          })
        )
        console.log("Manual fetch completed:", booksData)
      }

      setBooks(booksData || [])
    } catch (error) {
      console.error("Failed to fetch books:", error)
      setBooks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBooks()
  }, [searchTerm, statusFilter, categoryFilter])

  const categories = Array.from(new Set(books.map((book) => book.category)))

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
      
      const { error } = await supabase
        .from("books")
        .delete()
        .eq("id", bookToDelete.id)

      if (error) {
        console.error("❌ Delete error details:", error)
        
        // Provide more specific error messages
        if (error.code === '23503') {
          setDeleteError("Cannot delete book: It may be referenced by other records (loans, etc.)")
        } else if (error.code === '42501') {
          setDeleteError("Permission denied: You don't have rights to delete books")
        } else {
          setDeleteError(`Failed to delete book: ${error.message}`)
        }
        return
      }

      console.log("✅ Book deleted successfully")
      
      // Update UI immediately
      setBooks((prev) => prev.filter((b) => b.id !== bookToDelete.id))
      
      // Close modal on success
      setDeleteModalOpen(false)
      setBookToDelete(null)
      
    } catch (err) {
      console.error("❌ Unexpected error during delete:", err)
      setDeleteError("Failed to delete book. Please try again.")
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
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 lg:ml-64 p-4 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Books</h1>
                <p className="text-sm sm:text-base text-muted-foreground">Manage your library inventory</p>
              </div>
              <Link href="/books/add">
                <Button className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Book
                </Button>
              </Link>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg sm:text-xl">Search & Filter</CardTitle>
                <CardDescription className="text-sm">Find books by title, author, or ISBN</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search books..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="checked_out">Checked Out</SelectItem>
                        <SelectItem value="reserved">Reserved</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Books Display */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg sm:text-xl">
                  Book Inventory ({books.length} books)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading books...</p>
                ) : books.length === 0 ? (
                  <div className="text-center py-8">
                    <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No books found</h3>
                    <p className="text-muted-foreground mb-4">
                      Try adjusting your search or filters
                    </p>
                    <Link href="/books/add">
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Book
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {books.map((book) => (
                      <Card key={book.id} className="border border-border hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-base sm:text-lg leading-tight">{book.title}</h3>
                                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                  <User className="h-3 w-3 flex-shrink-0" />
                                  <span>{book.author}</span>
                                </p>
                              </div>
                              <Badge className={`${statusColors[book.status]} flex-shrink-0 text-xs`}>
                                {book.status.replace("_", " ").toUpperCase()}
                              </Badge>
                            </div>

                            {/* 👇 IMPROVED: Added by display with role */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                              <div className="flex items-center gap-2">
                                <Book className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-muted-foreground">ISBN:</span>
                                <span className="font-mono text-xs break-all">{book.isbn}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Category:</span>
                                <span>{book.category}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-muted-foreground">Added:</span>
                                <span>{new Date(book.created_at).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-muted-foreground">Added by:</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-medium text-sm">
                                    {book.added_by_user?.email || book.users?.email || "Unknown"}
                                  </span>
                                  {(book.added_by_user?.role || book.users?.role) && (
                                    <Badge variant="outline" className="text-xs capitalize">
                                      {book.added_by_user?.role || book.users?.role}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 bg-transparent"
                                onClick={() => setViewingBook(book)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                              <Link href={`/books/edit/${book.id}`} className="flex-1">
                                <Button variant="outline" size="sm" className="w-full bg-transparent">
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Book
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-destructive hover:text-destructive bg-transparent"
                                onClick={() => confirmDelete(book)}
                                disabled={deletingBookId === book.id}
                              >
                                {deletingBookId === book.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 mr-2" />
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

        {/* View Details Modal */}
        {viewingBook && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-6 rounded-lg w-96 relative">
              <button
                className="absolute top-2 right-2 text-muted-foreground"
                onClick={() => setViewingBook(null)}
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-lg font-semibold mb-4">{viewingBook.title}</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Author:</strong> {viewingBook.author}</p>
                <p><strong>ISBN:</strong> {viewingBook.isbn}</p>
                <p><strong>Category:</strong> {viewingBook.category}</p>
                <p><strong>Status:</strong> {viewingBook.status.replace("_", " ").toUpperCase()}</p>
                <p><strong>Added:</strong> {new Date(viewingBook.created_at).toLocaleDateString()}</p>
                <p>
                  <strong>Added by:</strong> {viewingBook.added_by_user?.email || viewingBook.users?.email || "Unknown"}
                  {(viewingBook.added_by_user?.role || viewingBook.users?.role) && (
                    <Badge variant="outline" className="ml-2 text-xs capitalize">
                      {viewingBook.added_by_user?.role || viewingBook.users?.role}
                    </Badge>
                  )}
                </p>
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={() => setViewingBook(null)}>Close</Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-6 rounded-lg w-96 relative">
              <button
                className="absolute top-2 right-2 text-muted-foreground"
                onClick={closeDeleteModal}
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-lg font-semibold mb-2">Delete Book</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to delete "<strong>{bookToDelete?.title}</strong>" by {bookToDelete?.author}?
                This action cannot be undone.
              </p>
              
              {deleteError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded p-3 mb-4">
                  <p className="text-destructive text-sm">{deleteError}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={closeDeleteModal}
                  disabled={deletingBookId !== null}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={deletingBookId !== null}
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