"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import { Plus, Edit, Archive, User, Mail, Phone, Calendar, Search, Users, Save, X, Loader2, Trash2, RotateCcw } from "lucide-react"
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

    setSubmitting(true)
    const patronData = {
      full_name: newPatron.full_name.trim(),
      email: newPatron.email.trim(),
      phone: newPatron.phone?.trim() || null,
      status: "active",
      member_since: new Date().toISOString()
    }

    const { data, error } = await supabase.from("patrons").insert(patronData).select().single()
    
    if (error) {
      console.error("Error adding patron:", error)
      if (error.code === '23505') {
        toast.error("Email already exists")
      } else {
        toast.error("Failed to add patron")
      }
    } else {
      setPatrons(prev => [data, ...prev])
      setNewPatron({ full_name: "", email: "", phone: "" })
      toast.success("Patron added successfully")
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
    const { error } = await supabase
      .from("patrons")
      .update({ status: "archived" })
      .eq("id", patronToArchive.id)

    if (error) {
      console.error("Error archiving patron:", error)
      toast.error("Failed to archive patron")
    } else {
      setPatrons(prev => prev.map(p => 
        p.id === patronToArchive.id ? { ...p, status: "archived" } : p
      ))
      toast.success("Patron archived successfully")
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
    const { error } = await supabase
      .from("patrons")
      .update({ status: "active" })
      .eq("id", patronToRestore.id)

    if (error) {
      console.error("Error restoring patron:", error)
      toast.error("Failed to restore patron")
    } else {
      setPatrons(prev => prev.map(p => 
        p.id === patronToRestore.id ? { ...p, status: "active" } : p
      ))
      toast.success("Patron restored successfully")
    }
    setSubmitting(false)
    setRestoreConfirmOpen(false)
    setPatronToRestore(null)
  }

  // Delete patron with confirmation
  const confirmDelete = (patron: Patron) => {
    setPatronToDelete(patron)
    setDeleteConfirmOpen(true)
  }

  const handleDelete = async () => {
    if (!patronToDelete) return
    
    setSubmitting(true)
    const { error } = await supabase
      .from("patrons")
      .delete()
      .eq("id", patronToDelete.id)

    if (error) {
      console.error("Error deleting patron:", error)
      toast.error("Failed to delete patron")
    } else {
      setPatrons(prev => prev.filter(p => p.id !== patronToDelete.id))
      toast.success("Patron deleted successfully")
    }
    setSubmitting(false)
    setDeleteConfirmOpen(false)
    setPatronToDelete(null)
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

    setSubmitting(true)
    const { error, data } = await supabase
      .from("patrons")
      .update({
        full_name: editingPatron.full_name.trim(),
        email: editingPatron.email.trim(),
        phone: editingPatron.phone?.trim() || null,
      })
      .eq("id", editingPatron.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating patron:", error)
      if (error.code === '23505') {
        toast.error("Email already exists")
      } else {
        toast.error("Failed to update patron")
      }
    } else {
      setPatrons(prev => prev.map(p => (p.id === data.id ? data : p)))
      setEditingPatron(null)
      toast.success("Patron updated successfully")
    }
    setSubmitting(false)
  }

  // Filter patrons
  const filteredPatrons = patrons.filter(p => {
    const nameMatch = p.full_name.toLowerCase().includes(search.name.toLowerCase())
    const emailMatch = p.email.toLowerCase().includes(search.email.toLowerCase())
    const statusMatch = showArchived ? p.status === "archived" : p.status !== "archived"
    return nameMatch && emailMatch && statusMatch
  })

  const activePatrons = patrons.filter(p => p.status === "active").length
  const archivedPatrons = patrons.filter(p => p.status === "archived").length
  const totalPatrons = patrons.length

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
                  Patrons
                </h1>
                <p className="text-muted-foreground">Manage library members and their information</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowArchived(!showArchived)}
                className="backdrop-blur-sm border-border/50 hover:bg-indigo-50 hover:border-indigo-200"
              >
                {showArchived ? (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    View Active Patrons
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4 mr-2" />
                    View Archived Patrons
                  </>
                )}
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Total Patrons</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-indigo-500/20 to-purple-500/20">
                    <Users className="h-4 w-4 text-indigo-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{totalPatrons}</div>
                  <p className="text-xs text-muted-foreground">All library members</p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Active Patrons</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-green-500/20 to-emerald-500/20">
                    <User className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{activePatrons}</div>
                  <p className="text-xs text-muted-foreground">Currently active members</p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">Archived</CardTitle>
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-gray-500/20 to-slate-500/20">
                    <Archive className="h-4 w-4 text-gray-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{archivedPatrons}</div>
                  <p className="text-xs text-muted-foreground">Inactive members</p>
                </CardContent>
              </Card>
            </div>

            {/* Add Patron Form - Only show for active view */}
            {!showArchived && (
              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
                <CardHeader>
                  <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Add New Patron
                  </CardTitle>
                  <CardDescription>Create a new library member account</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddPatron} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-3">
                        <Label htmlFor="full_name" className="text-sm font-medium text-foreground/80">Full Name *</Label>
                        <Input
                          id="full_name"
                          value={newPatron.full_name}
                          onChange={e => setNewPatron({ ...newPatron, full_name: e.target.value })}
                          placeholder="John Doe"
                          className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                          required
                        />
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="email" className="text-sm font-medium text-foreground/80">Email *</Label>
                        <Input
                          id="email"
                          value={newPatron.email}
                          onChange={e => setNewPatron({ ...newPatron, email: e.target.value })}
                          type="email"
                          placeholder="john@example.com"
                          className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                          required
                        />
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="phone" className="text-sm font-medium text-foreground/80">Phone</Label>
                        <Input
                          id="phone"
                          value={newPatron.phone}
                          onChange={e => setNewPatron({ ...newPatron, phone: e.target.value })}
                          placeholder="Optional"
                          className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        type="submit" 
                        disabled={submitting}
                        className={cn(
                          "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700",
                          "text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40",
                          "transition-all duration-300 transform hover:scale-[1.02]",
                          "border-0 h-11"
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
              <CardHeader>
                <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {showArchived ? "Archived Patrons" : "Active Patrons"}
                </CardTitle>
                <CardDescription>
                  {showArchived 
                    ? "Manage archived library members" 
                    : "Find patrons by name or email"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-foreground/80">Search by Name</Label>
                    <Input
                      placeholder="Full name"
                      value={search.name}
                      onChange={e => setSearch({ ...search, name: e.target.value })}
                      className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-foreground/80">Search by Email</Label>
                    <Input
                      placeholder="Email"
                      value={search.email}
                      onChange={e => setSearch({ ...search, email: e.target.value })}
                      className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Patrons Table */}
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                <p className="text-muted-foreground">Loading patrons...</p>
              </div>
            ) : filteredPatrons.length === 0 ? (
              <Card className="backdrop-blur-xl border-border/30 text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {showArchived ? "No archived patrons found" : "No patrons found"}
                </h3>
                <p className="text-muted-foreground">
                  {patrons.length === 0 ? "No patrons in the system yet." : "Try adjusting your search criteria."}
                </p>
              </Card>
            ) : (
              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10 overflow-hidden">
                <CardHeader>
                  <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {showArchived ? "Archived Patrons" : "Active Patrons"} ({filteredPatrons.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 backdrop-blur-sm border-b border-border/30">
                        <tr className="text-left">
                          <th className="p-4 font-medium text-foreground/80">Full Name</th>
                          <th className="p-4 font-medium text-foreground/80">Email</th>
                          <th className="p-4 font-medium text-foreground/80">Phone</th>
                          <th className="p-4 font-medium text-foreground/80">Member Since</th>
                          <th className="p-4 font-medium text-foreground/80">Status</th>
                          <th className="p-4 font-medium text-foreground/80 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPatrons.map(p => (
                          <tr key={p.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                            <td className="p-4">
                              {editingPatron?.id === p.id ? (
                                <Input
                                  value={editingPatron.full_name}
                                  onChange={e => setEditingPatron({ ...editingPatron, full_name: e.target.value })}
                                  className="bg-background/50 border-border/50 h-9"
                                />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-indigo-600" />
                                  {p.full_name}
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              {editingPatron?.id === p.id ? (
                                <Input
                                  value={editingPatron.email}
                                  onChange={e => setEditingPatron({ ...editingPatron, email: e.target.value })}
                                  className="bg-background/50 border-border/50 h-9"
                                />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-indigo-600" />
                                  {p.email}
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              {editingPatron?.id === p.id ? (
                                <Input
                                  value={editingPatron.phone || ""}
                                  onChange={e => setEditingPatron({ ...editingPatron, phone: e.target.value })}
                                  className="bg-background/50 border-border/50 h-9"
                                />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-indigo-600" />
                                  {p.phone || "-"}
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-indigo-600" />
                                {new Date(p.member_since).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge
                                className={cn(
                                  "backdrop-blur-sm border",
                                  p.status === "active" 
                                    ? "bg-green-100 text-green-800 border-green-200" 
                                    : p.status === "inactive" 
                                    ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                                    : "bg-red-100 text-red-800 border-red-200"
                                )}
                              >
                                {p.status}
                              </Badge>
                            </td>
                            <td className="p-4 flex gap-2 justify-end">
                              {editingPatron?.id === p.id ? (
                                <>
                                  <Button 
                                    size="sm" 
                                    onClick={handleSaveEdit}
                                    disabled={submitting}
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0"
                                  >
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => setEditingPatron(null)}
                                    className="backdrop-blur-sm border-border/50"
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
                                        className="backdrop-blur-sm border-border/50 hover:bg-blue-50 hover:border-blue-200"
                                      >
                                        <Edit className="h-4 w-4 text-blue-600" />
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => confirmArchive(p)}
                                        className="backdrop-blur-sm border-border/50 hover:bg-orange-50 hover:border-orange-200 text-orange-600"
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
                                        className="backdrop-blur-sm border-border/50 hover:bg-green-50 hover:border-green-200 text-green-600"
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => confirmDelete(p)}
                                        className="backdrop-blur-sm border-border/50 hover:bg-red-50 hover:border-red-200 text-red-600"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </>
                              )}
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 p-6 rounded-lg w-96 relative shadow-2xl shadow-indigo-500/10">
              <h3 className="text-lg font-semibold mb-2 text-orange-600">Archive Patron</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to archive "<strong>{patronToArchive?.full_name}</strong>"?
                This will make them inactive but preserve their data.
              </p>
              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setArchiveConfirmOpen(false)}
                  disabled={submitting}
                  className="backdrop-blur-sm border-border/50"
                >
                  Cancel
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleArchive}
                  disabled={submitting}
                  className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200"
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 p-6 rounded-lg w-96 relative shadow-2xl shadow-indigo-500/10">
              <h3 className="text-lg font-semibold mb-2 text-green-600">Restore Patron</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to restore "<strong>{patronToRestore?.full_name}</strong>"?
                This will make them active again.
              </p>
              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setRestoreConfirmOpen(false)}
                  disabled={submitting}
                  className="backdrop-blur-sm border-border/50"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleRestore}
                  disabled={submitting}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                  Restore
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 p-6 rounded-lg w-96 relative shadow-2xl shadow-indigo-500/10">
              <h3 className="text-lg font-semibold mb-2 text-red-600">Delete Patron</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to permanently delete "<strong>{patronToDelete?.full_name}</strong>"?
                This action cannot be undone and will remove all their data.
              </p>
              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setDeleteConfirmOpen(false)}
                  disabled={submitting}
                  className="backdrop-blur-sm border-border/50"
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={submitting}
                  className="backdrop-blur-sm"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  )
}