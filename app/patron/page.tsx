"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import {
  Plus,
  Edit,
  Archive,
  User,
  Mail,
  Phone,
  Calendar,
  Users,
  Save,
  X,
  Loader2,
  Trash2,
  RotateCcw,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AuthGuard } from "@/components/auth-guard"

interface Patron {
  id: string
  full_name: string
  email: string
  phone?: string
  member_since: string
  status: "active" | "inactive" | "archived"
}

export default function PatronPage() {
  const [patrons, setPatrons] = useState<Patron[]>([])
  const [newPatron, setNewPatron] = useState({ full_name: "", email: "", phone: "" })
  const [editingPatron, setEditingPatron] = useState<Patron | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState({ name: "", email: "" })
  const [submitting, setSubmitting] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [patronToDelete, setPatronToDelete] = useState<Patron | null>(null)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [patronToArchive, setPatronToArchive] = useState<Patron | null>(null)
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)
  const [patronToRestore, setPatronToRestore] = useState<Patron | null>(null)
  const [permanentDeleteConfirmOpen, setPermanentDeleteConfirmOpen] = useState(false)
  const [patronToPermanentDelete, setPatronToPermanentDelete] = useState<Patron | null>(null)

  // Fetch patrons
  useEffect(() => {
    fetchPatrons()
  }, [])

  const fetchPatrons = async () => {
    const { data, error } = await supabase.from("patrons").select("*").order("member_since", { ascending: false })
    if (error) {
      toast.error("Failed to fetch patrons")
      console.error("Error fetching patrons:", error)
    } else {
      setPatrons(data || [])
    }
    setLoading(false)
  }

  // Validate phone number (only numbers and max 11 digits for Philippine numbers)
  const validatePhoneNumber = (phone: string) => {
    if (!phone) return true // Empty is allowed

    // Remove all non-digit characters for validation
    const digitsOnly = phone.replace(/\D/g, "")

    // Check if it contains only numbers and common phone symbols
    const phoneRegex = /^[0-9+\-\s()]*$/
    if (!phoneRegex.test(phone)) {
      return false
    }

    // Check if it exceeds 11 digits (Philippine standard)
    if (digitsOnly.length > 11) {
      return false
    }

    return true
  }

  // Format phone number input with max 11 digits
  const handlePhoneInput = (value: string) => {
    // Remove any non-numeric characters except +, -, (, )
    let cleaned = value.replace(/[^\d+\-()\s]/g, "")

    // Remove all non-digit characters to check length
    const digitsOnly = cleaned.replace(/\D/g, "")

    // Limit to 11 digits for Philippine phone numbers
    if (digitsOnly.length > 11) {
      // If exceeds 11 digits, truncate to 11 digits
      cleaned = cleaned.slice(0, cleaned.length - (digitsOnly.length - 11))
    }

    return cleaned
  }

  // Get digit count for validation messages
  const getDigitCount = (phone: string) => {
    return phone.replace(/\D/g, "").length
  }

  // Add new patron
  const handleAddPatron = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPatron.full_name.trim() || !newPatron.email.trim()) {
      toast.error("Please fill in name and email")
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newPatron.email)) {
      toast.error("Please enter a valid email address")
      return
    }

    // Validate phone number
    if (newPatron.phone && !validatePhoneNumber(newPatron.phone)) {
      const digitCount = getDigitCount(newPatron.phone)
      if (digitCount > 11) {
        toast.error("Phone number cannot exceed 11 digits (Philippine standard)")
      } else {
        toast.error("Invalid phone number. Please use numbers only with optional +, -, (, )")
      }
      return
    }

    setSubmitting(true)
    const patronData = {
      full_name: newPatron.full_name.trim(),
      email: newPatron.email.trim(),
      phone: newPatron.phone?.trim() || null,
      status: "active",
      member_since: new Date().toISOString(),
    }

    const { data, error } = await supabase.from("patrons").insert(patronData).select().single()

    if (error) {
      console.error("Error adding patron:", error)
      if (error.code === "23505") {
        toast.error("Email already exists")
      } else {
        toast.error("Failed to add patron")
      }
    } else {
      setPatrons((prev) => [data, ...prev])
      setNewPatron({ full_name: "", email: "", phone: "" })
      toast.success("Patron added successfully! ✅")
    }
    setSubmitting(false)
  }

  // Archive patron with confirmation
  const confirmArchive = (patron: Patron) => {
    setPatronToArchive(patron)
    setArchiveConfirmOpen(true)
  }

  const handleArchive = async () => {
    if (!patronToArchive) return

    setSubmitting(true)
    const { error } = await supabase.from("patrons").update({ status: "archived" }).eq("id", patronToArchive.id)

    if (error) {
      console.error("Error archiving patron:", error)
      toast.error("Failed to archive patron")
    } else {
      setPatrons((prev) => prev.map((p) => (p.id === patronToArchive.id ? { ...p, status: "archived" } : p)))
      toast.success("Patron archived successfully! 📁")
    }
    setSubmitting(false)
    setArchiveConfirmOpen(false)
    setPatronToArchive(null)
  }

  // Restore patron with confirmation
  const confirmRestore = (patron: Patron) => {
    setPatronToRestore(patron)
    setRestoreConfirmOpen(true)
  }

  const handleRestore = async () => {
    if (!patronToRestore) return

    setSubmitting(true)
    const { error } = await supabase.from("patrons").update({ status: "active" }).eq("id", patronToRestore.id)

    if (error) {
      console.error("Error restoring patron:", error)
      toast.error("Failed to restore patron")
    } else {
      setPatrons((prev) => prev.map((p) => (p.id === patronToRestore.id ? { ...p, status: "active" } : p)))
      toast.success("Patron restored successfully! 🔄")
    }
    setSubmitting(false)
    setRestoreConfirmOpen(false)
    setPatronToRestore(null)
  }

  // Delete patron with confirmation (soft delete - archive)
  const confirmDelete = (patron: Patron) => {
    setPatronToDelete(patron)
    setDeleteConfirmOpen(true)
  }

  const handleDelete = async () => {
    if (!patronToDelete) return

    setSubmitting(true)
    const { error } = await supabase.from("patrons").update({ status: "archived" }).eq("id", patronToDelete.id)

    if (error) {
      console.error("Error archiving patron:", error)
      toast.error("Failed to archive patron")
    } else {
      setPatrons((prev) => prev.map((p) => (p.id === patronToDelete.id ? { ...p, status: "archived" } : p)))
      toast.success("Patron archived successfully! 📁")
    }
    setSubmitting(false)
    setDeleteConfirmOpen(false)
    setPatronToDelete(null)
  }

  // Permanent delete patron with confirmation
  const confirmPermanentDelete = (patron: Patron) => {
    setPatronToPermanentDelete(patron)
    setPermanentDeleteConfirmOpen(true)
  }

  const handlePermanentDelete = async () => {
    if (!patronToPermanentDelete) return

    setSubmitting(true)
    const { error } = await supabase.from("patrons").delete().eq("id", patronToPermanentDelete.id)

    if (error) {
      console.error("Error permanently deleting patron:", error)
      toast.error("Failed to permanently delete patron")
    } else {
      setPatrons((prev) => prev.filter((p) => p.id !== patronToPermanentDelete.id))
      toast.success("Patron permanently deleted successfully! 🗑️")
    }
    setSubmitting(false)
    setPermanentDeleteConfirmOpen(false)
    setPatronToPermanentDelete(null)
  }

  // Save edited patron
  const handleSaveEdit = async () => {
    if (!editingPatron) return

    if (!editingPatron.full_name.trim() || !editingPatron.email.trim()) {
      toast.error("Please fill in name and email")
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(editingPatron.email)) {
      toast.error("Please enter a valid email address")
      return
    }

    // Validate phone number
    if (editingPatron.phone && !validatePhoneNumber(editingPatron.phone)) {
      const digitCount = getDigitCount(editingPatron.phone)
      if (digitCount > 11) {
        toast.error("Phone number cannot exceed 11 digits (Philippine standard)")
      } else {
        toast.error("Invalid phone number. Please use numbers only with optional +, -, (, )")
      }
      return
    }

    setSubmitting(true)
    const { error, data } = await supabase
      .from("patrons")
      .update({
        full_name: editingPatron.full_name.trim(),
        email: editingPatron.email.trim(),
        phone: editingPatron.phone?.trim() || null,
        status: editingPatron.status,
      })
      .eq("id", editingPatron.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating patron:", error)
      if (error.code === "23505") {
        toast.error("Email already exists")
      } else {
        toast.error("Failed to update patron")
      }
    } else {
      setPatrons((prev) => prev.map((p) => (p.id === data.id ? data : p)))
      setEditingPatron(null)
      toast.success("Patron updated successfully! ✨")
    }
    setSubmitting(false)
  }

  // Filter patrons
  const filteredPatrons = patrons.filter((p) => {
    const nameMatch = p.full_name.toLowerCase().includes(search.name.toLowerCase())
    const emailMatch = p.email.toLowerCase().includes(search.email.toLowerCase())
    const statusMatch = showArchived ? p.status === "archived" : p.status !== "archived"
    return nameMatch && emailMatch && statusMatch
  })

  const activePatrons = patrons.filter((p) => p.status === "active").length
  const archivedPatrons = patrons.filter((p) => p.status === "archived").length
  const totalPatrons = patrons.length

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-100/50">
        <Sidebar />

        <main className="flex-1 lg:ml-64 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 md:space-y-6">
          <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5 md:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent break-words">
                  Patrons
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base mt-1">
                  Manage library members and their information
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowArchived(!showArchived)}
                className="backdrop-blur-sm border-border/50 hover:bg-indigo-50 hover:border-indigo-200 w-full sm:w-auto"
              >
                {showArchived ? (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    <span className="text-sm">View Active</span>
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4 mr-2" />
                    <span className="text-sm">View Archived</span>
                  </>
                )}
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
                  <CardTitle className="text-sm font-medium text-foreground/80">Total Patrons</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-indigo-500/20 to-purple-500/20">
                    <Users className="h-4 w-4 text-indigo-600" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">{totalPatrons}</div>
                  <p className="text-xs sm:text-sm text-muted-foreground">All library members</p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
                  <CardTitle className="text-sm font-medium text-foreground/80">Active Patrons</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-green-500/20 to-emerald-500/20">
                    <User className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">{activePatrons}</div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Currently active members</p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
                  <CardTitle className="text-sm font-medium text-foreground/80">Archived</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-gray-500/20 to-slate-500/20">
                    <Archive className="h-4 w-4 text-gray-600" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">{archivedPatrons}</div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Inactive members</p>
                </CardContent>
              </Card>
            </div>

            {/* Add Patron Form - Only show for active view */}
            {!showArchived && (
              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
                  <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent text-lg sm:text-xl">
                    Add New Patron
                  </CardTitle>
                  <CardDescription className="text-sm">Create a new library member account</CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                  <form onSubmit={handleAddPatron} className="space-y-4 sm:space-y-6">
                    <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="full_name" className="text-sm font-medium text-foreground/80">
                          Full Name *
                        </Label>
                        <Input
                          id="full_name"
                          value={newPatron.full_name}
                          onChange={(e) => setNewPatron({ ...newPatron, full_name: e.target.value })}
                          placeholder="John Doe"
                          className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-10 text-sm"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
                          Email *
                        </Label>
                        <Input
                          id="email"
                          value={newPatron.email}
                          onChange={(e) => setNewPatron({ ...newPatron, email: e.target.value })}
                          type="email"
                          placeholder="john@example.com"
                          className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-10 text-sm"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-sm font-medium text-foreground/80">
                          Phone
                          {newPatron.phone && (
                            <span
                              className={cn(
                                "ml-2 text-xs",
                                getDigitCount(newPatron.phone) > 11
                                  ? "text-red-600 font-medium"
                                  : "text-muted-foreground",
                              )}
                            >
                              ({getDigitCount(newPatron.phone)}/11 digits)
                            </span>
                          )}
                        </Label>
                        <Input
                          id="phone"
                          value={newPatron.phone}
                          onChange={(e) => setNewPatron({ ...newPatron, phone: handlePhoneInput(e.target.value) })}
                          placeholder="09XXXXXXXXX"
                          className={cn(
                            "bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-10 text-sm",
                            newPatron.phone &&
                              getDigitCount(newPatron.phone) > 11 &&
                              "border-red-300 focus:border-red-300",
                          )}
                          maxLength={15}
                        />
                        <p className="text-xs text-muted-foreground">
                          Philippine format (max 11 digits) - e.g., 09171234567
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={submitting || (newPatron.phone && getDigitCount(newPatron.phone) > 11)}
                        className={cn(
                          "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700",
                          "text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40",
                          "transition-all duration-300 transform hover:scale-[1.02]",
                          "border-0 h-10 text-sm w-full sm:w-auto",
                          newPatron.phone && getDigitCount(newPatron.phone) > 11 && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Patron
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Search Filters */}
            <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
              <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
                <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent text-lg sm:text-xl">
                  {showArchived ? "Archived Patrons" : "Active Patrons"}
                </CardTitle>
                <CardDescription className="text-sm">
                  {showArchived
                    ? "Manage archived library members - restore or permanently delete accounts"
                    : "Find patrons by name or email"}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground/80">Search by Name</Label>
                    <Input
                      placeholder="Full name"
                      value={search.name}
                      onChange={(e) => setSearch({ ...search, name: e.target.value })}
                      className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground/80">Search by Email</Label>
                    <Input
                      placeholder="Email"
                      value={search.email}
                      onChange={(e) => setSearch({ ...search, email: e.target.value })}
                      className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-10 text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Patrons Table */}
            {loading ? (
              <div className="text-center py-8 sm:py-12">
                <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-indigo-600 mx-auto mb-4" />
                <p className="text-muted-foreground text-sm sm:text-base">Loading patrons...</p>
              </div>
            ) : filteredPatrons.length === 0 ? (
              <Card className="backdrop-blur-xl border-border/30 text-center py-8 sm:py-12">
                <Users className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg sm:text-xl font-medium text-foreground mb-2">
                  {showArchived ? "No archived patrons found" : "No patrons found"}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {patrons.length === 0 ? "No patrons in the system yet." : "Try adjusting your search criteria."}
                </p>
              </Card>
            ) : (
              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10 overflow-hidden">
                <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
                  <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent text-lg sm:text-xl">
                    {showArchived ? "Archived Patrons" : "Active Patrons"} ({filteredPatrons.length})
                  </CardTitle>
                  {showArchived && (
                    <CardDescription className="text-orange-600 flex items-center gap-2 text-xs sm:text-sm">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      Warning: Permanent deletion cannot be undone and will remove all patron data permanently.
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 backdrop-blur-sm border-b border-border/30">
                        <tr className="text-left">
                          <th className="p-4 font-medium text-foreground/80 whitespace-nowrap">Full Name</th>
                          <th className="p-4 font-medium text-foreground/80 whitespace-nowrap">Email</th>
                          <th className="p-4 font-medium text-foreground/80 whitespace-nowrap">Phone</th>
                          <th className="p-4 font-medium text-foreground/80 whitespace-nowrap">Member Since</th>
                          <th className="p-4 font-medium text-foreground/80 whitespace-nowrap">Status</th>
                          <th className="p-4 font-medium text-foreground/80 text-right whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPatrons.map((p) => (
                          <tr key={p.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                            <td className="p-4">
                              {editingPatron?.id === p.id ? (
                                <Input
                                  value={editingPatron.full_name}
                                  onChange={(e) => setEditingPatron({ ...editingPatron, full_name: e.target.value })}
                                  className="bg-background/50 border-border/50 h-9 text-sm"
                                />
                              ) : (
                                <div className="flex items-center gap-2 min-w-[120px]">
                                  <User className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                                  <span className="truncate">{p.full_name}</span>
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              {editingPatron?.id === p.id ? (
                                <Input
                                  value={editingPatron.email}
                                  onChange={(e) => setEditingPatron({ ...editingPatron, email: e.target.value })}
                                  className="bg-background/50 border-border/50 h-9 text-sm"
                                />
                              ) : (
                                <div className="flex items-center gap-2 min-w-[150px]">
                                  <Mail className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                                  <span className="truncate">{p.email}</span>
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              {editingPatron?.id === p.id ? (
                                <div className="space-y-1">
                                  <Input
                                    value={editingPatron.phone || ""}
                                    onChange={(e) =>
                                      setEditingPatron({ ...editingPatron, phone: handlePhoneInput(e.target.value) })
                                    }
                                    placeholder="09XXXXXXXXX"
                                    className={cn(
                                      "bg-background/50 border-border/50 h-9 text-sm",
                                      editingPatron.phone &&
                                        getDigitCount(editingPatron.phone) > 11 &&
                                        "border-red-300",
                                    )}
                                    maxLength={15}
                                  />
                                  {editingPatron.phone && (
                                    <div
                                      className={cn(
                                        "text-xs",
                                        getDigitCount(editingPatron.phone) > 11
                                          ? "text-red-600 font-medium"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      {getDigitCount(editingPatron.phone)}/11 digits
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                                  <span className="truncate">{p.phone || "-"}</span>
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2 whitespace-nowrap">
                                <Calendar className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                                {new Date(p.member_since).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="p-4">
                              {editingPatron?.id === p.id ? (
                                <Select
                                  value={editingPatron.status}
                                  onValueChange={(value: "active" | "inactive") =>
                                    setEditingPatron({ ...editingPatron, status: value })
                                  }
                                >
                                  <SelectTrigger className="bg-background/50 border-border/50 h-9 w-32 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge
                                  className={cn(
                                    "backdrop-blur-sm border text-xs",
                                    p.status === "active"
                                      ? "bg-green-100 text-green-800 border-green-200"
                                      : p.status === "inactive"
                                        ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                                        : "bg-red-100 text-red-800 border-red-200",
                                  )}
                                >
                                  {p.status}
                                </Badge>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex gap-2 justify-end flex-wrap">
                                {editingPatron?.id === p.id ? (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={handleSaveEdit}
                                      disabled={
                                        submitting || (editingPatron.phone && getDigitCount(editingPatron.phone) > 11)
                                      }
                                      className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0 h-8 px-2 text-xs"
                                    >
                                      {submitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Save className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setEditingPatron(null)}
                                      className="backdrop-blur-sm border-border/50 h-8 px-2 text-xs"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    {!showArchived && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setEditingPatron(p)}
                                          className="backdrop-blur-sm border-border/50 hover:bg-blue-50 hover:border-blue-200 h-8 px-2 text-xs"
                                        >
                                          <Edit className="h-4 w-4 text-blue-600" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => confirmArchive(p)}
                                          className="backdrop-blur-sm border-border/50 hover:bg-orange-50 hover:border-orange-200 text-orange-600 h-8 px-2 text-xs"
                                        >
                                          <Archive className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                    {showArchived && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => confirmRestore(p)}
                                          className="backdrop-blur-sm border-border/50 hover:bg-green-50 hover:border-green-200 text-green-600 h-8 px-2 text-xs"
                                          title="Restore to active status"
                                        >
                                          <RotateCcw className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => confirmPermanentDelete(p)}
                                          className="backdrop-blur-sm border-border/50 hover:bg-red-50 hover:border-red-200 text-red-600 h-8 px-2 text-xs"
                                          title="Permanently delete patron"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>

        {/* Archive Confirmation Modal */}
        {archiveConfirmOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 p-6 rounded-lg w-full max-w-96 relative shadow-2xl shadow-indigo-500/10">
              <h3 className="text-lg font-semibold mb-2 text-orange-600">Archive Patron</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to archive "<strong>{patronToArchive?.full_name}</strong>"? This will make them
                inactive but preserve their data.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setArchiveConfirmOpen(false)}
                  disabled={submitting}
                  className="backdrop-blur-sm border-border/50 text-sm h-9"
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={handleArchive}
                  disabled={submitting}
                  className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200 text-sm h-9"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4 mr-2" />}
                  Archive
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Restore Confirmation Modal */}
        {restoreConfirmOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 p-6 rounded-lg w-full max-w-96 relative shadow-2xl shadow-indigo-500/10">
              <h3 className="text-lg font-semibold mb-2 text-green-600">Restore Patron</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to restore "<strong>{patronToRestore?.full_name}</strong>"? This will make them
                active again.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setRestoreConfirmOpen(false)}
                  disabled={submitting}
                  className="backdrop-blur-sm border-border/50 text-sm h-9"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRestore}
                  disabled={submitting}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm h-9"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                  Restore
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Permanent Delete Confirmation Modal */}
        {permanentDeleteConfirmOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 p-6 rounded-lg w-full max-w-96 relative shadow-2xl shadow-indigo-500/10">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                <h3 className="text-lg font-semibold text-red-600">Permanently Delete Patron</h3>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 font-medium mb-2">⚠️ This action cannot be undone!</p>
                <p className="text-sm text-red-700">
                  You are about to permanently delete "<strong>{patronToPermanentDelete?.full_name}</strong>". This will
                  remove all their data from the system including any associated records.
                </p>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Are you absolutely sure you want to proceed with permanent deletion?
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setPermanentDeleteConfirmOpen(false)}
                  disabled={submitting}
                  className="backdrop-blur-sm border-border/50 text-sm h-9"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handlePermanentDelete}
                  disabled={submitting}
                  className="backdrop-blur-sm text-sm h-9"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Permanently
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
