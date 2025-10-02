"use client"

import { useState } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Filter, BookOpen, User, Calendar, Eye, Edit } from "lucide-react"
import Link from "next/link"

// Mock data - replace with actual database queries
const mockBooks = [
  {
    id: "1",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    isbn: "978-0-7432-7356-5",
    category: "Fiction",
    status: "available" as const,
    createdAt: "2024-01-15",
    description: "A classic American novel set in the Jazz Age.",
  },
  {
    id: "2",
    title: "To Kill a Mockingbird",
    author: "Harper Lee",
    isbn: "978-0-06-112008-4",
    category: "Fiction",
    status: "checked_out" as const,
    createdAt: "2024-01-10",
    description: "A gripping tale of racial injustice and childhood innocence.",
  },
  {
    id: "3",
    title: "1984",
    author: "George Orwell",
    isbn: "978-0-452-28423-4",
    category: "Dystopian",
    status: "reserved" as const,
    createdAt: "2024-01-08",
    description: "A dystopian social science fiction novel and cautionary tale.",
  },
]

const mockBorrowers = [
  {
    id: "1",
    name: "John Doe",
    email: "john.doe@email.com",
    phone: "(555) 123-4567",
    memberSince: "2023-06-15",
    activeLoans: 2,
    totalBorrowed: 15,
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane.smith@email.com",
    phone: "(555) 987-6543",
    memberSince: "2023-08-22",
    activeLoans: 1,
    totalBorrowed: 8,
  },
]

const statusColors = {
  available: "bg-green-100 text-green-800",
  checked_out: "bg-red-100 text-red-800",
  reserved: "bg-yellow-100 text-yellow-800",
}

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [searchType, setSearchType] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [activeTab, setActiveTab] = useState("books")

  const filteredBooks = mockBooks.filter((book) => {
    const matchesSearch =
      searchType === "all"
        ? book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
          book.isbn.includes(searchTerm) ||
          book.description.toLowerCase().includes(searchTerm.toLowerCase())
        : searchType === "title"
          ? book.title.toLowerCase().includes(searchTerm.toLowerCase())
          : searchType === "author"
            ? book.author.toLowerCase().includes(searchTerm.toLowerCase())
            : searchType === "isbn"
              ? book.isbn.includes(searchTerm)
              : true

    const matchesCategory = categoryFilter === "all" || book.category === categoryFilter
    const matchesStatus = statusFilter === "all" || book.status === statusFilter

    return matchesSearch && matchesCategory && matchesStatus
  })

  const filteredBorrowers = mockBorrowers.filter(
    (borrower) =>
      borrower.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      borrower.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const categories = Array.from(new Set(mockBooks.map((book) => book.category)))

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 lg:ml-64 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold text-foreground">Search</h1>
              <p className="text-muted-foreground">Find books, borrowers, and library information</p>
            </div>

            {/* Search Bar */}
            <Card>
              <CardHeader>
                <CardTitle>Advanced Search</CardTitle>
                <CardDescription>Search across books, authors, ISBN, and borrowers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search books, authors, ISBN, or borrowers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 lg:w-48 gap-4">
                    <Select value={searchType} onValueChange={setSearchType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Search type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Fields</SelectItem>
                        <SelectItem value="title">Title Only</SelectItem>
                        <SelectItem value="author">Author Only</SelectItem>
                        <SelectItem value="isbn">ISBN Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="books">Books ({filteredBooks.length})</TabsTrigger>
                <TabsTrigger value="borrowers">Borrowers ({filteredBorrowers.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="books" className="space-y-4">
                {/* Book Filters */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Book Filters
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    </div>
                  </CardContent>
                </Card>

                {/* Book Results */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredBooks.map((book) => (
                    <Card key={book.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <BookOpen className="h-5 w-5 text-muted-foreground" />
                          <Badge className={statusColors[book.status]}>
                            {book.status.replace("_", " ").toUpperCase()}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg">{book.title}</CardTitle>
                        <CardDescription>by {book.author}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <p>
                            <span className="font-medium">ISBN:</span> {book.isbn}
                          </p>
                          <p>
                            <span className="font-medium">Category:</span> {book.category}
                          </p>
                          <p>
                            <span className="font-medium">Added:</span> {new Date(book.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-muted-foreground">{book.description}</p>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                            <Eye className="mr-2 h-3 w-3" />
                            View
                          </Button>
                          <Link href={`/books/edit/${book.id}`}>
                            <Button variant="outline" size="sm">
                              <Edit className="h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredBooks.length === 0 && (
                  <Card>
                    <CardContent className="text-center py-8">
                      <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No books found</h3>
                      <p className="text-muted-foreground">Try adjusting your search terms or filters</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="borrowers" className="space-y-4">
                {/* Borrower Results */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredBorrowers.map((borrower) => (
                    <Card key={borrower.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <User className="h-5 w-5 text-muted-foreground" />
                          <Badge variant={borrower.activeLoans > 0 ? "default" : "secondary"}>
                            {borrower.activeLoans} active loans
                          </Badge>
                        </div>
                        <CardTitle className="text-lg">{borrower.name}</CardTitle>
                        <CardDescription>{borrower.email}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <p>
                            <span className="font-medium">Phone:</span> {borrower.phone}
                          </p>
                          <p>
                            <span className="font-medium">Member since:</span>{" "}
                            {new Date(borrower.memberSince).toLocaleDateString()}
                          </p>
                          <p>
                            <span className="font-medium">Total borrowed:</span> {borrower.totalBorrowed} books
                          </p>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                            <Eye className="mr-2 h-3 w-3" />
                            View Profile
                          </Button>
                          <Button variant="outline" size="sm">
                            <Calendar className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredBorrowers.length === 0 && (
                  <Card>
                    <CardContent className="text-center py-8">
                      <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No borrowers found</h3>
                      <p className="text-muted-foreground">Try adjusting your search terms</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
