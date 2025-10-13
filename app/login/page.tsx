// app/login/page.tsx
"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BookOpen, Lock, User, Shield } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

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
        // ✅ Store user session securely
        localStorage.setItem("isAuthenticated", "true")
        localStorage.setItem("userId", data.user.id)
        localStorage.setItem("userEmail", data.user.email)
        localStorage.setItem("userRole", data.user.role)
        localStorage.setItem("userName", data.user.name)
        
        // Also set a session cookie for server-side access
        document.cookie = `userId=${data.user.id}; path=/; max-age=86400` // 24 hours
        
        router.push("/dashboard")
        return
      }

      // If login failed
      setError(data.error || "Invalid email or password")
    } catch (err) {
      console.error("Login error:", err)
      setError("Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-100/50 flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-indigo-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl"></div>
      </div>

      <Card className={cn(
        "w-full max-w-md backdrop-blur-xl border-border/30 bg-gradient-to-b from-background/95 to-background/90",
        "shadow-2xl shadow-indigo-500/10 border-0 relative overflow-hidden"
      )}>
        {/* Card accent gradient */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
        
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-3 rounded-2xl shadow-lg">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Library Management
          </CardTitle>
          <CardDescription className="text-muted-foreground mt-2">
            Sign in to access the inventory system
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pb-6">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-3">
              <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
                Email
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-indigo-500" strokeWidth={2} />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@library.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 backdrop-blur-sm bg-background/50 border-border/50 focus:border-indigo-300 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
                Password
              </Label>
              <div className="relative">
                <Shield className="absolute left-3 top-3 h-4 w-4 text-indigo-500" strokeWidth={2} />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 backdrop-blur-sm bg-background/50 border-border/50 focus:border-indigo-300 transition-colors"
                />
              </div>
            </div>
            
            {error && (
              <Alert variant="destructive" className="backdrop-blur-sm border-border/50">
                <AlertDescription className="flex items-center">
                  <Lock className="h-4 w-4 mr-2" />
                  {error}
                </AlertDescription>
              </Alert>
            )}
            
            <Button 
              type="submit" 
              className={cn(
                "w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700",
                "text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40",
                "transition-all duration-300 transform hover:scale-[1.02]",
                "border-0 backdrop-blur-sm"
              )} 
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Signing in...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <Lock className="mr-2 h-4 w-4" />
                  Sign In
                </div>
              )}
            </Button>
          </form>
          
          <div className="mt-6 p-4 rounded-lg bg-muted/30 backdrop-blur-sm border border-border/30">
            <div className="text-center text-sm text-muted-foreground">
              <p className="font-medium mb-1">Demo Credentials</p>
              <p>admin@library.com / admin123</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}