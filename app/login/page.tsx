// app/login/page.tsx
"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BookOpen, Lock } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        localStorage.setItem("isAuthenticated", "true")
        localStorage.setItem("userId", data.user.id)
        localStorage.setItem("userEmail", data.user.email)
        localStorage.setItem("userRole", data.user.role)
        localStorage.setItem("userName", data.user.name)

        document.cookie = `userId=${data.user.id}; path=/; max-age=86400`

        router.push("/dashboard")
        return
      }

      setError(data.error || "Invalid email or password")
    } catch (err) {
      console.error("Login error:", err)
      setError("Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-slate-900">
      {/* Subtle glassmorphic overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <Card className="relative z-10 w-full max-w-md bg-white/10 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-5">
            <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-3 rounded-xl shadow-md">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">Library Management</CardTitle>
          <CardDescription className="text-slate-200">
            Sign in to access your inventory dashboard
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-100">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@library.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-100">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            {error && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 text-red-200">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90 transition-all"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Lock className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-300">
            Demo credentials: <span className="font-medium">admin@library.com / admin123</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
