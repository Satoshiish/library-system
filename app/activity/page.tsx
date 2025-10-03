"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, ArrowLeft } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ActivityPage() {
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true)
      try {
        const { data: loansData } = await supabase
          .from("loans")
          .select(`
            *,
            borrower:borrower_id(name),
            book:book_id(title, author)
          `)
          .order("created_at", { ascending: false })

        const formatted = loansData?.map(loan => ({
          id: loan.id,
          title: loan.book?.title || "Unknown Book",
          author: loan.book?.author || "Unknown Author",
          borrowerName: loan.borrower?.name || "Unknown Borrower",
          status: loan.status,
          createdAt: loan.created_at,
        })) || []

        setActivities(formatted)
      } catch (err) {
        console.error("Error fetching activities:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchActivities()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">All Activity</h1>
            <p className="text-muted-foreground">View all recent book loan transactions</p>
          </div>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Activity List */}
        <Card>
          <CardHeader>
            <CardTitle>Loan History</CardTitle>
            <CardDescription>All borrower and book activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No activity found.
                </p>
              ) : (
                activities.map(activity => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Borrowed by {activity.borrowerName}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          activity.status === "active"
                            ? "default"
                            : activity.status === "overdue"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {activity.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
