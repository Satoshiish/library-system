// Database schema types for the library system
// These match the schema provided in the requirements

export interface Book {
  id: string // uuid
  title: string
  author: string
  isbn: string // unique
  category: string
  status: "available" | "checked_out" | "reserved"
  description?: string
  created_at: string // timestamp
}

export interface Borrower {
  id: string // uuid
  name: string
  email: string
  phone: string
  member_since: string // timestamp
  status: "active" | "inactive"
}

export interface BorrowerRecord {
  id: string // uuid
  book_id: string // foreign key → books.id
  user_id: string // foreign key → auth.users.id or borrowers.id
  borrower_name: string
  borrowed_at: string // timestamp
  due_date: string // timestamp
  returned_at?: string // timestamp
  status: "active" | "returned" | "overdue"
}

export interface DashboardStats {
  totalBooks: number
  availableBooks: number
  checkedOutBooks: number
  reservedBooks: number
  totalBorrowers: number
  overdueBooks: number
}

export interface RecentActivity {
  id: string
  type: "checkout" | "return" | "reservation" | "new_book"
  book: string
  user: string
  date: string
}
