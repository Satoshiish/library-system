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
import { Search, Calendar, User, Book, ArrowUpDown, AlertTriangle, Clock } from "lucide-react"
import emailjs from "@emailjs/browser"

interface Transaction {
  id: string
  status: string
  due_date: string
  returned_date: string | null
  created_at: string
  loan_date: string
  patron_id: string
  book_id: string
  borrowers?: {
    id: string
    name: string
    email: string
  }
  books?: {
    id: string
    title: string
    author: string
    isbn: string
  }
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [borrowers, setBorrowers] = useState<any[]>([])
  const [books, setBooks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newLoan, setNewLoan] = useState({
    patron_id: "",
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
  const [sortConfig, setSortConfig] = useState({ key: "due_date", direction: "asc" }) // Default sort by due date ascending

  // Fetch data with proper error handling
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        console.log("🔍 Starting data fetch...")

        // Fetch all data separately to debug relationships
        const [
          { data: loansData, error: loansError },
          { data: borrowersData, error: borrowersError },
          { data: booksData, error: booksError }
        ] = await Promise.all([
          // Try to fetch loans with joins first
          supabase
          .from("loans")
          .select(`
            id,
            status,
            due_date,
            returned_date,
            created_at,
            loan_date,
            patron_id,
            book_id,
            borrowers:borrowers!loans_patron_id_fkey ( id, name, email ),
            books:books!loans_book_id_fkey ( id, title, author, isbn )
          `)
            .order("created_at", { ascending: false }),
          
          // Fetch all borrowers
          supabase
            .from("borrowers")
            .select("id, name, email, phone, status")
            .order("name"),
          
          // Fetch available books
          supabase
            .from("books")
            .select("id, title, author, isbn, status")
            .eq("status", "available")
            .order("title")
        ])

        // Handle loans data
        if (loansError) {
          console.error("❌ Loans join error:", loansError)
          
          // If join fails, fetch loans without joins and we'll manually link the data
          const { data: simpleLoans, error: simpleError } = await supabase
            .from("loans")
            .select("*")
            .order("created_at", { ascending: false })
          
          if (simpleError) {
            console.error("❌ Simple loans error:", simpleError)
            setTransactions([])
          } else {
            console.log("📋 Loans without joins:", simpleLoans)
            setTransactions(simpleLoans || [])
          }
        } else {
          console.log("✅ Loans with joins:", loansData)
          setTransactions(loansData || [])
        }

        // Handle borrowers data
        if (borrowersError) {
          console.error("❌ Borrowers error:", borrowersError)
          setBorrowers([])
        } else {
          console.log("✅ Borrowers:", borrowersData)
          setBorrowers(borrowersData || [])
        }

        // Handle books data
        if (booksError) {
          console.error("❌ Books error:", booksError)
          setBooks([])
        } else {
          console.log("✅ Books:", booksData)
          setBooks(booksData || [])
        }

      } catch (error) {
        console.error("❌ Unexpected error:", error)
        toast.error("Failed to load data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Function to check if a transaction is overdue
  const isOverdue = (transaction: Transaction): boolean => {
    // If already returned, not overdue
    if (transaction.status === "returned" || transaction.returned_date) {
      return false
    }
    
    // Compare due date with current date
    const dueDate = new Date(transaction.due_date)
    const today = new Date()
    
    // Set both dates to start of day for accurate comparison
    dueDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    
    return dueDate < today
  }

  // Function to calculate days overdue
  const getDaysOverdue = (transaction: Transaction): number => {
    if (!isOverdue(transaction)) return 0
    
    const dueDate = new Date(transaction.due_date)
    const today = new Date()
    
    // Calculate difference in days
    const diffTime = today.getTime() - dueDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return Math.max(0, diffDays)
  }

  // Function to get overdue status text
  const getOverdueStatus = (transaction: Transaction): string => {
    if (!isOverdue(transaction)) return ""
    
    const daysOverdue = getDaysOverdue(transaction)
    if (daysOverdue === 1) return "1 day overdue"
    return `${daysOverdue} days overdue`
  }

  // Function to get overdue badge variant based on severity
  const getOverdueSeverity = (transaction: Transaction): "warning" | "destructive" => {
    const daysOverdue = getDaysOverdue(transaction)
    if (daysOverdue <= 7) return "warning"
    return "destructive"
  }

  // Function to manually link data when joins fail
  const getEnhancedTransactions = () => {
    return transactions.map(transaction => {
      // If joins already worked, return as is
      if (transaction.borrowers && transaction.books) {
        return transaction
      }

      // Otherwise, manually link the data
      const borrower = borrowers.find(b => b.id === transaction.patron_id)
      const book = books.find(b => b.id === transaction.book_id)
      
      return {
        ...transaction,
        borrowers: borrower || undefined,
        books: book || undefined
      }
    })
  }

  // Enhanced function to get borrower name with multiple fallbacks
  const getBorrowerName = (transaction: Transaction) => {
    // Try joined data first
    if (transaction.borrowers?.name) {
      return transaction.borrowers.name
    }
    
    // Try local borrowers array
    const borrower = borrowers.find(b => b.id === transaction.patron_id)
    if (borrower?.name) {
      return borrower.name
    }
    
    // Final fallback
    return `Borrower #${transaction.patron_id?.substring(0, 8)}...`
  }

  // Enhanced function to get book title with multiple fallbacks
  const getBookTitle = (transaction: Transaction) => {
    // Try joined data first
    if (transaction.books?.title) {
      return transaction.books.title
    }
    
    // Try local books array
    const book = books.find(b => b.id === transaction.book_id)
    if (book?.title) {
      return book.title
    }
    
    // Final fallback
    return `Book #${transaction.book_id?.substring(0, 8)}...`
  }

  // Get all overdue transactions
  const getOverdueTransactions = () => {
    return enhancedTransactions.filter(transaction => isOverdue(transaction))
  }

  // Debug function to check data relationships
  const debugDataRelationships = async () => {
    try {
      toast.loading("Checking data relationships...")
      
      // Get sample data to check relationships
      const { data: sampleLoans, error: loansError } = await supabase
        .from("loans")
        .select("id, patron_id, book_id, due_date, status")
        .limit(5)

      if (loansError) throw loansError

      const { data: sampleBorrowers, error: borrowersError } = await supabase
        .from("borrowers")
        .select("id, name")
        .limit(5)

      if (borrowersError) throw borrowersError

      const { data: sampleBooks, error: booksError } = await supabase
        .from("books")
        .select("id, title")
        .limit(5)

      if (booksError) throw booksError

      console.log("🔍 DATA RELATIONSHIP CHECK:")
      console.log("Sample Loans:", sampleLoans)
      console.log("Sample Borrowers:", sampleBorrowers)
      console.log("Sample Books:", sampleBooks)

      // Check if patron_ids in loans exist in borrowers
      if (sampleLoans && sampleBorrowers) {
        const borrowerIds = sampleBorrowers.map(b => b.id)
        const invalidLoans = sampleLoans.filter(loan => !borrowerIds.includes(loan.patron_id))
        
        if (invalidLoans.length > 0) {
          console.warn("⚠️ Loans with invalid patron_ids:", invalidLoans)
          toast.warning(`Found ${invalidLoans.length} loans with invalid borrower references`)
        } else {
          console.log("✅ All sample loans have valid patron_ids")
          toast.success("All loans have valid borrower references!")
        }
      }

    } catch (error) {
      console.error("❌ Error checking data relationships:", error)
      toast.error("Failed to check data relationships")
    }
  }

  // Mark transaction as active
  const markAsActive = async (loanId: string) => {
    try {
      const { error: loanUpdateError } = await supabase
        .from("loans")
        .update({ status: "active" })
        .eq("id", loanId)

      if (loanUpdateError) throw loanUpdateError

      // Update local state
      setTransactions(prev =>
        prev.map(t => t.id === loanId ? { ...t, status: "active" } : t)
      )

      toast.success("Transaction is now active ✅")
    } catch (error) {
      console.error("❌ Error activating transaction:", error)
      toast.error("Failed to activate transaction")
    }
  }

  // Mark transaction as returned
  const markAsReturned = async (loanId: string) => {
    try {
      const now = new Date().toISOString()

      const { error: loanUpdateError } = await supabase
        .from("loans")
        .update({ 
          status: "returned", 
          returned_date: now 
        })
        .eq("id", loanId)

      if (loanUpdateError) throw loanUpdateError

      // Update local state
      setTransactions(prev =>
        prev.map(t => t.id === loanId ? { 
          ...t, 
          status: "returned", 
          returned_date: now 
        } : t)
      )

      // Refresh available books
      const { data: refreshedBooks } = await supabase
        .from("books")
        .select("id, title, author")
        .eq("status", "available")
      setBooks(refreshedBooks || [])

      toast.success("Book marked as returned ✅")
    } catch (error) {
      console.error("❌ Error returning book:", error)
      toast.error("Failed to process return")
    }
  }

  const sendOverdueReminder = async (transaction: Transaction) => {
  try {
    const borrowerEmail = transaction.borrowers?.email
    const borrowerName = getBorrowerName(transaction)
    const bookTitle = getBookTitle(transaction)
    const daysOverdue = getDaysOverdue(transaction)
    const dueDate = new Date(transaction.due_date).toLocaleDateString()

    if (!borrowerEmail) {
      toast.error("This borrower has no email address on file.")
      return
    }

    // Show a loading toast while sending
    const loadingToast = toast.loading(`Sending reminder to ${borrowerName}...`)

    // ✅ Send the email via EmailJS
    const response = await emailjs.send(
      "service_1lboc1u",       // Your EmailJS Service ID
      "template_w24leai",      // Your EmailJS Template ID
      {
        to_email: borrowerEmail,
        to_name: borrowerName,
        book_title: bookTitle,
        days_overdue: daysOverdue,
        due_date: dueDate,
        message: `This is a friendly reminder that the book "${bookTitle}" was due on ${dueDate} and is now ${daysOverdue} day(s) overdue. Please return it as soon as possible.`,
      },
      "VciD--jXYRWjpdqNe"      // Your EmailJS Public Key
    )

    // Dismiss the loading toast
    toast.dismiss(loadingToast)

    if (response.status === 200) {
      // ✅ Success toast when message is sent
      toast.success(`Overdue reminder successfully sent to ${borrowerName} 📧`, {
        description: `Email sent to ${borrowerEmail}`,
      })
    } else {
      toast.error("Failed to send reminder. Please try again.")
    }
  } catch (error) {
    console.error("❌ Email send error:", error)
    toast.error("Error sending overdue reminder.")
  }
}

  // Add new transaction
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLoan.patron_id || !newLoan.book_id || !newLoan.due_date) {
      toast.error("Please fill in all fields")
      return
    }

    try {
      const { error: loanError, data: loanData } = await supabase
        .from("loans")
        .insert({
          patron_id: newLoan.patron_id,
          book_id: newLoan.book_id,
          due_date: newLoan.due_date,
          loan_date: new Date().toISOString(),
          status: "borrowed",
        })
        .select()
        .single()

      if (loanError) throw loanError

      // Update book status
      await supabase
        .from("books")
        .update({ status: "borrowed" })
        .eq("id", newLoan.book_id)

      // Refresh transactions to get the new one with proper joins
      const { data: refreshedLoans, error: refreshError } = await supabase
        .from("loans")
        .select(`
          *,
          borrowers!loans_patron_id_fkey ( id, name, email ),
          books!loans_book_id_fkey ( id, title, author, isbn )
        `)
        .order("created_at", { ascending: false })

      if (!refreshError && refreshedLoans) {
        setTransactions(refreshedLoans)
      } else {
        // Fallback: add the basic loan data
        setTransactions(prev => [loanData, ...prev])
      }

      // Reset form
      setNewLoan({ patron_id: "", book_id: "", due_date: "" })

      // Refresh available books
      const { data: refreshedBooks } = await supabase
        .from("books")
        .select("id, title, author")
        .eq("status", "available")
      setBooks(refreshedBooks || [])

      toast.success("Transaction added successfully ✅")
    } catch (error) {
      console.error("❌ Error adding transaction:", error)
      toast.error("Failed to add transaction")
    }
  }

  // Use enhanced transactions for display
  const enhancedTransactions = getEnhancedTransactions()

  // Get overdue transactions
  const overdueTransactions = getOverdueTransactions()

  // Filter active transactions based on search
  const filteredTransactions = enhancedTransactions.filter(t => {
    const borrowerName = getBorrowerName(t).toLowerCase()
    const bookTitle = getBookTitle(t).toLowerCase()
    const borrowerMatch = borrowerName.includes(search.borrower.toLowerCase())
    const bookMatch = bookTitle.includes(search.book.toLowerCase())
    const dateMatch = search.date
      ? new Date(t.due_date).toISOString().split("T")[0] === search.date
      : true
    const activeStatus = t.status !== "returned"
    return borrowerMatch && bookMatch && dateMatch && activeStatus
  })

  // Filter history transactions based on search
  const filteredHistory = enhancedTransactions
    .filter(t => {
      const borrowerName = getBorrowerName(t).toLowerCase()
      const bookTitle = getBookTitle(t).toLowerCase()
      const borrowerMatch = borrowerName.includes(historySearch.borrower.toLowerCase())
      const bookMatch = bookTitle.includes(historySearch.book.toLowerCase())
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
        let aValue, bValue
        
        if (sortConfig.key === "name") {
          aValue = getBorrowerName(a)
          bValue = getBorrowerName(b)
        } else if (sortConfig.key === "title") {
          aValue = getBookTitle(a)
          bValue = getBookTitle(b)
        } else {
          aValue = a[sortConfig.key as keyof Transaction] || ""
          bValue = b[sortConfig.key as keyof Transaction] || ""
        }
        
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
      default: return "outline"
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 lg:ml-64 p-6 space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Transactions</h1>
          <Button variant="outline" onClick={debugDataRelationships}>
            Debug Data Relationships
          </Button>
        </div>

        {/* Overdue Items Alert Banner */}
        {overdueTransactions.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <div>
                    <h3 className="font-semibold text-red-900">
                      {overdueTransactions.length} Overdue Item{overdueTransactions.length !== 1 ? 's' : ''}
                    </h3>
                    <p className="text-sm text-red-700">
                      {overdueTransactions.length} item{overdueTransactions.length !== 1 ? 's' : ''} past due date. Please follow up with borrowers.
                    </p>
                  </div>
                </div>
                <Badge variant="destructive" className="text-sm">
                  Attention Required
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="active">Active Transactions</TabsTrigger>
            <TabsTrigger value="overdue">
              Overdue Items
              {overdueTransactions.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                  {overdueTransactions.length}
                </Badge>
              )}
            </TabsTrigger>
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
                      value={newLoan.patron_id}
                      onValueChange={val => setNewLoan({ ...newLoan, patron_id: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select borrower" />
                      </SelectTrigger>
                      <SelectContent>
                        {borrowers.map(b => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name} {b.email && `(${b.email})`}
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
                            {b.title} by {b.author}
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
                      min={new Date().toISOString().split('T')[0]}
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
              <div className="flex justify-center items-center p-8">
                <p>Loading transactions...</p>
              </div>
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
                      <tr 
                        key={t.id} 
                        className={`border-t hover:bg-muted/30 ${
                          isOverdue(t) ? 'bg-red-50 hover:bg-red-100' : ''
                        }`}
                      >
                        <td className="p-3 font-medium">
                          <div className="flex items-center gap-2">
                            {isOverdue(t) && <AlertTriangle className="h-4 w-4 text-red-500" />}
                            {getBorrowerName(t)}
                          </div>
                        </td>
                        <td className="p-3">{getBookTitle(t)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {new Date(t.due_date).toLocaleDateString()}
                            {isOverdue(t) && (
                              <Badge variant={getOverdueSeverity(t)} className="ml-2 text-xs">
                                {getOverdueStatus(t)}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            <Badge variant={getStatusVariant(t.status)}>
                              {t.status}
                            </Badge>
                            {isOverdue(t) && (
                              <Badge variant="destructive" className="text-xs">
                                Overdue
                              </Badge>
                            )}
                          </div>
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
                          {isOverdue(t) && (
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              onClick={() => sendOverdueReminder(t)}
                            >
                              Send Reminder
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

          {/* Overdue Items Tab */}
          <TabsContent value="overdue" className="space-y-6">
            {loading ? (
              <div className="flex justify-center items-center p-8">
                <p>Loading overdue items...</p>
              </div>
            ) : overdueTransactions.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Clock className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Overdue Items</h3>
                  <p className="text-muted-foreground">
                    Great! All items have been returned on time or are not yet due.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Overdue Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-5 w-5" />
                      Overdue Items Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                          {overdueTransactions.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Overdue</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">
                          {overdueTransactions.filter(t => getDaysOverdue(t) <= 7).length}
                        </div>
                        <div className="text-sm text-muted-foreground">1-7 Days Overdue</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-red-700">
                          {overdueTransactions.filter(t => getDaysOverdue(t) > 7).length}
                        </div>
                        <div className="text-sm text-muted-foreground">8+ Days Overdue</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Overdue Items Table */}
                <div className="overflow-x-auto rounded-md border border-red-200">
                  <table className="w-full text-sm">
                    <thead className="bg-red-50">
                      <tr className="text-left">
                        <th className="p-3">Borrower</th>
                        <th className="p-3">Book</th>
                        <th className="p-3">Due Date</th>
                        <th className="p-3">Days Overdue</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdueTransactions
                        .sort((a, b) => getDaysOverdue(b) - getDaysOverdue(a)) // Sort by most overdue first
                        .map(t => (
                        <tr key={t.id} className="border-t border-red-100 bg-red-50 hover:bg-red-100">
                          <td className="p-3 font-medium">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                              {getBorrowerName(t)}
                            </div>
                          </td>
                          <td className="p-3">{getBookTitle(t)}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1 text-red-700">
                              <Calendar className="h-3 w-3" />
                              {new Date(t.due_date).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant={getOverdueSeverity(t)}>
                              {getDaysOverdue(t)} day{getDaysOverdue(t) !== 1 ? 's' : ''} overdue
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant={getStatusVariant(t.status)}>
                              {t.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right flex gap-2 justify-end">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => markAsReturned(t.id)}
                            >
                              Mark Returned
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              onClick={() => sendOverdueReminder(t)}
                            >
                              Send Reminder
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
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
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Transaction History Table */}
            {loading ? (
              <div className="flex justify-center items-center p-8">
                <p>Loading history...</p>
              </div>
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
                      <tr 
                        key={t.id} 
                        className={`border-t hover:bg-muted/30 ${
                          isOverdue(t) ? 'bg-red-50 hover:bg-red-100' : ''
                        }`}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(t.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="p-3 font-medium">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {getBorrowerName(t)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Book className="h-3 w-3 text-muted-foreground" />
                            {getBookTitle(t)}
                          </div>
                        </td>
                        <td className="p-3">
                          {new Date(t.due_date).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          {t.returned_date ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <Calendar className="h-3 w-3" />
                              {new Date(t.returned_date).toLocaleDateString()}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not returned</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            <Badge variant={getStatusVariant(t.status)}>
                              {t.status}
                            </Badge>
                            {isOverdue(t) && (
                              <Badge variant="destructive" className="text-xs">
                                Overdue ({getDaysOverdue(t)} days)
                              </Badge>
                            )}
                          </div>
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
                        {filteredHistory.filter(t => isOverdue(t)).length}
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