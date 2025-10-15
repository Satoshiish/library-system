"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Search, Calendar, User, Book, ArrowUpDown, AlertTriangle, Clock, Plus, Loader2, Filter, History, Activity, Mail, Phone, RefreshCw, Hash, X } from "lucide-react"
import emailjs from "@emailjs/browser"
import { cn } from "@/lib/utils"
import { AuthGuard } from "@/components/auth-guard"

interface Transaction {
  id: string
  status: string
  due_date: string
  returned_date: string | null
  created_at: string
  loan_date: string
  patron_id: string
  book_id: string
  patrons?: {
    id: string
    full_name: string
    email: string
    phone?: string
    status: string
  }
  books?: {
    id: string
    title: string
    author: string
    isbn: string
    category: string
    status: string
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
  const [sortConfig, setSortConfig] = useState({ key: "due_date", direction: "asc" })
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("active")
  const [addTransactionModalOpen, setAddTransactionModalOpen] = useState(false)

  // Fetch data with proper error handling
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        console.log("🔍 Starting data fetch...");

        // Fetch loans (with joins), ONLY ACTIVE PATRONS, and books in parallel
        const [
          { data: loansData, error: loansError },
          { data: patronsData, error: patronsError },
          { data: booksData, error: booksError },
        ] = await Promise.all([
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
              patrons:patrons!loans_patron_id_fkey (
                id,
                full_name,
                email,
                phone,
                status
              ),
              books:books!loans_book_id_fkey (
                id,
                title,
                author,
                isbn,
                category,
                status
              )
            `)
            .order("created_at", { ascending: false }),

          supabase
            .from("patrons")
            .select("id, full_name, email, phone, status, member_since")
            .eq("status", "active") // ONLY FETCH ACTIVE PATRONS
            .order("full_name"),

          supabase
            .from("books")
            .select("id, title, author, isbn, category, status")
            .order("title"),
        ]);

        // Handle LOANS - FIXED: Better error handling and data enhancement
        if (loansError) {
          console.error("❌ Loans join error:", loansError);
          const { data: simpleLoans, error: simpleError } = await supabase
            .from("loans")
            .select("*")
            .order("created_at", { ascending: false });

          if (simpleError) {
            console.error("❌ Simple loans error:", simpleError);
            setTransactions([]);
          } else {
            // Manually enhance loans with book and patron data
            const manuallyEnhancedLoans = await Promise.all(
              (simpleLoans || []).map(async (loan) => {
                try {
                  // Fetch patron data
                  const { data: patron } = await supabase
                    .from("patrons")
                    .select("id, full_name, email, phone, status")
                    .eq("id", loan.patron_id)
                    .single();

                  // Fetch book data
                  const { data: book } = await supabase
                    .from("books")
                    .select("id, title, author, isbn, category, status")
                    .eq("id", loan.book_id)
                    .single();

                  return {
                    ...loan,
                    patrons: patron || null,
                    books: book || null
                  };
                } catch (error) {
                  console.error(`Error enhancing loan ${loan.id}:`, error);
                  return loan;
                }
              })
            );
            setTransactions(manuallyEnhancedLoans);
          }
        } else {
          console.log("✅ Loans join successful, data:", loansData);
          setTransactions(loansData || []);
        }

        // Handle PATRONS
        if (patronsError) {
          console.error("❌ Patrons error:", patronsError);
          setBorrowers([]);
        } else {
          console.log(`📊 Loaded ${patronsData?.length || 0} ACTIVE patrons from database`);
          setBorrowers(patronsData || []);
        }

        // Handle BOOKS - Store ALL books, not just available ones
        if (booksError) {
          console.error("❌ Books error:", booksError);
          setBooks([]);
        } else {
          // Store ALL books for transaction display
          console.log(`📚 Loaded ${booksData?.length || 0} total books`);
          setBooks(booksData || []);
        }

      } catch (error) {
        console.error("❌ Unexpected error:", error);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Add real-time subscriptions
  useEffect(() => {
    const loansSubscription = supabase
      .channel('loans-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loans'
        },
        (payload) => {
          console.log('📖 Real-time loan update:', payload);
          toast.info("Transactions updated", {
            description: "Refreshing data..."
          });
          // Refresh data
          fetchData();
        }
      )
      .subscribe()

    return () => {
      loansSubscription.unsubscribe()
    }
  }, [])

  // Reset new loan form
  const resetNewLoanForm = () => {
    setNewLoan({ patron_id: "", book_id: "", due_date: "" })
  }

  // Refresh function
  const fetchData = async () => {
    try {
      setLoading(true);
      console.log("🔄 Refreshing data...");

      const [
        { data: loansData, error: loansError },
        { data: patronsData, error: patronsError },
        { data: booksData, error: booksError },
      ] = await Promise.all([
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
            patrons:patrons!loans_patron_id_fkey (
              id,
              full_name,
              email,
              phone,
              status
            ),
            books:books!loans_book_id_fkey (
              id,
              title,
              author,
              isbn,
              category,
              status
            )
          `)
          .order("created_at", { ascending: false }),

        supabase
          .from("patrons")
          .select("id, full_name, email, phone, status, member_since")
          .eq("status", "active") // ONLY REFRESH ACTIVE PATRONS
          .order("full_name"),

        supabase
          .from("books")
          .select("id, title, author, isbn, category, status")
          .order("title"),
      ]);

