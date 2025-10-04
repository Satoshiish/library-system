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
import { toast } from "sonner"

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

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      const [loansRes, borrowersRes, booksRes] = await Promise.all([
        supabase.from("loans").select(`
          id,
          status,
          due_date,
          returned_at,
          borrowers ( id, name, email ),
          books ( id, title )
        `).order("due_date", { ascending: true }),
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

    // ✅ No duplicate check; rely on book availability
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
        borrowers ( id, name, email ),
        books ( id, title )
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
    setTransactions(prev => [...prev, loanData])
    setNewLoan({ borrower_id: "", book_id: "", due_date: "" })

    // Refresh available books dropdown
    const { data: refreshedBooks } = await supabase
      .from("books")
      .select("id, title")
      .eq("status", "available")
    setBooks(refreshedBooks || [])

    toast.success("Transaction added successfully ✅")
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 lg:ml-64 p-6 space-y-8">
        <h1 className="text-3xl font-bold">Transactions</h1>

        {/* Add Transaction Form */}
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

        {/* Transactions Table */}
        {loading ? (
          <p>Loading...</p>
        ) : transactions.length === 0 ? (
          <div className="border rounded-md p-6 text-center text-muted-foreground">
            No transactions found.
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
                {transactions.map(t => (
                  <tr key={t.id} className="border-t hover:bg-muted/30">
                    <td className="p-3">{t.borrowers?.name}</td>
                    <td className="p-3">{t.books?.title}</td>
                    <td className="p-3">{new Date(t.due_date).toLocaleDateString()}</td>
                    <td className="p-3">
                      <Badge variant={
                        t.status === "returned" ? "success" :
                        t.status === "active" ? "secondary" :
                        "warning"
                      }>
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
      </main>
    </div>
  )
}
