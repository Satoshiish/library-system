"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Save, BookOpen, User, Hash, Tag, Loader2 } from "lucide-react"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"
import { cn } from "@/lib/utils"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AddBookPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [currentUser, setCurrentUser] = useState<any>(null)

  const [formData, setFormData] = useState({
    title: "",
    author: "",
    isbn: "",
    category: "",
    status: "available",
  })

  // ✅ Load authenticated user
  useEffect(() => {
    if (typeof window !== "undefined") {
      const userId = localStorage.getItem("userId")
      const userEmail = localStorage.getItem("userEmail")
      const userName = localStorage.getItem("userName")
      const userRole = localStorage.getItem("userRole")

      if (userId) {
        setCurrentUser({
          id: parseInt(userId),
          email: userEmail,
          name: userName,
          role: userRole,
        })
      }
    }
  }, [])

  const handleInputChange = (field: string, value: string) => {
    // ✅ Prevent invalid characters based on field type
    if (field === "title" || field === "author") {
      if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s.,'-]*$/.test(value)) return
    }
    if (field === "isbn") {
      if (!/^[0-9\-]*$/.test(value)) return
    }

    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const validateForm = () => {
    if (!formData.title.trim() || !formData.author.trim() || !formData.isbn.trim() || !formData.category.trim()) {
      setError("Please fill in all required fields.")
      return false
    }

    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s.,'-]+$/.test(formData.title)) {
      setError("Title must contain only letters and valid punctuation.")
      return false
    }

    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s.,'-]+$/.test(formData.author)) {
      setError("Author name must contain only letters and valid punctuation.")
      return false
    }

    if (!/^[0-9\-]+$/.test(formData.isbn)) {
      setError("ISBN must contain only numbers and hyphens.")
      return false
    }

    if (formData.isbn.length < 10 || formData.isbn.length > 17) {
      setError("ISBN should be between 10 to 17 characters long.")
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!validateForm()) return
    setIsLoading(true)

    try {
      const userId = currentUser?.id || parseInt(localStorage.getItem("userId") || "0")
      if (!userId) {
        setError("User not authenticated. Please log in again.")
        return
      }

      // ✅ Check for duplicate ISBN before inserting
      const { data: existingBook, error: isbnError } = await supabase
        .from("books")
        .select("isbn")
        .eq("isbn", formData.isbn)
        .maybeSingle()

      if (isbnError) throw isbnError
      if (existingBook) {
        setError("A book with this ISBN already exists.")
        return
      }

      // ✅ Insert book
      const bookData = { ...formData, added_by: userId }
      const { data: newBook, error: bookError } = await supabase
        .from("books")
        .insert([bookData])
        .select()
        .single()

      if (bookError) throw bookError

      // ✅ Audit log
      await supabase.from("audit_logs").insert([
        {
          action: "CREATE_BOOK",
          table_name: "books",
          record_id: newBook.id,
          user_id: userId,
          new_data: newBook,
          created_at: new Date().toISOString(),
        },
      ])

      router.push("/books")
    } catch (err: any) {
      console.error("❌ Error adding book:", err)
      setError(err.message || "Failed to add book. Please try again.")
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
            <div className="flex items-center gap-4">
              <Link href="/books">
                <Button variant="outline" size="sm" className="backdrop-blur-sm border-border/50 hover:bg-muted/30">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Books
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Add New Book
                </h1>
                <p className="text-muted-foreground">
                  {currentUser ? `Adding as: ${currentUser.email}` : "Enter book details"}
                </p>
              </div>
            </div>

            <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg">
              <CardHeader>
                <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Book Details
                </CardTitle>
                <CardDescription>All fields marked * are required.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Title & Author */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="title">Title *</Label>
                      <div className="relative">
                        <BookOpen className="absolute left-3 top-3 h-4 w-4 text-indigo-600" />
                        <Input
                          id="title"
                          placeholder="Enter book title"
                          value={formData.title}
                          onChange={(e) => handleInputChange("title", e.target.value)}
                          required
                          className="pl-11"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="author">Author *</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-indigo-600" />
                        <Input
                          id="author"
                          placeholder="Enter author name"
                          value={formData.author}
                          onChange={(e) => handleInputChange("author", e.target.value)}
                          required
                          className="pl-11"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ISBN & Category */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="isbn">ISBN *</Label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-3 h-4 w-4 text-indigo-600" />
                        <Input
                          id="isbn"
                          placeholder="978-1234567890"
                          value={formData.isbn}
                          onChange={(e) => handleInputChange("isbn", e.target.value)}
                          required
                          className="pl-11"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="category">Category *</Label>
                      <div className="relative">
                        <Tag className="absolute left-3 top-3 h-4 w-4 text-indigo-600 z-10" />
                        <Select
                          value={formData.category || undefined}
                          onValueChange={(value) => handleInputChange("category", value)}
                        >
                          <SelectTrigger className="pl-11">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {["Fiction", "Non-Fiction", "Science", "History", "Biography", "Romance", "Mystery", "Fantasy"].map(
                              (cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="space-y-3">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status || undefined}
                      onValueChange={(value) => handleInputChange("status", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="checked_out">Borrowed</SelectItem>
                        <SelectItem value="reserved">Reserved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border/30">
                    <Button type="submit" disabled={isLoading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" /> Add Book
                        </>
                      )}
                    </Button>
                    <Link href="/books" className="flex-1">
                      <Button type="button" variant="outline" className="w-full">
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
