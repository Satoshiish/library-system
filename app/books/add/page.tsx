"use client"

import { useState } from "react"
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
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AddBookPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    title: "",
    author: "",
    isbn: "",
    category: "",
    status: "available",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const { error } = await supabase.from("books").insert([formData])
      if (error) {
        setError("Failed to add book. Please try again.")
      } else {
        router.push("/books")
      }
    } catch {
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
                  {/* Title & Author */}
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

                  {/* ISBN & Category */}
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
                        value={formData.category}
                        onValueChange={(value) => handleInputChange("category", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {["Fiction","Non-Fiction","Science","History","Biography","Romance","Mystery","Fantasy","Dystopian","Children"].map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                      <SelectTrigger>
                        <SelectValue />
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

                  {/* Submit */}
                  <div className="flex gap-4">
                    <Button type="submit" disabled={isLoading} className="flex-1">
                      {isLoading ? <><Save className="mr-2 h-4 w-4 animate-spin" />Adding...</> : <><Save className="mr-2 h-4 w-4" />Add Book</>}
                    </Button>
                    <Link href="/books">
                      <Button type="button" variant="outline">Cancel</Button>
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
