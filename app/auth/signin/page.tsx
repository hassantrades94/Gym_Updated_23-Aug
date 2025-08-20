"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Dumbbell, ArrowLeft, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function SignInPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [userType, setUserType] = useState<"member" | "owner">("member")
  const [formData, setFormData] = useState({
    phone: "",
    password: "",
  })

  const [fieldErrors, setFieldErrors] = useState({
    phone: "",
    password: "",
  })

  const validatePhone = (phone: string) => {
    if (!phone) return "Phone number is required"
    if (phone.length !== 10) return "Please enter 10 digit phone number"
    if (!/^[6-9]\d{9}$/.test(phone)) return "Please enter a valid phone number"
    return ""
  }

  const validatePassword = (password: string) => {
    if (!password) return "Password is required"
    return ""
  }

  const handleFieldBlur = (field: string, value: string) => {
    let error = ""
    switch (field) {
      case "phone":
        error = validatePhone(value)
        break
      case "password":
        error = validatePassword(value)
        break
    }
    setFieldErrors((prev) => ({ ...prev, [field]: error }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const phoneError = validatePhone(formData.phone)
    const passwordError = validatePassword(formData.password)

    setFieldErrors({
      phone: phoneError,
      password: passwordError,
    })

    if (phoneError || passwordError) {
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: formData.phone,
          password: formData.password,
          userType: userType === "owner" ? "gym_owner" : "member",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: data.error || "Sign in failed",
          description: data.message || "Please check your credentials and try again.",
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      if (data.isDefaultPassword) {
        toast({
          title: "Welcome to Flexio!",
          description: "Please consider changing your password from the default one for security.",
        })
      } else {
        toast({
          title: "Welcome back!",
          description: "You've been signed in successfully.",
        })
      }

      const normalizedUser = {
        ...data.user,
        userType: data.user.user_type === "gym_owner" ? "owner" : "member",
      }
      localStorage.setItem("flexio_user", JSON.stringify(normalizedUser))
      router.push(userType === "member" ? "/member/dashboard" : "/owner/dashboard")
      setIsLoading(false)
    } catch (error) {
      console.error("Sign in error:", error)
      toast({
        title: "Sign in failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="p-2 text-gray-400 hover:text-white hover:bg-gray-800">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
              <Dumbbell className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
              Flexio
            </span>
          </div>
        </div>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">Welcome Back</CardTitle>
            <CardDescription className="text-gray-400">Sign in to your Flexio account</CardDescription>
          </CardHeader>

          <CardContent>
            {/* User type toggle */}
            <div className="flex bg-gray-900 rounded-lg p-1 mb-6">
              <button
                type="button"
                onClick={() => setUserType("member")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  userType === "member" ? "bg-red-600 text-white shadow-sm" : "text-gray-400 hover:text-white"
                }`}
              >
                Member
              </button>
              <button
                type="button"
                onClick={() => setUserType("owner")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  userType === "owner" ? "bg-red-600 text-white shadow-sm" : "text-gray-400 hover:text-white"
                }`}
              >
                Gym Owner
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white">
                  Phone Number
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">+91</span>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 10)
                      setFormData((prev) => ({ ...prev, phone: value }))
                      if (fieldErrors.phone) {
                        setFieldErrors((prev) => ({ ...prev, phone: "" }))
                      }
                    }}
                    onBlur={(e) => handleFieldBlur("phone", e.target.value)}
                    placeholder="9876543210"
                    className={`pl-12 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus:border-red-500 ${fieldErrors.phone ? "border-red-500" : ""}`}
                    maxLength={10}
                    required
                  />
                </div>
                {fieldErrors.phone && <p className="text-sm text-red-400">{fieldErrors.phone}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, password: e.target.value }))
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: "" }))
                      }
                    }}
                    onBlur={(e) => handleFieldBlur("password", e.target.value)}
                    placeholder="Enter your password"
                    className={`bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus:border-red-500 ${fieldErrors.password ? "border-red-500" : ""}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="text-sm text-red-400">{fieldErrors.password}</p>}
              </div>

              <div className="flex items-center justify-between">
                <Link href="/auth/forgot-password" className="text-sm text-red-400 hover:text-red-300">
                  Forgot password?
                </Link>
              </div>

              {/* Sign In button */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            <Separator className="my-6 bg-gray-700" />

            <div className="text-center space-y-4">
              <p className="text-sm text-gray-400">Don't have an account?</p>
              <Link href="/auth/signup">
                <Button
                  variant="outline"
                  className="w-full bg-transparent border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                >
                  Register Your Gym
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
