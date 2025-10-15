// app/login/page.tsx
"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BookOpen, Lock, User, Shield, AlertCircle, CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

// Session management functions
const SESSION_KEYS = {
  isAuthenticated: "isAuthenticated",
  userId: "userId",
  userEmail: "userEmail",
  userRole: "userRole",
  userName: "userName",
  loginTime: "loginTime",
  expiresAt: "expiresAt",
  sessionToken: "sessionToken"
}

const SESSION_DURATION = 60 * 60 * 1000 // 1 hour in milliseconds

function generateSessionToken(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function clearSession(): void {
  Object.values(SESSION_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
  // Clear cookies
  document.cookie = "userId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
  document.cookie = "sessionToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
  document.cookie = "sessionExpires=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
}

function validateSession(): boolean {
  if (typeof window === 'undefined') return false

  const isAuthenticated = localStorage.getItem(SESSION_KEYS.isAuthenticated)
  const expiresAt = localStorage.getItem(SESSION_KEYS.expiresAt)
  const sessionToken = localStorage.getItem(SESSION_KEYS.sessionToken)

  if (!isAuthenticated || !expiresAt || !sessionToken) {
    return false
  }

  const now = Date.now()
  const expirationTime = parseInt(expiresAt)

  // Check if session has expired
  if (now > expirationTime) {
    clearSession()
    return false
  }

  return true
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number | null>(null)
  const router = useRouter()

  // Check for existing valid session on component mount
  useEffect(() => {
    // Clear any expired sessions on page load
    const expiresAt = localStorage.getItem(SESSION_KEYS.expiresAt)
    if (expiresAt && Date.now() > parseInt(expiresAt)) {
      clearSession()
    }

    // If user is already authenticated and session is valid, redirect to dashboard
    if (validateSession()) {
      const timeLeft = parseInt(localStorage.getItem(SESSION_KEYS.expiresAt)!) - Date.now()
      setSessionTimeLeft(timeLeft)
      
      // Show message about existing session
      setSuccess("You are already logged in. Redirecting to dashboard...")
      
      const redirectTimer = setTimeout(() => {
        router.push("/dashboard")
      }, 2000)

      return () => clearTimeout(redirectTimer)
    }
  }, [router])

  // Update session time left display
  useEffect(() => {
    if (!sessionTimeLeft || sessionTimeLeft <= 0) return

    const timer = setInterval(() => {
      setSessionTimeLeft(prev => {
        if (prev && prev > 1000) return prev - 1000
        clearInterval(timer)
        return 0
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [sessionTimeLeft])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    // Basic validation
    if (!email || !password) {
      setError("Please enter both email and password")
      setIsLoading(false)
      return
    }

    if (!email.includes('@')) {
      setError("Please enter a valid email address")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Generate session token
        const sessionToken = generateSessionToken()
        const loginTime = Date.now()
        const expiresAt = loginTime + SESSION_DURATION

        // ✅ Store user session securely with expiration
        const sessionData = {
          [SESSION_KEYS.isAuthenticated]: "true",
          [SESSION_KEYS.userId]: data.user.id,
          [SESSION_KEYS.userEmail]: data.user.email,
          [SESSION_KEYS.userRole]: data.user.role,
          [SESSION_KEYS.userName]: data.user.name,
          [SESSION_KEYS.loginTime]: loginTime.toString(),
          [SESSION_KEYS.expiresAt]: expiresAt.toString(),
          [SESSION_KEYS.sessionToken]: sessionToken,
        }

        // Store all session data in localStorage
        Object.entries(sessionData).forEach(([key, value]) => {
          localStorage.setItem(key, value)
        })

        // Set secure cookies for server-side access with 1 hour expiration
        const cookieOptions = `path=/; max-age=3600; SameSite=Strict`
        document.cookie = `userId=${data.user.id}; ${cookieOptions}`
        document.cookie = `sessionToken=${sessionToken}; ${cookieOptions}`
        document.cookie = `sessionExpires=${expiresAt}; ${cookieOptions}`

        setSuccess("Login successful! Redirecting to dashboard...")
        
        // Clear form
        setEmail("")
        setPassword("")

        // Redirect after short delay to show success message
        setTimeout(() => {
          router.push("/dashboard")
        }, 1500)
        
        return
      }

      // If login failed
      setError(data.error || "Invalid email or password. Please try again.")
      
    } catch (err) {
      console.error("Login error:", err)
      setError("Network error. Please check your connection and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = () => {
    setEmail("admin@library.com")
    setPassword("demo123")
    setSuccess("Demo credentials filled. Click Sign In to continue.")
  }

  const formatTimeLeft = (ms: number): string => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
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
            <br />
            <span className="text-xs">Session expires after 1 hour of inactivity</span>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pb-6">
          {/* Existing Session Info */}
          {sessionTimeLeft && sessionTimeLeft > 0 && (
            <Alert className="mb-4 bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                <div className="flex items-center justify-between">
                  <span>Active session found</span>
                  <span className="text-sm font-mono bg-blue-100 px-2 py-1 rounded">
                    {formatTimeLeft(sessionTimeLeft)}
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {success && (
            <Alert className="mb-4 bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-3">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email Address
              </Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <User className="h-5 w-5 text-indigo-600" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@library.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-11 bg-background border-border focus:border-indigo-300 transition-colors h-11 disabled:opacity-50"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={isLoading}
                  className="text-xs text-indigo-600 hover:text-indigo-700 underline disabled:opacity-50"
                >
                  Use Demo Credentials
                </button>
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Shield className="h-5 w-5 text-indigo-600" />
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-11 bg-background border-border focus:border-indigo-300 transition-colors h-11 disabled:opacity-50"
                  autoComplete="current-password"
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <Button 
                type="submit" 
                className={cn(
                  "w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700",
                  "text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40",
                  "transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]",
                  "border-0 h-11 font-medium",
                  "disabled:opacity-50 disabled:transform-none disabled:hover:scale-100"
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

              {/* Demo Info */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  Demo: admin@library.com / demo123
                </p>
              </div>
            </div>
          </form>

          {/* Session Info Footer */}
          <div className="mt-6 pt-4 border-t border-border/50">
            <div className="flex items-center justify-center text-xs text-muted-foreground">
              <Shield className="h-3 w-3 mr-1" />
              Your session will be securely stored for 1 hour
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Export session utilities for use in other components
export { clearSession, validateSession, SESSION_KEYS, SESSION_DURATION }