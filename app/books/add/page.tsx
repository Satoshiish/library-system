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
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"  // ✅ centralized client

export default function AddBookPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [user, setUser] = useState<any>(null)

  const [formData, setFormData] = useState({
    title: "",
    author: "",
    isbn: "",
    category: "",
    status: "available",
  })

  // ✅ Load authenticated user on mount
  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        console.error("❌ Session error:", sessionError)
        return
      }

      if (session?.user) {
        setUser(session.user)
      } else {
        console.warn("⚠️ No active session found")
      }
    }

    loadUser()
  }, [])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // ✅ Recheck session before inserting
      let currentUser = user
      if (!currentUser) {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        currentUser = session?.user || null
        setUser(currentUser)
      }

      // 1️⃣ Insert the book
      const { data: newBook, error: bookError } = await supabase
        .from("books")
        .insert([formData])
        .select()
        .single()

      if (bookError) {
        console.error("❌ Book insert error:", bookError)
        setError("Failed to add book. Please try again.")
        return
      }

      // 2️⃣ Insert audit log if user is available
      if (currentUser) {
        const logEntry = {
          user_id: currentUser.id,
          user_name: currentUser.user_metadata?.full_name || currentUser.email,
          action: "Added Book",
          entity: "books",
          entity_id: newBook.id,
          metadata: JSON.stringify({
            title: newBook.title,
            author: newBook.author,
            isbn: newBook.isbn,
          }),
          created_at: new Date().toISOString(),
        }

        const { error: logError } = await supabase.from("audit_logs").insert([logEntry])

        if (logError) {
          console.error("❌ Audit log insert error:", logError)
        } else {
          console.log("✅ Audit log recorded:", logEntry)
        }
      } else {
        console.warn("⚠️ No user found — audit log skipped")
      }

      // ✅ Redirect after success
      router.push("/books")
    } catch (err) {
      console.error("❌ Unexpected error:", err)
      setError("Failed to add book. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 lg:ml-64 p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
              <Link href="/books">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Books
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Add New Book</h1>
                <p className="text-muted-foreground">Enter details for a new book</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Book Details</CardTitle>
                <CardDescription>Fill in the information for this book</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        placeholder="Enter book title"
                        value={formData.title}
                        onChange={(e) => handleInputChange("title", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="author">Author *</Label>
                      <Input
                        id="author"
                        placeholder="Enter author name"
                        value={formData.author}
                        onChange={(e) => handleInputChange("author", e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="isbn">ISBN *</Label>
                      <Input
                        id="isbn"
                        placeholder="978-0-123456-78-9"
                        value={formData.isbn}
                        onChange={(e) => handleInputChange("isbn", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select
                        value={formData.category || undefined}
                        onValueChange={(value) => handleInputChange("category", value)}
                      >
                        <SelectTrigger>
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

                  <div className="space-y-2">
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
                        <SelectItem value="checked_out">Checked Out</SelectItem>
                        <SelectItem value="reserved">Reserved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-4">
                    <Button type="submit" disabled={isLoading} className="flex-1">
                      {isLoading ? (
                        <>
                          <Save className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Add Book
                        </>
                      )}
                    </Button>
                    <Link href="/books">
                      <Button type="button" variant="outline">
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
