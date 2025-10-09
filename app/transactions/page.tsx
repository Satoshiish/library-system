"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Search, Calendar, User, Book, ArrowUpDown } from "lucide-react"

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [borrowers, setBorrowers] = useState<any[]>([])
  const [books, setBooks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newLoan, setNewLoan] = useState({
    borrower_id: "",
    book_id: "",
    due_date: "",
  })
  const [search, setSearch] = useState({ borrower: "", book: "", date: "" })
  const [historySearch, setHistorySearch] = useState({ 
    borrower: "", 
    book: "", 
    date_from: "", 
    date_to: "",
    status: "all"
  })
  const [sortConfig, setSortConfig] = useState({ key: "due_date", direction: "desc" })

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      const [loansRes, borrowersRes, booksRes] = await Promise.all([
        supabase.from("loans").select(`
          id,
          status,
          due_date,
          returned_at,
          created_at,
          borrowers ( id, name, email ),
          books ( id, title, isbn )
        `).order("created_at", { ascending: false }),
        supabase.from("borrowers").select("id, name"),
        supabase.from("books").select("id, title").eq("status", "available")
      ])

      if (loansRes.error) console.error("❌ Loans error:", loansRes.error)
      else setTransactions(loansRes.data || [])

      if (borrowersRes.error) console.error("❌ Borrowers error:", borrowersRes.error)
      else setBorrowers(borrowersRes.data || [])

      if (booksRes.error) console.error("❌ Books error:", booksRes.error)
      else setBooks(booksRes.data || [])

      setLoading(false)
    }

    fetchData()
  }, [])

  // Mark transaction as active (borrowed → active)
  const markAsActive = async (loanId: string) => {
    const { data: loanData, error: loanFetchError } = await supabase
      .from("loans")
      .select("book_id")
      .eq("id", loanId)
      .single()

    if (loanFetchError || !loanData) {
      toast.error("Failed to activate transaction")
      return
    }

    const { error: loanUpdateError } = await supabase
      .from("loans")
      .update({ status: "active" })
      .eq("id", loanId)

    if (loanUpdateError) {
      toast.error("Failed to update transaction")
      return
    }

    const { error: bookUpdateError } = await supabase
      .from("books")
      .update({ status: "checked_out" })
      .eq("id", loanData.book_id)

    if (bookUpdateError) toast.error("Failed to update book status")

    setTransactions(prev =>
      prev.map(t => t.id === loanId ? { ...t, status: "active" } : t)
    )

    toast.success("Transaction is now active ✅")
  }

  // Mark transaction as returned (active → returned)
  const markAsReturned = async (loanId: string) => {
    const { data: loanData, error: loanFetchError } = await supabase
      .from("loans")
      .select("book_id")
      .eq("id", loanId)
      .single()

    if (loanFetchError || !loanData) {
      toast.error("Failed to process return")
      return
    }

    const now = new Date().toISOString()

    const { error: loanUpdateError } = await supabase
      .from("loans")
      .update({ status: "returned", returned_at: now })
      .eq("id", loanId)

    if (loanUpdateError) {
      toast.error("Failed to update transaction")
      return
    }

    const { error: bookUpdateError } = await supabase
      .from("books")
      .update({ status: "available" })
      .eq("id", loanData.book_id)

    if (bookUpdateError) toast.error("Failed to update book status")

    setTransactions(prev =>
      prev.map(t => t.id === loanId ? { ...t, status: "returned", returned_at: now } : t)
    )

    // Refresh available books dropdown
    const { data: refreshedBooks } = await supabase
      .from("books")
      .select("id, title")
      .eq("status", "available")
    setBooks(refreshedBooks || [])

    toast.success("Book marked as returned ✅")
  }

  // Add new transaction
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLoan.borrower_id || !newLoan.book_id || !newLoan.due_date) {
      toast.error("Please fill in all fields")
      return
    }

    const { error: loanError, data: loanData } = await supabase
      .from("loans")
      .insert({
        borrower_id: newLoan.borrower_id,
        book_id: newLoan.book_id,
        due_date: newLoan.due_date,
        status: "borrowed",
      })
      .select(`
        id,
        status,
        due_date,
        returned_at,
        created_at,
        borrowers ( id, name, email ),
        books ( id, title, isbn )
      `)
      .single()

    if (loanError || !loanData) {
      console.error("❌ Failed to add transaction:", loanError)
      toast.error("Failed to add transaction")
      return
    }

    // Update book status
    const { error: bookUpdateError } = await supabase
      .from("books")
      .update({ status: "borrowed" })
      .eq("id", newLoan.book_id)

    if (bookUpdateError) console.error("❌ Failed to update book status after borrow:", bookUpdateError)

    // Update UI
    setTransactions(prev => [loanData, ...prev])
    setNewLoan({ borrower_id: "", book_id: "", due_date: "" })

    // Refresh available books dropdown
    const { data: refreshedBooks } = await supabase
      .from("books")
      .select("id, title")
      .eq("status", "available")
    setBooks(refreshedBooks || [])

    toast.success("Transaction added successfully ✅")
  }

  // Filter active transactions based on search
  const filteredTransactions = transactions.filter(t => {
    const borrowerMatch = t.borrowers?.name.toLowerCase().includes(search.borrower.toLowerCase())
    const bookMatch = t.books?.title.toLowerCase().includes(search.book.toLowerCase())
    const dateMatch = search.date
      ? new Date(t.due_date).toISOString().split("T")[0] === search.date
      : true
    const activeStatus = t.status !== "returned"
    return borrowerMatch && bookMatch && dateMatch && activeStatus
  })

  // Filter history transactions based on search
  const filteredHistory = transactions
    .filter(t => {
      const borrowerMatch = t.borrowers?.name.toLowerCase().includes(historySearch.borrower.toLowerCase())
      const bookMatch = t.books?.title.toLowerCase().includes(historySearch.book.toLowerCase())
      const dateFromMatch = historySearch.date_from
        ? new Date(t.created_at) >= new Date(historySearch.date_from)
        : true
      const dateToMatch = historySearch.date_to
        ? new Date(t.created_at) <= new Date(historySearch.date_to + "T23:59:59")
        : true
      const statusMatch = historySearch.status === "all" || t.status === historySearch.status
      
      return borrowerMatch && bookMatch && dateFromMatch && dateToMatch && statusMatch
    })
    .sort((a, b) => {
      if (sortConfig.key) {
        const aValue = a[sortConfig.key] || (a.borrowers && a.borrowers[sortConfig.key]) || (a.books && a.books[sortConfig.key])
        const bValue = b[sortConfig.key] || (b.borrowers && b.borrowers[sortConfig.key]) || (b.books && b.books[sortConfig.key])
        
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1
      }
      return 0
    })

  // Handle sorting
  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }))
  }

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "returned": return "success"
      case "active": return "secondary"
      case "borrowed": return "warning"
      case "overdue": return "destructive"
      default: return "outline"
    }
  }

  // Check if a loan is overdue
  const isOverdue = (dueDate: string, status: string) => {
    return status !== "returned" && new Date(due_date) < new Date()
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 lg:ml-64 p-6 space-y-8">
        <h1 className="text-3xl font-bold">Transactions</h1>

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3">
            <TabsTrigger value="active">Active Transactions</TabsTrigger>
            <TabsTrigger value="history">Transaction History</TabsTrigger>
            <TabsTrigger value="new">New Transaction</TabsTrigger>
          </TabsList>

          {/* New Transaction Tab */}
          <TabsContent value="new" className="space-y-6">
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle>Add New Transaction</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddTransaction} className="grid gap-4 md:grid-cols-3">
                  <div className="flex flex-col gap-2">
                    <Label>Borrower</Label>
                    <Select
                      value={newLoan.borrower_id}
                      onValueChange={val => setNewLoan({ ...newLoan, borrower_id: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select borrower" />
                      </SelectTrigger>
                      <SelectContent>
                        {borrowers.map(b => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Book</Label>
                    <Select
                      value={newLoan.book_id}
                      onValueChange={val => setNewLoan({ ...newLoan, book_id: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select book" />
                      </SelectTrigger>
                      <SelectContent>
                        {books.map(b => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={newLoan.due_date}
                      onChange={e => setNewLoan({ ...newLoan, due_date: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-3 flex justify-end">
                    <Button type="submit">Add Transaction</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Transactions Tab */}
          <TabsContent value="active" className="space-y-6">
            {/* Search Filters */}
            <Card className="p-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label>Search Borrower</Label>
                  <Input
                    placeholder="Borrower name"
                    value={search.borrower}
                    onChange={e => setSearch({ ...search, borrower: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Search Book</Label>
                  <Input
                    placeholder="Book title"
                    value={search.book}
                    onChange={e => setSearch({ ...search, book: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Search Due Date</Label>
                  <Input
                    type="date"
                    value={search.date}
                    onChange={e => setSearch({ ...search, date: e.target.value })}
                  />
                </div>
              </div>
            </Card>

            {/* Active Transactions Table */}
            {loading ? (
              <p>Loading...</p>
            ) : filteredTransactions.length === 0 ? (
              <div className="border rounded-md p-6 text-center text-muted-foreground">
                No active transactions found.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="p-3">Borrower</th>
                      <th className="p-3">Book</th>
                      <th className="p-3">Due Date</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map(t => (
                      <tr key={t.id} className="border-t hover:bg-muted/30">
                        <td className="p-3">{t.borrowers?.name}</td>
                        <td className="p-3">{t.books?.title}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {new Date(t.due_date).toLocaleDateString()}
                            {isOverdue(t.due_date, t.status) && (
                              <Badge variant="destructive" className="ml-2 text-xs">
                                Overdue
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant={getStatusVariant(t.status)}>
                            {t.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right flex gap-2 justify-end">
                          {t.status === "borrowed" && (
                            <Button size="sm" variant="outline" onClick={() => markAsActive(t.id)}>
                              Activate
                            </Button>
                          )}
                          {t.status !== "returned" && (
                            <Button size="sm" variant="outline" onClick={() => markAsReturned(t.id)}>
                              Mark as Returned
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Transaction History Tab */}
          <TabsContent value="history" className="space-y-6">
            {/* History Search Filters */}
            <Card className="p-4">
              <div className="grid gap-4 md:grid-cols-5">
                <div className="flex flex-col gap-2">
                  <Label>Borrower</Label>
                  <Input
                    placeholder="Borrower name"
                    value={historySearch.borrower}
                    onChange={e => setHistorySearch({ ...historySearch, borrower: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Book</Label>
                  <Input
                    placeholder="Book title"
                    value={historySearch.book}
                    onChange={e => setHistorySearch({ ...historySearch, book: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>From Date</Label>
                  <Input
                    type="date"
                    value={historySearch.date_from}
                    onChange={e => setHistorySearch({ ...historySearch, date_from: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>To Date</Label>
                  <Input
                    type="date"
                    value={historySearch.date_to}
                    onChange={e => setHistorySearch({ ...historySearch, date_to: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Status</Label>
                  <Select
                    value={historySearch.status}
                    onValueChange={val => setHistorySearch({ ...historySearch, status: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="borrowed">Borrowed</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Transaction History Table */}
            {loading ? (
              <p>Loading history...</p>
            ) : filteredHistory.length === 0 ? (
              <div className="border rounded-md p-6 text-center text-muted-foreground">
                No transaction history found.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th 
                        className="p-3 cursor-pointer hover:bg-muted/70"
                        onClick={() => handleSort("created_at")}
                      >
                        <div className="flex items-center gap-1">
                          Date
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th 
                        className="p-3 cursor-pointer hover:bg-muted/70"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-1">
                          Borrower
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th 
                        className="p-3 cursor-pointer hover:bg-muted/70"
                        onClick={() => handleSort("title")}
                      >
                        <div className="flex items-center gap-1">
                          Book
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th className="p-3">Due Date</th>
                      <th className="p-3">Returned Date</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map(t => (
                      <tr key={t.id} className="border-t hover:bg-muted/30">
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(t.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {t.borrowers?.name}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Book className="h-3 w-3 text-muted-foreground" />
                            {t.books?.title}
                          </div>
                        </td>
                        <td className="p-3">
                          {new Date(t.due_date).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          {t.returned_at ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <Calendar className="h-3 w-3" />
                              {new Date(t.returned_at).toLocaleDateString()}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not returned</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant={getStatusVariant(t.status)}>
                            {t.status}
                            {isOverdue(t.due_date, t.status) && " (Overdue)"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* History Summary */}
            {!loading && filteredHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">History Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {filteredHistory.length}
                      </div>
                      <div className="text-muted-foreground">Total Records</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {filteredHistory.filter(t => t.status === "returned").length}
                      </div>
                      <div className="text-muted-foreground">Returned</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {filteredHistory.filter(t => t.status === "active").length}
                      </div>
                      <div className="text-muted-foreground">Active</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {filteredHistory.filter(t => isOverdue(t.due_date, t.status)).length}
                      </div>
                      <div className="text-muted-foreground">Overdue</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}