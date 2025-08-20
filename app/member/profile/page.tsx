"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { User, Phone, Calendar, MapPin, Camera, Edit3, Save, Eye, EyeOff, ArrowLeft, Zap, LogOut } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { redirectIfNotAuthenticated } from "@/lib/auth"

export default function MemberProfile() {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const [profileData, setProfileData] = useState({
    name: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    height: 0,
    weight: 0,
    gymName: "",
    gymCode: "",
    membershipPlan: "",
    profilePicture: null as string | null,
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const [errors, setErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    phone: "",
    name: "",
  })

  const handleProfilePictureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive",
        })
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setProfileData((prev) => ({ ...prev, profilePicture: result }))
        toast({
          title: "Profile picture updated!",
          description: "Your new profile picture has been saved.",
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const validatePhone = (phone: string) => {
    const phoneRegex = /^[6-9]\d{9}$/
    const cleanPhone = phone.replace(/\D/g, "")
    return phoneRegex.test(cleanPhone)
  }

  const validatePassword = (password: string) => {
    return password.length >= 8
  }

  useEffect(() => {
    const user = redirectIfNotAuthenticated("member")
    if (!user) return

    const load = async () => {
      try {
        // Fetch user personal data
        const { data: userRow, error: uErr } = await supabase
          .from("users")
          .select("full_name, phone_number, date_of_birth, gender, height, weight, profile_picture_url")
          .eq("id", user.id)
          .single()
        if (uErr) throw uErr

        // Fetch membership + gym + plan for display
        const { data: membership, error: mErr } = await supabase
          .from("memberships")
          .select(
            `id, plan_id,
             gyms ( gym_name, gym_code ),
             gym_plans!memberships_plan_id_fkey ( plan_name )`
          )
          .eq("user_id", user.id)
          .single()
        // membership might not exist, so don't throw if mErr

        const gymsRelation = membership?.gyms as any
        const gymObj = Array.isArray(gymsRelation) ? gymsRelation[0] : gymsRelation
        const plansRelation = membership?.gym_plans as any
        const planObj = Array.isArray(plansRelation) ? plansRelation[0] : plansRelation

        setProfileData((prev) => ({
          ...prev,
          name: userRow?.full_name || "",
          phone: userRow?.phone_number || "",
          dateOfBirth: userRow?.date_of_birth || "",
          gender: userRow?.gender || "",
          height: Number(userRow?.height ?? 0),
          weight: Number(userRow?.weight ?? 0),
          gymName: gymObj?.gym_name || "",
          gymCode: gymObj?.gym_code || "",
          membershipPlan: planObj?.plan_name || "",
          profilePicture: userRow?.profile_picture_url || null,
        }))
      } catch (e: any) {
        console.error(e)
        toast({
          title: "Failed to load profile",
          description: e.message || "Please try again later",
          variant: "destructive",
        })
      }
    }

    load()
  }, [toast])

  const handleSaveProfile = async () => {
    const newErrors = { ...errors }
    // Validate name
    if (!profileData.name.trim()) {
      newErrors.name = "Name is required"
    } else {
      newErrors.name = ""
    }

    // Validate phone (expects +91 ##########)
    const cleanDigits = profileData.phone.replace(/\D/g, "").slice(-10)
    if (!validatePhone(cleanDigits)) {
      newErrors.phone = "Please enter a valid 10-digit phone number"
    } else {
      newErrors.phone = ""
    }

    setErrors(newErrors)
    if (newErrors.name || newErrors.phone) return

    try {
      const user = redirectIfNotAuthenticated("member")
      if (!user) return

      // Normalize fields for DB
      const phoneForDb = `+91${cleanDigits}`
      const dobForDb = profileData.dateOfBirth || null // expect YYYY-MM-DD from <input type="date">
      const genderForDb =
        profileData.gender === "Male" || profileData.gender === "Female" || profileData.gender === "Others"
          ? profileData.gender
          : null

      const { error: updErr } = await supabase
        .from("users")
        .update({
          full_name: profileData.name,
          phone_number: phoneForDb,
          date_of_birth: dobForDb,
          gender: genderForDb,
          height: profileData.height || null,
          weight: profileData.weight || null,
        })
        .eq("id", user.id)

      if (updErr) throw updErr

      // Update localStorage user so UI across app reflects new info immediately
      try {
        const raw = localStorage.getItem("flexio_user")
        if (raw) {
          const current = JSON.parse(raw)
          localStorage.setItem(
            "flexio_user",
            JSON.stringify({
              ...current,
              full_name: profileData.name,
              phone_number: phoneForDb,
              height: profileData.height,
              weight: profileData.weight,
            }),
          )
        }
      } catch {}

      toast({
        title: "Profile updated successfully!",
        description: "Your personal information has been saved.",
      })
      setIsEditing(false)
    } catch (e: any) {
      toast({
        title: "Update failed",
        description: e.message || "Please try again later",
        variant: "destructive",
      })
    }
  }

  const handleChangePassword = () => {
    const newErrors = { ...errors }

    // Validate current password
    if (!passwordData.currentPassword) {
      newErrors.currentPassword = "Current password is required"
    } else {
      newErrors.currentPassword = ""
    }

    // Validate new password
    if (!validatePassword(passwordData.newPassword)) {
      newErrors.newPassword = "Password must be at least 8 characters long"
    } else {
      newErrors.newPassword = ""
    }

    // Validate confirm password
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    } else {
      newErrors.confirmPassword = ""
    }

    setErrors(newErrors)

    if (!newErrors.currentPassword && !newErrors.newPassword && !newErrors.confirmPassword) {
      // Simulate password change
      setTimeout(() => {
        toast({
          title: "Password changed successfully!",
          description: "Your password has been updated.",
        })
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        })
        setIsChangingPassword(false)
      }, 1000)
    }
  }

  const handleLogout = () => {
    toast({
      title: "Logged out successfully",
      description: "See you next time!",
    })
    setTimeout(() => {
      window.location.href = "/auth/signin"
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black pb-20 text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#da1c24] border-b border-red-800">
        <div className="max-w-md mx-auto px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/member/dashboard">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 p-2">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                  <Zap className="h-5 w-5 text-[#da1c24]" />
                </div>
                <span className="font-bold text-white text-lg">Profile</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white hover:bg-white/20 flex-shrink-0"
            >
              <LogOut className="h-4 w-4 mr-1" />
              <span className="hidden xs:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="px-3 py-6 pt-20">
        <div className="max-w-md mx-auto space-y-6">
          {/* Profile Picture Section */}
          <Card className="bg-gray-800/90 border-gray-700 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full flex items-center justify-center overflow-hidden">
                    {profileData.profilePicture ? (
                      <img
                        src={profileData.profilePicture || "/placeholder.svg"}
                        alt="Profile"
                        className="w-full h-full object-cover object-center"
                      />
                    ) : (
                      <span className="text-white font-semibold text-2xl text-center">
                        {profileData.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureUpload}
                    className="hidden"
                    id="profilePictureInput"
                  />
                  <Label
                    htmlFor="profilePictureInput"
                    className="absolute -bottom-2 -right-2 cursor-pointer p-2 bg-[#da1c24] hover:bg-red-700 text-white rounded-full border-2 border-gray-800"
                  >
                    <Camera className="h-4 w-4" />
                  </Label>
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-white">{profileData.name}</h2>
                  <p className="text-gray-400">{profileData.gymName}</p>
                  <Badge variant="secondary" className="bg-blue-900 text-blue-200 mt-2">
                    {profileData.membershipPlan}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card className="bg-gray-800/90 border-gray-700 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                  <User className="h-5 w-5 text-blue-500" />
                  Personal Information
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-gray-400 hover:text-white"
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-white text-sm">
                      Full Name *
                    </Label>
                    <Input
                      id="name"
                      value={profileData.name}
                      onChange={(e) => {
                        setProfileData((prev) => ({ ...prev, name: e.target.value }))
                        if (errors.name) setErrors((prev) => ({ ...prev, name: "" }))
                      }}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                    {errors.name && <p className="text-red-400 text-xs">{errors.name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-white text-sm">
                      Phone Number *
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">+91</span>
                      <Input
                        id="phone"
                        type="tel"
                        value={profileData.phone.replace("+91", "").trim()}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "").slice(0, 10)
                          setProfileData((prev) => ({ ...prev, phone: `+91 ${value}` }))
                          if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" }))
                        }}
                        className="bg-gray-700 border-gray-600 text-white pl-12"
                        maxLength={10}
                      />
                    </div>
                    {errors.phone && <p className="text-red-400 text-xs">{errors.phone}</p>}
                  </div>

                  {/* Date of Birth */}
                  <div className="space-y-2">
                    <Label htmlFor="dob" className="text-white text-sm">
                      Date of Birth
                    </Label>
                    <Input
                      id="dob"
                      type="date"
                      value={profileData.dateOfBirth || ""}
                      onChange={(e) => setProfileData((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                    <p className="text-gray-500 text-xs">Format: YYYY-MM-DD</p>
                  </div>

                  {/* Gender */}
                  <div className="space-y-2">
                    <Label htmlFor="gender" className="text-white text-sm">
                      Gender
                    </Label>
                    <select
                      id="gender"
                      value={profileData.gender || ""}
                      onChange={(e) => setProfileData((prev) => ({ ...prev, gender: e.target.value }))}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-md p-2"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>

                  {/* Height */}
                  <div className="space-y-2">
                    <Label htmlFor="height" className="text-white text-sm">
                      Height (cm)
                    </Label>
                    <Input
                      id="height"
                      type="number"
                      value={profileData.height || 0}
                      onChange={(e) => setProfileData((prev) => ({ ...prev, height: Number(e.target.value || 0) }))}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>

                  {/* Weight */}
                  <div className="space-y-2">
                    <Label htmlFor="weight" className="text-white text-sm">
                      Weight (kg)
                    </Label>
                    <Input
                      id="weight"
                      type="number"
                      value={profileData.weight || 0}
                      onChange={(e) => setProfileData((prev) => ({ ...prev, weight: Number(e.target.value || 0) }))}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setIsEditing(false)} className="text-gray-300">
                      Cancel
                    </Button>
                    <Button onClick={handleSaveProfile} className="bg-[#da1c24] hover:bg-red-700 text-white">
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span className="text-white">{profileData.phone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-white">
                      {profileData.dateOfBirth} • {profileData.gender}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-white">
                      {profileData.gymName} • {profileData.gymCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-white">
                      {profileData.height}cm • {profileData.weight}kg
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Change Password Section */}
          <Card className="bg-gray-800/90 border-gray-700 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                  <Edit3 className="h-5 w-5 text-green-500" />
                  Change Password
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsChangingPassword(!isChangingPassword)}
                  className="text-gray-400 hover:text-white"
                >
                  {isChangingPassword ? "Cancel" : "Change"}
                </Button>
              </div>
            </CardHeader>
            {isChangingPassword && (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="text-white text-sm">
                    Current Password *
                  </Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordData.currentPassword}
                      onChange={(e) => {
                        setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }))
                        if (errors.currentPassword) setErrors((prev) => ({ ...prev, currentPassword: "" }))
                      }}
                      className="bg-gray-700 border-gray-600 text-white pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {errors.currentPassword && <p className="text-red-400 text-xs">{errors.currentPassword}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-white text-sm">
                    New Password *
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) => {
                        setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))
                        if (errors.newPassword) setErrors((prev) => ({ ...prev, newPassword: "" }))
                      }}
                      className="bg-gray-700 border-gray-600 text-white pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {errors.newPassword && <p className="text-red-400 text-xs">{errors.newPassword}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-white text-sm">
                    Confirm New Password *
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordData.confirmPassword}
                      onChange={(e) => {
                        setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))
                        if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: "" }))
                      }}
                      className="bg-gray-700 border-gray-600 text-white pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {errors.confirmPassword && <p className="text-red-400 text-xs">{errors.confirmPassword}</p>}
                </div>

                <Button onClick={handleChangePassword} className="w-full bg-[#da1c24] hover:bg-red-700 text-white">
                  Update Password
                </Button>
              </CardContent>
            )}
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#da1c24] border-t border-red-800">
        <div className="max-w-md mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <Link
              href="/member/dashboard"
              className="flex flex-col items-center gap-1 text-white hover:text-white/80 min-w-0"
            >
              <ArrowLeft className="h-5 w-5 flex-shrink-0" />
              <span className="text-xs font-medium truncate">Back</span>
            </Link>

            <Link
              href="/member/calorie-checker"
              className="flex flex-col items-center gap-1 text-white hover:text-white/80"
            >
              <div className="p-2 bg-white/20 rounded-full">
                <Camera className="h-7 w-7" />
              </div>
              <span className="text-xs font-medium truncate">Calorie Checker</span>
            </Link>

            <Link
              href="/member/profile"
              className="flex flex-col items-center gap-1 text-white hover:text-white/80 min-w-0"
            >
              <Edit3 className="h-5 w-5 flex-shrink-0" />
              <span className="text-xs font-medium truncate">Profile</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
