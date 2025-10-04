"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import { Plus, Edit, Archive, X } from "lucide-react"

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

    const { data, error } = await supabase.from("patrons").insert(newPatron).select().single()
    if (error) toast.error("Failed to add patron")
    else {
      setPatrons(prev => [...prev, data])
      setNewPatron({ full_name: "", email: "", phone: "" })
      toast.success("Patron added successfully ✅")
    }
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
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 lg:ml-64 p-6 space-y-6">
        <h1 className="text-3xl font-bold">Patrons</h1>

        {/* Add Patron Form */}
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Add New Patron</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddPatron} className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label>Full Name</Label>
                <Input
                  value={newPatron.full_name}
                  onChange={e => setNewPatron({ ...newPatron, full_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Email</Label>
                <Input
                  value={newPatron.email}
                  onChange={e => setNewPatron({ ...newPatron, email: e.target.value })}
                  type="email"
                  placeholder="john@example.com"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Phone</Label>
                <Input
                  value={newPatron.phone}
                  onChange={e => setNewPatron({ ...newPatron, phone: e.target.value })}
                  placeholder="Optional"
                />
              </div>

              <div className="md:col-span-3 flex justify-end">
                <Button type="submit">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Patron
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Patrons Table */}
        {loading ? (
          <p>Loading...</p>
        ) : patrons.length === 0 ? (
          <div className="border rounded-md p-6 text-center text-muted-foreground">
            No patrons found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-3">Full Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Member Since</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {patrons.map(p => (
                  <tr key={p.id} className="border-t hover:bg-muted/30">
                    <td className="p-3">
                      {editingPatron?.id === p.id ? (
                        <Input
                          value={editingPatron.full_name}
                          onChange={e =>
                            setEditingPatron({ ...editingPatron, full_name: e.target.value })
                          }
                        />
                      ) : (
                        p.full_name
                      )}
                    </td>
                    <td className="p-3">
                      {editingPatron?.id === p.id ? (
                        <Input
                          value={editingPatron.email}
                          onChange={e =>
                            setEditingPatron({ ...editingPatron, email: e.target.value })
                          }
                        />
                      ) : (
                        p.email
                      )}
                    </td>
                    <td className="p-3">
                      {editingPatron?.id === p.id ? (
                        <Input
                          value={editingPatron.phone || ""}
                          onChange={e =>
                            setEditingPatron({ ...editingPatron, phone: e.target.value })
                          }
                        />
                      ) : (
                        p.phone || "-"
                      )}
                    </td>
                    <td className="p-3">{new Date(p.member_since).toLocaleDateString()}</td>
                    <td className="p-3">
                      <Badge
                        variant={
                          p.status === "active" ? "secondary" :
                          p.status === "inactive" ? "warning" :
                          "destructive"
                        }
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="p-3 flex gap-2 justify-end">
                      {editingPatron?.id === p.id ? (
                        <>
                          <Button size="sm" variant="outline" onClick={handleSaveEdit}>
                            Save
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setEditingPatron(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setEditingPatron(p)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {p.status !== "archived" && (
                            <Button size="sm" variant="destructive" onClick={() => handleArchive(p.id)}>
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
        )}
      </main>
    </div>
  )
}
