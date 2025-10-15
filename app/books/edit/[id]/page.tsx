"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Save, Trash2, BookOpen, User, Hash, Tag, Loader2 } from "lucide-react"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"
import { cn } from "@/lib/utils"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function EditBookPage() {
  const router = useRouter()
  const params = useParams()
  const bookId = params.id

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    title: "",
    author: "",
    isbn: "",
    category: "",
    status: "available",
  })

  // Fetch book data
  useEffect(() => {
    if (!bookId) return
    const fetchBook = async () => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase.from("books").select("*").eq("id", bookId).single()
        if (error || !data) {
          setError("Book not found.")
        } else {
          setFormData({
            title: data.title,
            author: data.author,
            isbn: data.isbn,
            category: data.category,
            status: data.status,
          })
        }
      } catch {
        setError("Failed to fetch book data.")
      } finally {
        setIsLoading(false)
      }
    }
    fetchBook()
  }, [bookId])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookId) return
    setError("")
    setIsLoading(true)

    // Validate required fields
    if (!formData.title || !formData.author || !formData.isbn || !formData.category) {
      setError("Please fill in all required fields.")
      setIsLoading(false)
      return
    }

    // Validate ISBN format
    const isbnPattern = /^(97(8|9))?\d{9}(\d|X)$/
    if (!isbnPattern.test(formData.isbn.replace(/[-\s]/g, ""))) {
      setError("Invalid ISBN format. Example: 978-0-123456-47-2")
      setIsLoading(false)
      return
    }

    try {
      // Check for duplicate ISBN (exclude current book)
      const { data: duplicate } = await supabase
        .from("books")
        .select("id")
        .eq("isbn", formData.isbn)
        .neq("id", bookId)
        .maybeSingle()

      if (duplicate) {
        setError("Another book already uses this ISBN. Please use a unique one.")
        setIsLoading(false)
        return
      }

      // Update the book
      const { error: updateError } = await supabase
        .from("books")
        .update(formData)
        .eq("id", bookId)

      if (updateError) {
        setError("Failed to update book. Please try again.")
      } else {
        router.push("/books")
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Soft Delete (Archive)
  const handleArchive = async () => {
    if (!bookId || !confirm("Are you sure you want to archive this book?")) return
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from("books")
        .update({ status: "archived" })
        .eq("id", bookId)
      if (error) {
        setError("Failed to archive book. Please try again.")
      } else {
        router.push("/books")
      }
    } catch {
      setError("Failed to archive book. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-100/50">
        <Sidebar />
        <main className="flex-1 lg:ml-64 p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Link href="/books">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="backdrop-blur-sm border-border/50 hover:bg-muted/30"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Books
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Edit Book
                </h1>
                <p className="text-muted-foreground">Update book information</p>
              </div>
            </div>

            <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
              <CardHeader>
                <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Book Details
                </CardTitle>
                <CardDescription>Modify the details for this book</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Title & Author */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="title" className="text-sm font-medium text-foreground/80">
                        Title *
                      </Label>
                      <div className="relative">
                        <BookOpen className="absolute left-3 top-3 h-4 w-4 text-indigo-600" />
                        <Input
                          id="title"
                          placeholder="Enter book title"
                          value={formData.title}
                          onChange={(e) => handleInputChange("title", e.target.value)}
                          required
                          className="pl-11 bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="author" className="text-sm font-medium text-foreground/80">
                        Author *
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-indigo-600" />
                        <Input
                          id="author"
                          placeholder="Enter author name"
                          value={formData.author}
                          onChange={(e) => handleInputChange("author", e.target.value)}
                          required
                          className="pl-11 bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ISBN & Category */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="isbn" className="text-sm font-medium text-foreground/80">
                        ISBN *
                      </Label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-3 h-4 w-4 text-indigo-600" />
                        <Input
                          id="isbn"
                          placeholder="978-0-123456-78-9"
                          value={formData.isbn}
                          onChange={(e) => handleInputChange("isbn", e.target.value)}
                          required
                          className="pl-11 bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="category" className="text-sm font-medium text-foreground/80">
                        Category *
                      </Label>
                      <div className="relative">
                        <Tag className="absolute left-3 top-3 h-4 w-4 text-indigo-600 z-10" />
                        <Select
                          value={formData.category}
                          onValueChange={(value) => handleInputChange("category", value)}
                        >
                          <SelectTrigger className="pl-11 bg-background/50 border-border/50 focus:border-indigo-300 h-11">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              "Fiction",
                              "Non-Fiction",
                              "Science",
                              "History",
                              "Biography",
                              "Romance",
                              "Mystery",
                              "Fantasy",
                              "Dystopian",
                              "Children",
                            ].map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="space-y-3">
                    <Label htmlFor="status" className="text-sm font-medium text-foreground/80">
                      Status
                    </Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => handleInputChange("status", value)}
                    >
                      <SelectTrigger className="bg-background/50 border-border/50 focus:border-indigo-300 h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="checked_out">Borrowed</SelectItem>
                        <SelectItem value="reserved">Reserved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Error Alert */}
                  {error && (
                    <Alert variant="destructive" className="backdrop-blur-sm border-destructive/50">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border/30">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className={cn(
                        "flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700",
                        "text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40",
                        "transition-all duration-300 transform hover:scale-[1.02]",
                        "border-0 h-11"
                      )}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Update Book
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleArchive}
                      disabled={isLoading}
                      className="h-11 backdrop-blur-sm"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Archive
                    </Button>
                    <Link href="/books" className="flex-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-11 backdrop-blur-sm border-border/50 hover:bg-muted/30"
                      >
                        Cancel
                      </Button>
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
