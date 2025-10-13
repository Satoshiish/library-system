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
import { Plus, Edit, Archive, User, Mail, Phone, Calendar, Search, Users, Save, X, Loader2 } from "lucide-react"
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

  // Fetch patrons
  useEffect(() => {
    const fetchPatrons = async () => {
      const { data, error } = await supabase.from("patrons").select("*").order("member_since")
      if (error) toast.error("Failed to fetch patrons")
      else setPatrons(data || [])
      setLoading(false)
    }
    fetchPatrons()
  }, [])

  // Add new patron
  const handleAddPatron = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPatron.full_name || !newPatron.email) {
      toast.error("Please fill in name and email")
      return
    }

    setSubmitting(true)
    const { data, error } = await supabase.from("patrons").insert(newPatron).select().single()
    if (error) toast.error("Failed to add patron")
    else {
      setPatrons(prev => [...prev, data])
      setNewPatron({ full_name: "", email: "", phone: "" })
      toast.success("Patron added successfully ✅")
    }
    setSubmitting(false)
  }

  // Archive patron
  const handleArchive = async (id: string) => {
    const { error } = await supabase.from("patrons").update({ status: "archived" }).eq("id", id)
    if (error) toast.error("Failed to archive patron")
    else setPatrons(prev => prev.filter(p => p.id !== id))
  }

  // Save edited patron
  const handleSaveEdit = async () => {
    if (!editingPatron) return
    
    setSubmitting(true)
    const { error, data } = await supabase
      .from("patrons")
      .update({
        full_name: editingPatron.full_name,
        email: editingPatron.email,
        phone: editingPatron.phone,
      })
      .eq("id", editingPatron.id)
      .select()
      .single()

    if (error) toast.error("Failed to update patron")
    else {
      setPatrons(prev => prev.map(p => (p.id === data.id ? data : p)))
      setEditingPatron(null)
      toast.success("Patron updated successfully ✅")
    }
    setSubmitting(false)
  }

  // Filter patrons
  const filteredPatrons = patrons.filter(p => {
    const nameMatch = p.full_name.toLowerCase().includes(search.name.toLowerCase())
    const emailMatch = p.email.toLowerCase().includes(search.email.toLowerCase())
    return nameMatch && emailMatch
  })

  const activePatrons = patrons.filter(p => p.status === "active").length
  const totalPatrons = patrons.length

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-100/50">
        <Sidebar />

        <main className="flex-1 lg:ml-64 p-6 space-y-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Patrons
              </h1>
              <p className="text-muted-foreground">Manage library members and their information</p>
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
                  <div className="text-2xl font-bold text-foreground">{totalPatrons - activePatrons}</div>
                  <p className="text-xs text-muted-foreground">Inactive members</p>
                </CardContent>
              </Card>
            </div>

            {/* Add Patron Form */}
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
                      <Label htmlFor="full_name" className="text-sm font-medium text-foreground/80">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-indigo-600" />
                        <Input
                          id="full_name"
                          value={newPatron.full_name}
                          onChange={e => setNewPatron({ ...newPatron, full_name: e.target.value })}
                          placeholder="John Doe"
                          className="pl-11 bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="email" className="text-sm font-medium text-foreground/80">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-indigo-600" />
                        <Input
                          id="email"
                          value={newPatron.email}
                          onChange={e => setNewPatron({ ...newPatron, email: e.target.value })}
                          type="email"
                          placeholder="john@example.com"
                          className="pl-11 bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="phone" className="text-sm font-medium text-foreground/80">Phone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-indigo-600" />
                        <Input
                          id="phone"
                          value={newPatron.phone}
                          onChange={e => setNewPatron({ ...newPatron, phone: e.target.value })}
                          placeholder="Optional"
                          className="pl-11 bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                        />
                      </div>
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

            {/* Search Filters */}
            <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10">
              <CardHeader>
                <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Search & Filter
                </CardTitle>
                <CardDescription>Find patrons by name or email</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                      <Search className="h-4 w-4 text-indigo-600" />
                      Search by Name
                    </Label>
                    <Input
                      placeholder="Full name"
                      value={search.name}
                      onChange={e => setSearch({ ...search, name: e.target.value })}
                      className="bg-background/50 border-border/50 focus:border-indigo-300 transition-colors h-11"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-indigo-600" />
                      Search by Email
                    </Label>
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
                <h3 className="text-lg font-medium text-foreground mb-2">No patrons found</h3>
                <p className="text-muted-foreground">
                  {patrons.length === 0 ? "No patrons in the system yet." : "Try adjusting your search criteria."}
                </p>
              </Card>
            ) : (
              <Card className="backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90 shadow-lg shadow-indigo-500/10 overflow-hidden">
                <CardHeader>
                  <CardTitle className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Patron Directory ({filteredPatrons.length} {filteredPatrons.length === 1 ? 'patron' : 'patrons'})
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
                                <div className="relative">
                                  <User className="absolute left-3 top-3 h-4 w-4 text-indigo-600" />
                                  <Input
                                    value={editingPatron.full_name}
                                    onChange={e =>
                                      setEditingPatron({ ...editingPatron, full_name: e.target.value })
                                    }
                                    className="pl-11 bg-background/50 border-border/50 h-9"
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-indigo-600" />
                                  {p.full_name}
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              {editingPatron?.id === p.id ? (
                                <div className="relative">
                                  <Mail className="absolute left-3 top-3 h-4 w-4 text-indigo-600" />
                                  <Input
                                    value={editingPatron.email}
                                    onChange={e =>
                                      setEditingPatron({ ...editingPatron, email: e.target.value })
                                    }
                                    className="pl-11 bg-background/50 border-border/50 h-9"
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-indigo-600" />
                                  {p.email}
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              {editingPatron?.id === p.id ? (
                                <div className="relative">
                                  <Phone className="absolute left-3 top-3 h-4 w-4 text-indigo-600" />
                                  <Input
                                    value={editingPatron.phone || ""}
                                    onChange={e =>
                                      setEditingPatron({ ...editingPatron, phone: e.target.value })
                                    }
                                    className="pl-11 bg-background/50 border-border/50 h-9"
                                  />
                                </div>
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
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => setEditingPatron(p)}
                                    className="backdrop-blur-sm border-border/50 hover:bg-blue-50 hover:border-blue-200"
                                  >
                                    <Edit className="h-4 w-4 text-blue-600" />
                                  </Button>
                                  {p.status !== "archived" && (
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      onClick={() => handleArchive(p.id)}
                                      className="backdrop-blur-sm border-border/50 hover:bg-red-50 hover:border-red-200 text-red-600"
                                    >
                                      <Archive className="h-4 w-4" />
                                    </Button>
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
      </div>
    </AuthGuard>
  )
}