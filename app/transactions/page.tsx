"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLoans = async () => {
      const { data, error } = await supabase
        .from("loans")
        .select(`
          id,
          status,
          due_date,
          returned_at,
          borrowers (
            name,
            email
          ),
          books (
            title
          )
        `)
        .order("due_date", { ascending: true })

      if (error) {
        console.error("❌ Failed to fetch loans:", error)
      } else {
        setTransactions(data)
      }

      setLoading(false)
    }

    fetchLoans()
  }, [])

  const markAsReturned = async (id: string) => {
    const { error } = await supabase
      .from("loans")
      .update({ status: "returned", returned_at: new Date().toISOString() })
      .eq("id", id)

    if (error) {
      console.error("❌ Failed to mark as returned:", error)
      return
    }

    setTransactions(prev =>
      prev.map(t => t.id === id ? { ...t, status: "returned", returned_at: new Date().toISOString() } : t)
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 lg:ml-64 p-6">
        <h1 className="text-3xl font-bold mb-6">Transactions</h1>

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
                      <Badge variant={t.status === "returned" ? "success" : "warning"}>
                        {t.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
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
