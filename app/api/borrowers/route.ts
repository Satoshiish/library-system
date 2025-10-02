import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all"

    const cookieStore = cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    })

    if (type === "loans") {
      // Get active loans with book and borrower details
      const { data: loans, error } = await supabase
        .from("loans")
        .select(`
          *,
          books (title, author, isbn),
          borrowers (name, email, phone)
        `)
        .eq("status", "active")
        .order("due_date", { ascending: true })

      if (error) {
        console.error("Database error:", error)
        return NextResponse.json({ data: getMockLoans() })
      }

      return NextResponse.json({ data: loans || [] })
    }

    if (type === "overdue") {
      // Get overdue loans
      const today = new Date().toISOString().split("T")[0]
      const { data: overdueLoans, error } = await supabase
        .from("loans")
        .select(`
          *,
          books (title, author, isbn),
          borrowers (name, email, phone)
        `)
        .eq("status", "active")
        .lt("due_date", today)
        .order("due_date", { ascending: true })

      if (error) {
        console.error("Database error:", error)
        return NextResponse.json({ data: getMockOverdueLoans() })
      }

      return NextResponse.json({ data: overdueLoans || [] })
    }

    // Get all borrowers
    const { data: borrowers, error } = await supabase
      .from("borrowers")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ data: getMockBorrowers() })
    }

    return NextResponse.json({ data: borrowers || [] })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ data: [] })
  }
}

function getMockLoans() {
  return [
    {
      id: 1,
      loan_date: "2024-01-15",
      due_date: "2024-02-15",
      status: "active",
      books: { title: "The Great Gatsby", author: "F. Scott Fitzgerald", isbn: "978-0-7432-7356-5" },
      borrowers: { name: "John Smith", email: "john@example.com", phone: "+1-555-0123" },
    },
    {
      id: 2,
      loan_date: "2024-01-20",
      due_date: "2024-02-20",
      status: "active",
      books: { title: "To Kill a Mockingbird", author: "Harper Lee", isbn: "978-0-06-112008-4" },
      borrowers: { name: "Jane Doe", email: "jane@example.com", phone: "+1-555-0456" },
    },
  ]
}

function getMockOverdueLoans() {
  return [
    {
      id: 3,
      loan_date: "2023-12-01",
      due_date: "2024-01-01",
      status: "active",
      books: { title: "1984", author: "George Orwell", isbn: "978-0-452-28423-4" },
      borrowers: { name: "Bob Wilson", email: "bob@example.com", phone: "+1-555-0789" },
    },
  ]
}

function getMockBorrowers() {
  return [
    {
      id: 1,
      name: "John Smith",
      email: "john@example.com",
      phone: "+1-555-0123",
      address: "123 Main St, City, State 12345",
      membership_type: "student",
      status: "active",
      created_at: "2024-01-10T10:00:00Z",
    },
    {
      id: 2,
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+1-555-0456",
      address: "456 Oak Ave, City, State 12345",
      membership_type: "faculty",
      status: "active",
      created_at: "2024-01-12T10:00:00Z",
    },
  ]
}