      if (!loansError) {
        setTransactions(loansData || []);
      }
      if (!patronsError) {
        setBorrowers(patronsData || []);
      }
      if (!booksError) {
        setBooks(booksData || []);
      }

    } catch (error) {
      console.error("❌ Error refreshing data:", error);
      toast.error("Failed to refresh data");
    } finally {
      setLoading(false);
    }
  }

  // Function to check if a transaction is overdue
  const isOverdue = (transaction: Transaction): boolean => {
    if (transaction.status === "returned" || transaction.returned_date) {
      return false
    }
    
    const dueDate = new Date(transaction.due_date)
    const today = new Date()
    
    dueDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    
    return dueDate < today
  }

  // Function to calculate days overdue
  const getDaysOverdue = (transaction: Transaction): number => {
    if (!isOverdue(transaction)) return 0
    
    const dueDate = new Date(transaction.due_date)
    const today = new Date()
    
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
      if (transaction.patrons && transaction.books) {
        return transaction
      }

      const patron = borrowers.find(b => b.id === transaction.patron_id)
      const book = books.find(b => b.id === transaction.book_id)
      
      return {
        ...transaction,
        patrons: patron || undefined,
        books: book || undefined
      }
    })
  }

  // Enhanced function to get borrower name with multiple fallbacks
  const getBorrowerName = (transaction: Transaction) => {
    if (transaction.patrons?.full_name) {
      return transaction.patrons.full_name
    }
    
    const patron = borrowers.find(b => b.id === transaction.patron_id)
    if (patron?.full_name) {
      return patron.full_name
    }
    
    return `Patron #${transaction.patron_id?.substring(0, 8)}...`
  }

  // Enhanced function to get book title with multiple fallbacks
  const getBookTitle = (transaction: Transaction) => {
    // First try: Direct book data from join
    if (transaction.books?.title) {
      return transaction.books.title;
    }
    
    // Second try: Look in books array
    const bookFromArray = books.find(b => b.id === transaction.book_id);
    if (bookFromArray?.title) {
      return bookFromArray.title;
    }
    
    // Final fallback: Show ID
    console.warn(`❌ No book title found for book_id: ${transaction.book_id}`);
    return `Book #${transaction.book_id?.substring(0, 8)}...`;
  }

  // Get book author for display
  const getBookAuthor = (transaction: Transaction) => {
    if (transaction.books?.author) {
      return transaction.books.author;
    }
    
    const bookFromArray = books.find(b => b.id === transaction.book_id);
    if (bookFromArray?.author) {
      return bookFromArray.author;
    }
    
    return "Unknown Author";
  }

  // Get all overdue transactions
  const getOverdueTransactions = () => {
    return enhancedTransactions.filter(transaction => isOverdue(transaction))
  }

  // Debug function to check data relationships
  const debugDataRelationships = async () => {
    try {
      toast.loading("Checking data relationships...")
      
      const [
        { data: sampleLoans, error: loansError },
        { data: samplePatrons, error: patronsError },
        { data: sampleBooks, error: booksError },
      ] = await Promise.all([
        supabase.from("loans").select("id, patron_id, book_id, due_date, status").limit(5),
        supabase.from("patrons").select("id, full_name").limit(5),
        supabase.from("books").select("id, title").limit(5),
      ])

      if (loansError) throw loansError
      if (patronsError) throw patronsError
      if (booksError) throw booksError

      console.log("🔍 DATA RELATIONSHIP CHECK:", { sampleLoans, samplePatrons, sampleBooks })

      if (sampleLoans && samplePatrons) {
        const patronIds = samplePatrons.map(b => b.id)
        const invalidLoans = sampleLoans.filter(loan => !patronIds.includes(loan.patron_id))
        
        if (invalidLoans.length > 0) {
          console.warn("⚠️ Loans with invalid patron_ids:", invalidLoans)
          toast.warning(`Found ${invalidLoans.length} loans with invalid patron references`)
        } else {
          console.log("✅ All sample loans have valid patron_ids")
          toast.success("All loans have valid patron references!")
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

      setTransactions(prev =>
        prev.map(t => t.id === loanId ? { ...t, status: "active" } : t)
      )

      toast.success("Transaction is now active ✅")
    } catch (error) {
      console.error("❌ Error activating transaction:", error)
      toast.error("Failed to activate transaction")
    }
  }

  // Mark transaction as returned with book status update
  const markAsReturned = async (loanId: string) => {
    try {
      const now = new Date().toISOString()
      const transaction = transactions.find(t => t.id === loanId)

      if (!transaction) {
        toast.error("Transaction not found")
        return
      }

      const { error: loanUpdateError } = await supabase
        .from("loans")
        .update({ 
          status: "returned", 
          returned_date: now 
        })
        .eq("id", loanId)

      if (loanUpdateError) throw loanUpdateError

      // Update book status back to "available"
      const { error: bookUpdateError } = await supabase
        .from("books")
        .update({ status: "available" })
        .eq("id", transaction.book_id)

      if (bookUpdateError) throw bookUpdateError

      // Update local state
      setTransactions(prev =>
        prev.map(t => t.id === loanId ? { 
          ...t, 
          status: "returned", 
          returned_date: now 
        } : t)
      )

      // Refresh books data to reflect status change
      const { data: refreshedBooks } = await supabase
        .from("books")
        .select("id, title, author, status")
      setBooks(prev => {
        const updatedBooks = [...prev];
        const bookIndex = updatedBooks.findIndex(b => b.id === transaction.book_id);
        if (bookIndex !== -1) {
          updatedBooks[bookIndex] = { ...updatedBooks[bookIndex], status: "available" };
        }
        return updatedBooks;
      })

      toast.success("Book marked as returned ✅")
    } catch (error) {
      console.error("❌ Error returning book:", error)
      toast.error("Failed to process return")
    }
  }

  const sendOverdueReminder = async (transaction: Transaction) => {
    try {
      const borrowerEmail = transaction.patrons?.email
      const borrowerName = getBorrowerName(transaction)
      const bookTitle = getBookTitle(transaction)
      const daysOverdue = getDaysOverdue(transaction)
      const dueDate = new Date(transaction.due_date).toLocaleDateString()

      if (!borrowerEmail) {
        toast.error("This patron has no email address on file.")
        return
      }

      const loadingToast = toast.loading(`Sending reminder to ${borrowerName}...`)

      const response = await emailjs.send(
        "service_1lboc1u",
        "template_w24leai",
        {
          to_email: borrowerEmail,
          to_name: borrowerName,
          book_title: bookTitle,
          days_overdue: daysOverdue,
          due_date: dueDate,
          message: `This is a friendly reminder that the book "${bookTitle}" was due on ${dueDate} and is now ${daysOverdue} day(s) overdue. Please return it as soon as possible.`,
        },
        "VciD--jXYRWjpdqNe"
      )

      toast.dismiss(loadingToast)

      if (response.status === 200) {
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

  // Add new transaction with book status validation
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLoan.patron_id || !newLoan.book_id || !newLoan.due_date) {
      toast.error("Please fill in all fields")
      return
    }

    setSubmitting(true)
    try {
      // Check if the selected book is available
      const selectedBook = books.find(book => book.id === newLoan.book_id);
      
      if (!selectedBook) {
        toast.error("Selected book not found");
        return;
      }

      if (selectedBook.status !== "available") {
        toast.error(`This book is currently ${selectedBook.status}. Please select an available book.`);
        return;
      }

      // Additional validation: ensure patron is active
      const selectedPatron = borrowers.find(patron => patron.id === newLoan.patron_id);
      if (!selectedPatron || selectedPatron.status !== "active") {
        toast.error("Selected patron is not active. Please select an active patron.");
        return;
      }

      // Create the loan transaction
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

      // Update book status to "borrowed"
      const { error: bookUpdateError } = await supabase
        .from("books")
        .update({ status: "borrowed" })
        .eq("id", newLoan.book_id)

      if (bookUpdateError) throw bookUpdateError

      // Refresh transactions data
      const { data: refreshedLoans, error: refreshError } = await supabase
        .from("loans")
        .select(`
          *,
          patrons:patrons!loans_patron_id_fkey ( id, full_name, email ),
          books:books!loans_book_id_fkey ( id, title, author, isbn, status )
        `)
        .order("created_at", { ascending: false })

      if (!refreshError && refreshedLoans) {
        setTransactions(refreshedLoans)
      } else {
        setTransactions(prev => [loanData, ...prev])
      }

      // Reset form and refresh books data
      resetNewLoanForm()
      setAddTransactionModalOpen(false)

      // Update local books state
      setBooks(prev => {
        const updatedBooks = [...prev];
        const bookIndex = updatedBooks.findIndex(b => b.id === newLoan.book_id);
        if (bookIndex !== -1) {
          updatedBooks[bookIndex] = { ...updatedBooks[bookIndex], status: "borrowed" };
        }
        return updatedBooks;
      })

      toast.success("Transaction added successfully ✅")
    } catch (error) {
      console.error("❌ Error adding transaction:", error)
      toast.error("Failed to add transaction")
    } finally {
      setSubmitting(false)
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
    
    // Include both "active" and "borrowed" status as active transactions
    const activeStatus = t.status === "active" || t.status === "borrowed"
    
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

  // Stats calculations
  const totalTransactions = enhancedTransactions.length
  const activeTransactions = enhancedTransactions.filter(t => t.status !== "returned").length
  const returnedTransactions = enhancedTransactions.filter(t => t.status === "returned").length

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-100/50">
        <Sidebar />

        <main className="flex-1 lg:ml-64 p-6 space-y-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Transactions
                </h1>
                <p className="text-muted-foreground">Manage book loans, returns, and overdue items</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={fetchData} 
                  variant="outline" 
                  size="sm"
                  disabled={loading}
                  className="backdrop-blur-sm border-border/50 hover:bg-green-50 hover:border-green-200"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
                <Button 
                  onClick={() => setAddTransactionModalOpen(true)}
                  size="sm"
                  className={cn(
                    "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700",
                    "text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40",
                    "transition-all duration-300 transform hover:scale-[1.02]",
                    "border-0"
                  )}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Transaction
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Total</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-indigo-500/20 to-purple-500/20">
                    <History className="h-4 w-4 text-indigo-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{totalTransactions}</div>
                  <p className="text-xs text-muted-foreground">All transactions</p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Active</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-blue-500/20 to-cyan-500/20">
                    <Activity className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{activeTransactions}</div>
                  <p className="text-xs text-muted-foreground">Current loans</p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Returned</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-green-500/20 to-emerald-500/20">
                    <Book className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{returnedTransactions}</div>
                  <p className="text-xs text-muted-foreground">Completed returns</p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Overdue</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-red-500/20 to-orange-500/20">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{overdueTransactions.length}</div>
                  <p className="text-xs text-muted-foreground">Requires attention</p>
                </CardContent>
              </Card>
            </div>

            {/* Overdue Items Alert Banner */}
            {overdueTransactions.length > 0 && (
              <Card className="backdrop-blur-xl border-red-200/50 bg-gradient-to-b from-red-50/10 to-red-50/5 shadow-lg shadow-red-500/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <div>
                        <h3 className="font-semibold text-red-900">
                          {overdueTransactions.length} Overdue Item{overdueTransactions.length !== 1 ? 's' : ''}
                        </h3>
                        <p className="text-sm text-red-700">
                          {overdueTransactions.length} item{overdueTransactions.length !== 1 ? 's' : ''} past due date. Please follow up with patrons.
                        </p>
                      </div>
                    </div>
                    <Badge variant="destructive" className="text-sm backdrop-blur-sm">
                      Attention Required
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 backdrop-blur-sm bg-background/50 border-border/30">
                <TabsTrigger 
                  value="active" 
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
                >
                  <Activity className="h-4 w-4" />
                  Active
                </TabsTrigger>
                <TabsTrigger 
                  value="overdue"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-orange-500 data-[state=active]:text-white"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Overdue
                  {overdueTransactions.length > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs backdrop-blur-sm">
                      {overdueTransactions.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="history"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
                >
                  <History className="h-4 w-4" />
                  History
                </TabsTrigger>
              </TabsList>

              {/* Active Transactions Tab */}
              <TabsContent value="active" className="space-y-6">
                {/* Search Filters */}
                <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                  <CardHeader>
                    <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      Search & Filter
                    </CardTitle>
                    <CardDescription>Find active transactions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                          <User className="h-4 w-4 text-indigo-600" />
                          Search Patron
                        </Label>
                        <Input
                          placeholder="Patron name"
                          value={search.borrower}
                          onChange={e => setSearch({ ...search, borrower: e.target.value })}
                          className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                          <Book className="h-4 w-4 text-indigo-600" />
                          Search Book
                        </Label>
                        <Input
                          placeholder="Book title"
                          value={search.book}
                          onChange={e => setSearch({ ...search, book: e.target.value })}
                          className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-indigo-600" />
                          Search Due Date
                        </Label>
                        <Input
                          type="date"
                          value={search.date}
                          onChange={e => setSearch({ ...search, date: e.target.value })}
                          className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Active Transactions Table */}
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading transactions...</p>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <Card className="backdrop-blur-xl border-border/30 text-center py-8">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No active transactions found</h3>
                    <p className="text-muted-foreground">Try adjusting your search criteria or create a new transaction.</p>
                    <Button 
                      onClick={() => setAddTransactionModalOpen(true)}
                      className="mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Transaction
                    </Button>
                  </Card>
                ) : (
                  <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10 overflow-hidden">
                    <CardHeader>
                      <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        Active Transactions ({filteredTransactions.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/30 backdrop-blur-sm border-b border-border/30">
                            <tr className="text-left">
                              <th className="p-4 font-medium text-foreground/80">Patron</th>
                              <th className="p-4 font-medium text-foreground/80">Book</th>
                              <th className="p-4 font-medium text-foreground/80">Due Date</th>
                              <th className="p-4 font-medium text-foreground/80">Status</th>
                              <th className="p-4 font-medium text-foreground/80 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTransactions.map(t => {
                              const borrowerName = getBorrowerName(t);
                              const bookTitle = getBookTitle(t);
                              const bookAuthor = getBookAuthor(t);
                              const isTransactionOverdue = isOverdue(t);
                              const overdueStatus = getOverdueStatus(t);
                              const overdueSeverity = getOverdueSeverity(t);
                              
                              return (
                                <tr 
                                  key={t.id} 
                                  className={cn(
                                    "border-b border-border/30 hover:bg-muted/20 transition-colors",
                                    isTransactionOverdue && "bg-red-50/50 hover:bg-red-100/50"
                                  )}
                                >
                                  <td className="p-4 font-medium">
                                    <div className="flex items-center gap-2">
                                      {isTransactionOverdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
                                      <User className="h-4 w-4 text-indigo-600" />
                                      <div>
                                        <div className="font-medium">{borrowerName}</div>
                                        {t.patrons?.email && (
                                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Mail className="h-3 w-3" />
                                            {t.patrons.email}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex items-center gap-2">
                                      <Book className="h-4 w-4 text-indigo-600" />
                                      <div>
                                        <div className="font-medium">{bookTitle}</div>
                                        <div className="text-xs text-muted-foreground">by {bookAuthor}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-4 w-4 text-indigo-600" />
                                      <div>
                                        <div>{new Date(t.due_date).toLocaleDateString()}</div>
                                        {isTransactionOverdue && (
                                          <Badge variant={overdueSeverity} className="mt-1 text-xs backdrop-blur-sm">
                                            {overdueStatus}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex flex-col gap-1">
                                      <Badge 
                                        variant={getStatusVariant(t.status)} 
                                        className="backdrop-blur-sm w-fit"
                                      >
                                        {t.status}
                                      </Badge>
                                      {isTransactionOverdue && (
                                        <Badge variant="destructive" className="text-xs backdrop-blur-sm w-fit">
                                          Overdue
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-4 text-right">
                                    <div className="flex gap-2 justify-end">
                                      {t.status === "borrowed" && (
                                        <Button 
                                          size="sm" 
                                          variant="outline" 
                                          onClick={() => markAsActive(t.id)}
                                          className="backdrop-blur-sm border-border/50 hover:bg-blue-50 hover:border-blue-200"
                                        >
                                          Activate
                                        </Button>
                                      )}
                                      {t.status !== "returned" && (
                                        <Button 
                                          size="sm" 
                                          variant="outline" 
                                          onClick={() => markAsReturned(t.id)}
                                          className="backdrop-blur-sm border-border/50 hover:bg-green-50 hover:border-green-200"
                                        >
                                          Mark Returned
                                        </Button>
                                      )}
                                      {isTransactionOverdue && (
                                        <Button 
                                          size="sm" 
                                          variant="destructive" 
                                          onClick={() => sendOverdueReminder(t)}
                                          className="backdrop-blur-sm"
                                        >
                                          <Mail className="h-4 w-4 mr-2" />
                                          Reminder
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Overdue Items Tab */}
              <TabsContent value="overdue" className="space-y-6">
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading overdue items...</p>
                  </div>
                ) : overdueTransactions.length === 0 ? (
                  <Card className="backdrop-blur-xl border-border/30 text-center py-8">
                    <Clock className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Overdue Items</h3>
                    <p className="text-muted-foreground">
                      Great! All items have been returned on time or are not yet due.
                    </p>
                  </Card>
                ) : (
                  <>
                    {/* Overdue Summary */}
                    <Card className="backdrop-blur-xl border-red-200/50 bg-gradient-to-b from-red-50/10 to-red-50/5 shadow-lg shadow-red-500/10">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-600">
                          <AlertTriangle className="h-5 w-5" />
                          Overdue Items Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-center p-4 bg-red-50/50 rounded-lg backdrop-blur-sm border border-red-200/50">
                            <div className="text-2xl font-bold text-red-600">
                              {overdueTransactions.length}
                            </div>
                            <div className="text-sm text-muted-foreground">Total Overdue</div>
                          </div>
                          <div className="text-center p-4 bg-orange-50/50 rounded-lg backdrop-blur-sm border border-orange-200/50">
                            <div className="text-2xl font-bold text-orange-600">
                              {overdueTransactions.filter(t => getDaysOverdue(t) <= 7).length}
                            </div>
                            <div className="text-sm text-muted-foreground">1-7 Days Overdue</div>
                          </div>
                          <div className="text-center p-4 bg-red-100/50 rounded-lg backdrop-blur-sm border border-red-300/50">
                            <div className="text-2xl font-bold text-red-700">
                              {overdueTransactions.filter(t => getDaysOverdue(t) > 7).length}
                            </div>
                            <div className="text-sm text-muted-foreground">8+ Days Overdue</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Overdue Items Table */}
                    <Card className="backdrop-blur-xl border-red-200/50 bg-gradient-to-b from-red-50/10 to-red-50/5 shadow-lg shadow-red-500/10 overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-red-600">Overdue Items</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-red-50/50 backdrop-blur-sm border-b border-red-200/50">
                              <tr className="text-left">
                                <th className="p-4 font-medium text-foreground/80">Patron</th>
                                <th className="p-4 font-medium text-foreground/80">Book</th>
                                <th className="p-4 font-medium text-foreground/80">Due Date</th>
                                <th className="p-4 font-medium text-foreground/80">Days Overdue</th>
                                <th className="p-4 font-medium text-foreground/80">Status</th>
                                <th className="p-4 font-medium text-foreground/80 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {overdueTransactions
                                .sort((a, b) => getDaysOverdue(b) - getDaysOverdue(a))
                                .map(t => {
                                const bookAuthor = getBookAuthor(t);
                                return (
                                  <tr key={t.id} className="border-b border-red-100/50 bg-red-50/30 hover:bg-red-100/30 transition-colors">
                                    <td className="p-4 font-medium">
                                      <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-red-500" />
                                        <User className="h-4 w-4 text-indigo-600" />
                                        {getBorrowerName(t)}
                                      </div>
                                    </td>
                                    <td className="p-4">
                                      <div className="flex items-center gap-2">
                                        <Book className="h-4 w-4 text-indigo-600" />
                                        <div>
                                          <div className="font-medium">{getBookTitle(t)}</div>
                                          <div className="text-xs text-muted-foreground">by {bookAuthor}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-4">
                                      <div className="flex items-center gap-2 text-red-700">
                                        <Calendar className="h-4 w-4" />
                                        {new Date(t.due_date).toLocaleDateString()}
                                      </div>
                                    </td>
                                    <td className="p-4">
                                      <Badge variant={getOverdueSeverity(t)} className="backdrop-blur-sm">
                                        {getDaysOverdue(t)} day{getDaysOverdue(t) !== 1 ? 's' : ''} overdue
                                      </Badge>
                                    </td>
                                    <td className="p-4">
                                      <Badge variant={getStatusVariant(t.status)} className="backdrop-blur-sm">
                                        {t.status}
                                      </Badge>
                                    </td>
                                    <td className="p-4 text-right flex gap-2 justify-end">
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => markAsReturned(t.id)}
                                        className="backdrop-blur-sm border-border/50 hover:bg-green-50 hover:border-green-200"
                                      >
                                        Mark Returned
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="destructive" 
                                        onClick={() => sendOverdueReminder(t)}
                                        className="backdrop-blur-sm"
                                      >
                                        <Mail className="h-4 w-4 mr-2" />
                                        Send Reminder
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

              {/* Transaction History Tab */}
              <TabsContent value="history" className="space-y-6">
                {/* History Search Filters */}
                <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                  <CardHeader>
                    <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      History Search & Filter
                    </CardTitle>
                    <CardDescription>Search through transaction history</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-5">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                          <User className="h-4 w-4 text-indigo-600" />
                          Patron
                        </Label>
                        <Input
                          placeholder="Patron name"
                          value={historySearch.borrower}
                          onChange={e => setHistorySearch({ ...historySearch, borrower: e.target.value })}
                          className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                          <Book className="h-4 w-4 text-indigo-600" />
                          Book
                        </Label>
                        <Input
                          placeholder="Book title"
                          value={historySearch.book}
                          onChange={e => setHistorySearch({ ...historySearch, book: e.target.value })}
                          className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-indigo-600" />
                          From Date
                        </Label>
                        <Input
                          type="date"
                          value={historySearch.date_from}
                          onChange={e => setHistorySearch({ ...historySearch, date_from: e.target.value })}
                          className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-indigo-600" />
                          To Date
                        </Label>
                        <Input
                          type="date"
                          value={historySearch.date_to}
                          onChange={e => setHistorySearch({ ...historySearch, date_to: e.target.value })}
                          className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                          <Filter className="h-4 w-4 text-indigo-600" />
                          Status
                        </Label>
                        <Select
                          value={historySearch.status}
                          onValueChange={val => setHistorySearch({ ...historySearch, status: val })}
                        >
                          <SelectTrigger className="bg-background/50 border-border/50 h-11">
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
                  </CardContent>
                </Card>

                {/* Transaction History Table */}
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading history...</p>
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <Card className="backdrop-blur-xl border-border/30 text-center py-8">
                    <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No transaction history found</h3>
                    <p className="text-muted-foreground">Try adjusting your search criteria.</p>
                  </Card>
                ) : (
                  <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10 overflow-hidden">
                    <CardHeader>
                      <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        Transaction History ({filteredHistory.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/30 backdrop-blur-sm border-b border-border/30">
                            <tr className="text-left">
                              <th 
                                className="p-4 font-medium text-foreground/80 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort("created_at")}
                              >
                                <div className="flex items-center gap-1">
                                  Date
                                  <ArrowUpDown className="h-3 w-3" />
                                </div>
                              </th>
                              <th 
                                className="p-4 font-medium text-foreground/80 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort("name")}
                              >
                                <div className="flex items-center gap-1">
                                  Patron
                                  <ArrowUpDown className="h-3 w-3" />
                                </div>
                              </th>
                              <th 
                                className="p-4 font-medium text-foreground/80 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort("title")}
                              >
                                <div className="flex items-center gap-1">
                                  Book
                                  <ArrowUpDown className="h-3 w-3" />
                                </div>
                              </th>
                              <th className="p-4 font-medium text-foreground/80">Due Date</th>
                              <th className="p-4 font-medium text-foreground/80">Returned Date</th>
                              <th className="p-4 font-medium text-foreground/80">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredHistory.map(t => {
                              const bookAuthor = getBookAuthor(t);
                              return (
                                <tr 
                                  key={t.id} 
                                  className={cn(
                                    "border-b border-border/30 hover:bg-muted/20 transition-colors",
                                    isOverdue(t) && "bg-red-50/30 hover:bg-red-100/30"
                                  )}
                                >
                                  <td className="p-4">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Calendar className="h-4 w-4" />
                                      {new Date(t.created_at).toLocaleDateString()}
                                    </div>
                                  </td>
                                  <td className="p-4 font-medium">
                                    <div className="flex items-center gap-2">
                                      <User className="h-4 w-4 text-indigo-600" />
                                      {getBorrowerName(t)}
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex items-center gap-2">
                                      <Book className="h-4 w-4 text-indigo-600" />
                                      <div>
                                        <div className="font-medium">{getBookTitle(t)}</div>
                                        <div className="text-xs text-muted-foreground">by {bookAuthor}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    {new Date(t.due_date).toLocaleDateString()}
                                  </td>
                                  <td className="p-4">
                                    {t.returned_date ? (
                                      <div className="flex items-center gap-2 text-green-600">
                                        <Calendar className="h-4 w-4" />
                                        {new Date(t.returned_date).toLocaleDateString()}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">Not returned</span>
                                    )}
                                  </td>
                                  <td className="p-4">
                                    <div className="flex flex-col gap-1">
                                      <Badge variant={getStatusVariant(t.status)} className="backdrop-blur-sm">
                                        {t.status}
                                      </Badge>
                                      {isOverdue(t) && (
                                        <Badge variant="destructive" className="text-xs backdrop-blur-sm">
                                          Overdue ({getDaysOverdue(t)} days)
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* History Summary */}
                {!loading && filteredHistory.length > 0 && (
                  <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                    <CardHeader>
                      <CardTitle className="text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        History Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="text-center p-3 bg-blue-50/50 rounded-lg backdrop-blur-sm">
                          <div className="text-2xl font-bold text-blue-600">
                            {filteredHistory.length}
                          </div>
                          <div className="text-muted-foreground">Total Records</div>
                        </div>
                        <div className="text-center p-3 bg-green-50/50 rounded-lg backdrop-blur-sm">
                          <div className="text-2xl font-bold text-green-600">
                            {filteredHistory.filter(t => t.status === "returned").length}
                          </div>
                          <div className="text-muted-foreground">Returned</div>
                        </div>
                        <div className="text-center p-3 bg-orange-50/50 rounded-lg backdrop-blur-sm">
                          <div className="text-2xl font-bold text-orange-600">
                            {filteredHistory.filter(t => t.status === "active").length}
                          </div>
                          <div className="text-muted-foreground">Active</div>
                        </div>
                        <div className="text-center p-3 bg-red-50/50 rounded-lg backdrop-blur-sm">
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
          </div>
        </main>

        {/* Add Transaction Modal */}
        {addTransactionModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 p-6 rounded-lg w-full max-w-2xl relative shadow-2xl shadow-indigo-500/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Add New Transaction
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setAddTransactionModalOpen(false)
                    resetNewLoanForm()
                  }}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <form onSubmit={handleAddTransaction} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-3">
                  
                  {/* Patron Select */}
                  <div className="space-y-3">
                    <Label htmlFor="borrower" className="text-sm font-medium text-foreground/80">
                      Patron {borrowers.length > 0 && `(${borrowers.length} active)`}
                    </Label>

                    <Select
                      value={newLoan.patron_id}
                      onValueChange={(val) => setNewLoan({ ...newLoan, patron_id: val })}
                    >
                      <SelectTrigger className="bg-background/50 border-border/50 h-11">
                        <SelectValue
                          placeholder={
                            borrowers.length > 0
                              ? "Select active patron"
                              : "No active patrons available"
                          }
                        />
                      </SelectTrigger>

                      <SelectContent className="max-h-60 overflow-y-auto">
                        {borrowers.length > 0 ? (
                          borrowers.map((b) => (
                            <SelectItem
                              key={b.id}
                              value={b.id}
                              className="py-2 px-3 flex items-center justify-between hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors rounded-md"
                            >
                              <span className="font-medium text-sm text-foreground">
                                {b.full_name}
                              </span>
                              <Badge
                                variant="default"
                                className="text-xs bg-green-100 text-green-800 border-green-200"
                              >
                                Active
                              </Badge>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-patrons" disabled>
                            No active patrons available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>

                    {/* Selected Patron Info */}
                    {newLoan.patron_id && (() => {
                      const selected = borrowers.find((b) => b.id === newLoan.patron_id);
                      if (!selected) return null;
                      return (
                        <div className="mt-2 rounded-lg border border-border/40 p-3 bg-background/30 backdrop-blur-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{selected.full_name}</span>
                            <Badge
                              variant="default"
                              className="text-xs bg-green-100 text-green-800 border-green-200"
                            >
                              Active
                            </Badge>
                          </div>
                          {selected.email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" /> {selected.email}
                            </div>
                          )}
                          {selected.phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Phone className="h-3 w-3" /> {selected.phone}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Footer Info */}
                    {borrowers.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                        <span className="text-green-600 font-medium">
                          Active: {borrowers.length}
                        </span>
                        <span>•</span>
                        <span>Only active patrons can borrow books</span>
                      </div>
                    )}
                  </div>

                  {/* Book Select */}
                  <div className="space-y-3">
                    <Label htmlFor="book" className="text-sm font-medium text-foreground/80">
                      Book
                    </Label>

                    <Select
                      value={newLoan.book_id}
                      onValueChange={(val) => setNewLoan({ ...newLoan, book_id: val })}
                    >
                      <SelectTrigger className="bg-background/50 border-border/50 h-11">
                        <SelectValue
                          placeholder={
                            books.filter((book) => book.status === "available").length > 0
                              ? "Select available book"
                              : "No available books"
                          }
                        />
                      </SelectTrigger>

                      <SelectContent className="max-h-60 overflow-y-auto">
                        {books.filter((book) => book.status === "available").length > 0 ? (
                          books
                            .filter((book) => book.status === "available")
                            .map((b) => (
                              <SelectItem
                                key={b.id}
                                value={b.id}
                                className="py-2 px-3 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors rounded-md"
                              >
                                <span className="font-medium text-sm">{b.title}</span>
                              </SelectItem>
                            ))
                        ) : (
                          <SelectItem value="no-books" disabled>
                            No available books
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>

                    {/* Show selected book info below dropdown */}
                    {newLoan.book_id && (
                      (() => {
                        const selected = books.find((b) => b.id === newLoan.book_id);
                        if (!selected) return null;
                        return (
                          <div className="mt-2 rounded-lg border border-border/40 p-3 bg-background/30 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{selected.title}</span>
                              <Badge
                                variant="default"
                                className="text-xs bg-green-100 text-green-800 border-green-200"
                              >
                                Available
                              </Badge>
                            </div>

                            {selected.author && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Book className="h-3 w-3" /> {selected.author}
                              </div>
                            )}

                            {selected.isbn && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Hash className="h-3 w-3" /> ISBN: {selected.isbn}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}

                    {/* Footer Info */}
                    <p className="text-xs text-muted-foreground">
                      Showing {books.filter((b) => b.status === "available").length} available book
                      {books.filter((b) => b.status === "available").length !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Due Date Picker */}
                  <div className="space-y-3">
                    <Label htmlFor="due_date" className="text-sm font-medium text-foreground/80">
                      Due Date
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-indigo-600" />
                      <Input
                        type="date"
                        value={newLoan.due_date}
                        onChange={(e) =>
                          setNewLoan({ ...newLoan, due_date: e.target.value })
                        }
                        min={new Date().toISOString().split("T")[0]}
                        className="pl-11 bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={() => {
                      setAddTransactionModalOpen(false)
                      resetNewLoanForm()
                    }}
                    disabled={submitting}
                    className="backdrop-blur-sm border-border/50"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting || borrowers.length === 0}
                    className={cn(
                      "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700",
                      "text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40",
                      "transition-all duration-300 transform hover:scale-[1.02]",
                      "border-0 h-11",
                      borrowers.length === 0 && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />{" "}
                        {borrowers.length === 0 ? "No Active Patrons" : "Add Transaction"}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  )
}