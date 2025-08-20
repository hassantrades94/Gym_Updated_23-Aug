"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Dumbbell, ArrowLeft, Eye, EyeOff, MapPin, Navigation } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function SignUpPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [gymLocation, setGymLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationSkipped, setLocationSkipped] = useState(false)
  const [isCheckingGymCode, setIsCheckingGymCode] = useState(false)
  const [gymCodeExists, setGymCodeExists] = useState(false)

  const [formData, setFormData] = useState({
    phone: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    gymName: "",
    gymCode: "",
  })

  const [fieldErrors, setFieldErrors] = useState({
    fullName: "",
    phone: "",
    gymCode: "",
    password: "",
    confirmPassword: "",
    gymName: "",
  })

  // Redirect any member attempts to owner
  useEffect(() => {
    const type = searchParams.get("type")
    if (type === "member") {
      router.replace("/auth/signup?type=owner")
    }
  }, [searchParams, router])

  const validateFullName = (name: string) => (!name.trim() ? "Full name is required" : "")
  const validatePhone = (phone: string) => {
    if (!phone) return "Phone number is required"
    if (phone.length !== 10) return "Please enter 10 digit phone number"
    if (!/^[6-9]\d{9}$/.test(phone)) return "Please enter a valid phone number"
    return ""
  }
  const validateGymCode = (code: string) => {
    if (!code) return "Gym code is required"
    if (code.length !== 6) return "Gym code must be 6 characters"
    return ""
  }
  const validatePassword = (password: string) => {
    if (!password) return "Password is required"
    if (password.length < 8) return "Password must be at least 8 characters"
    return ""
  }
  const validateConfirmPassword = (confirmPassword: string, password: string) => {
    if (!confirmPassword) return "Please confirm your password"
    if (confirmPassword !== password) return "Passwords do not match"
    return ""
  }
  const validateGymName = (name: string) => (!name.trim() ? "Gym name is required" : "")

  const handleFieldBlur = (field: string, value: string) => {
    let error = ""
    switch (field) {
      case "fullName":
        error = validateFullName(value)
        break
      case "phone":
        error = validatePhone(value)
        break
      case "gymCode":
        error = validateGymCode(value)
        break
      case "password":
        error = validatePassword(value)
        break
      case "confirmPassword":
        error = validateConfirmPassword(value, formData.password)
        break
      case "gymName":
        error = validateGymName(value)
        break
    }
    setFieldErrors((prev) => ({ ...prev, [field]: error }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const errors = {
      fullName: validateFullName(formData.fullName),
      phone: validatePhone(formData.phone),
      gymCode: validateGymCode(formData.gymCode),
      password: validatePassword(formData.password),
      confirmPassword: validateConfirmPassword(formData.confirmPassword, formData.password),
      gymName: validateGymName(formData.gymName),
    }
    setFieldErrors(errors)

    const hasErrors = Object.values(errors).some((err) => err !== "")
    if (hasErrors) {
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: formData.phone,
          password: formData.password,
          fullName: formData.fullName,
          gymName: formData.gymName,
          gymCode: formData.gymCode,
          userType: "gym_owner",
          gymLocation: gymLocation || null,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Registration failed")

      toast({
        title: "Registration successful!",
        description: "Your gym account has been created. Welcome to Flexio!",
      })
      router.push("/owner/dashboard")
    } catch (error) {
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const checkGymCodeAvailability = async (code: string) => {
    setIsCheckingGymCode(true)
    setGymCodeExists(false)
    try {
      const res = await fetch(`/api/auth/check-gym-code?code=${code}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to check gym code")
      const exists = !!json?.data
      if (exists) {
        setGymCodeExists(true)
        toast({
          title: "Gym code already exists",
          description: "This code is already taken. Please generate a new one.",
          variant: "destructive",
        })
      } else {
        setFormData((prev) => ({ ...prev, gymCode: code }))
        setGymCodeExists(false)
        toast({ title: "Gym code generated!", description: `Your unique gym code is: ${code}` })
      }
    } catch {
      // Allow fallback to avoid blocking registration if API fails
      setFormData((prev) => ({ ...prev, gymCode: code }))
      setGymCodeExists(false)
      toast({ title: "Gym code generated!", description: `Your unique gym code is: ${code}` })
    } finally {
      setIsCheckingGymCode(false)
    }
  }

  const generateGymCode = async () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let code = ""
    for (let i = 0; i < 3; i++) code += chars.charAt(Math.floor(Math.random() * 26)) // letters
    for (let i = 0; i < 3; i++) code += chars.charAt(Math.floor(Math.random() * chars.length)) // mixed
    await checkGymCodeAvailability(code)
  }

  const captureGymLocation = () => {
    setIsGettingLocation(true)
    if (!navigator.geolocation) {
      setIsGettingLocation(false)
      toast({
        title: "Geolocation not supported",
        description: "You can skip this step and add location later.",
        variant: "destructive",
      })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGymLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setIsGettingLocation(false)
        toast({ title: "Location captured!", description: "Your gym location has been saved successfully." })
      },
      () => {
        setIsGettingLocation(false)
        toast({
          title: "Location access denied",
          description: "You can skip this step and add location later from your dashboard.",
          variant: "destructive",
        })
      },
    )
  }

  const skipLocation = () => {
    setLocationSkipped(true)
    toast({ title: "Location skipped", description: "You can add your gym location later from the dashboard." })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white px-4 py-6">
      <div className="max-w-md mx-auto">
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
            <CardTitle className="text-2xl text-white">Register Your Gym</CardTitle>
            <CardDescription className="text-gray-400">Manage your gym and engage your members</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-white">Full Name *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => {
                    setFormData((p) => ({ ...p, fullName: e.target.value }))
                    if (fieldErrors.fullName) setFieldErrors((p) => ({ ...p, fullName: "" }))
                  }}
                  onBlur={(e) => handleFieldBlur("fullName", e.target.value)}
                  placeholder="Enter your full name"
                  className={`bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus:border-red-500 ${fieldErrors.fullName ? "border-red-500" : ""}`}
                  required
                />
                {fieldErrors.fullName && <p className="text-sm text-red-400">{fieldErrors.fullName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white">Phone Number *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">+91</span>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "")
                      setFormData((p) => ({ ...p, phone: value }))
                      if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: "" }))
                    }}
                    onBlur={(e) => handleFieldBlur("phone", e.target.value)}
                    placeholder="9876543210"
                    className={`pl-12 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus:border-red-500 ${fieldErrors.phone ? "border-red-500" : ""}`}
                    maxLength={10}
                    required
                  />
                </div>
                {fieldErrors.phone && <p className="text-sm text-red-400">{fieldErrors.phone}</p>}
                <p className="text-xs text-gray-400">Enter your 10-digit mobile number</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gymName" className="text-white">Gym Name *</Label>
                <Input
                  id="gymName"
                  value={formData.gymName}
                  onChange={(e) => {
                    setFormData((p) => ({ ...p, gymName: e.target.value }))
                    if (fieldErrors.gymName) setFieldErrors((p) => ({ ...p, gymName: "" }))
                  }}
                  onBlur={(e) => handleFieldBlur("gymName", e.target.value)}
                  placeholder="Enter your gym's name"
                  className={`bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus:border-red-500 ${fieldErrors.gymName ? "border-red-500" : ""}`}
                  required
                />
                {fieldErrors.gymName && <p className="text-sm text-red-400">{fieldErrors.gymName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="gymCode" className="text-white">Your Gym Code *</Label>
                <div className="flex gap-2">
                  <Input
                    id="gymCode"
                    value={formData.gymCode}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase()
                      setFormData((p) => ({ ...p, gymCode: value }))
                      if (fieldErrors.gymCode) setFieldErrors((p) => ({ ...p, gymCode: "" }))
                    }}
                    onBlur={(e) => handleFieldBlur("gymCode", e.target.value)}
                    placeholder="Enter or generate gym code"
                    className={`bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus:border-red-500 uppercase ${fieldErrors.gymCode ? "border-red-500" : ""}`}
                    maxLength={6}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateGymCode}
                    disabled={isCheckingGymCode}
                    className="whitespace-nowrap bg-transparent border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                  >
                    {isCheckingGymCode ? "Checking..." : "Generate"}
                  </Button>
                </div>
                {fieldErrors.gymCode && <p className="text-sm text-red-400">{fieldErrors.gymCode}</p>}
                {gymCodeExists && (
                  <p className="text-sm text-red-400">This gym code is already taken. Please generate a new one.</p>
                )}
                <p className="text-xs text-gray-400">
                  Generate and share this code with your members (Format: 3 letters + 3 mixed characters)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => {
                      setFormData((p) => ({ ...p, password: e.target.value }))
                      if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: "" }))
                    }}
                    onBlur={(e) => handleFieldBlur("password", e.target.value)}
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => {
                    setFormData((p) => ({ ...p, confirmPassword: e.target.value }))
                    if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: "" }))
                  }}
                  onBlur={(e) => handleFieldBlur("confirmPassword", e.target.value)}
                  className={`bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus:border-red-500 ${fieldErrors.confirmPassword ? "border-red-500" : ""}`}
                  required
                />
                {fieldErrors.confirmPassword && <p className="text-sm text-red-400">{fieldErrors.confirmPassword}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-white">Gym Location (Optional)</Label>
                <div className="space-y-3">
                  {!gymLocation && !locationSkipped ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={captureGymLocation}
                        disabled={isGettingLocation}
                        className="flex-1 bg-transparent border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                      >
                        {isGettingLocation ? (
                          <>
                            <Navigation className="h-4 w-4 mr-2 animate-spin" />
                            Getting Location...
                          </>
                        ) : (
                          <>
                            <MapPin className="h-4 w-4 mr-2" />
                            Capture Location
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={skipLocation}
                        className="text-gray-400 hover:text-white hover:bg-gray-800"
                      >
                        Skip
                      </Button>
                    </div>
                  ) : gymLocation ? (
                    <div className="p-3 bg-green-900/50 rounded-lg border border-green-700">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-green-400" />
                        <span className="text-sm font-medium text-green-300">Location Captured</span>
                      </div>
                      <p className="text-xs text-green-400 mt-1">
                        Lat: {gymLocation.lat.toFixed(6)}, Lng: {gymLocation.lng.toFixed(6)}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setGymLocation(null)
                          setLocationSkipped(false)
                        }}
                        className="mt-2 h-6 text-xs text-green-400 hover:text-green-300"
                      >
                        Change Location
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3 bg-yellow-900/50 rounded-lg border border-yellow-700">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-yellow-400" />
                        <span className="text-sm font-medium text-yellow-300">Location Skipped</span>
                      </div>
                      <p className="text-xs text-yellow-400 mt-1">You can add your gym location later from the dashboard</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocationSkipped(false)}
                        className="mt-2 h-6 text-xs text-yellow-400 hover:text-yellow-300"
                      >
                        Add Location Now
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
            </form>

            <Separator className="my-6 bg-gray-700" />

            <p className="text-center text-sm text-gray-400">
              Already have an account?{" "}
              <Link href="/auth/signin" className="text-red-400 hover:text-red-300">Sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
