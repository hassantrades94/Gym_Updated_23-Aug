"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  MapPin,
  Trophy,
  Calendar,
  Zap,
  Navigation,
  CheckCircle,
  Clock,
  AlertCircle,
  Smartphone,
  Users,
  Copy,
  Share2,
  Edit3,
  Activity,
  LogOut,
  Home,
  Sparkles,
  ChefHat,
  Camera,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

export default function MemberDashboard() {
  const { toast } = useToast()
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [distanceFromGym, setDistanceFromGym] = useState<number | null>(null)
  const [canCheckIn, setCanCheckIn] = useState(false)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [showManualCheckIn, setShowManualCheckIn] = useState(false)
  const [showReferralForm, setShowReferralForm] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [referralPhone, setReferralPhone] = useState("")
  type MemberData = {
    name: string
    coins: number
    streak: number
    monthlyVisits: number
    membershipPlan: string
    nextPayment: string
    gymName: string
    gymCode: string
    gymId: string | null
    coinValue: number
    referralCode: string
    height: number
    weight: number
    profilePicture: string | null
  }

  const [memberData, setMemberData] = useState<MemberData>({
    name: "",
    coins: 0,
    streak: 0,
    monthlyVisits: 0,
    membershipPlan: "",
    nextPayment: "",
    gymName: "",
    gymCode: "",
    gymId: null,
    coinValue: 0,
    referralCode: "",
    height: 0,
    weight: 0,
    profilePicture: null,
  })
  const [isLoading, setIsLoading] = useState(true)

  // Replace mock data with live state
  const [leaderboard, setLeaderboard] = useState<{ rank: number; name: string; streak: number; isCurrentUser: boolean }[]>([])
  const [gymLocation, setGymLocation] = useState<{ lat: number; lng: number } | null>(null)

  const calculateBMI = () => {
    if (!memberData.height || !memberData.weight) return null
    const heightInMeters = memberData.height / 100
    return (memberData.weight / (heightInMeters * heightInMeters)).toFixed(1)
  }

  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return { category: "Underweight", color: "text-blue-600" }
    if (bmi < 25) return { category: "Normal", color: "text-green-600" }
    if (bmi < 30) return { category: "Overweight", color: "text-yellow-600" }
    return { category: "Obese", color: "text-red-600" }
  }

  useEffect(() => {
    const checkUserRole = async () => {
      const userData = localStorage.getItem("flexio_user")
      if (!userData) {
        toast({
          title: "Access Denied",
          description: "Please sign in to access the member dashboard.",
          variant: "destructive",
        })
        setTimeout(() => {
          window.location.href = "/auth/signin"
        }, 2000)
        return
      }

      const user = JSON.parse(userData)
      if (user.user_type !== "member") {
        toast({
          title: "Access Denied",
          description: "This is the member dashboard. Gym owners should use the gym owner dashboard.",
          variant: "destructive",
        })
        setTimeout(() => {
          window.location.href = user.user_type === "gym_owner" ? "/owner/dashboard" : "/auth/signin"
        }, 2000)
        return
      }

      try {
        // Membership + gym (with location + coin value) + plan name
        const { data: membershipData } = await supabase
          .from("memberships")
          .select(
            `
            *,
            gyms (
              gym_name,
              gym_code,
              coin_value,
              location_latitude,
              location_longitude
            ),
            gym_plans!memberships_plan_id_fkey ( plan_name )
          `,
          )
          .eq("user_id", user.id)
          .single()

        if (membershipData?.gyms?.location_latitude && membershipData?.gyms?.location_longitude) {
          setGymLocation({
            lat: Number(membershipData.gyms.location_latitude),
            lng: Number(membershipData.gyms.location_longitude),
          })
        }

        // Coin balance
        const { data: coinData } = await supabase.from("coin_transactions").select("amount").eq("user_id", user.id)
        const totalCoins = coinData?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0

        // Check-in streak and monthly visits
        const { data: checkInData } = await supabase
          .from("check_ins")
          .select("check_in_time")
          .eq("user_id", user.id)
          .order("check_in_time", { ascending: false })

        let streak = 0
        let monthlyVisits = 0
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()

        if (checkInData?.length) {
          monthlyVisits = checkInData.filter((c) => {
            const d = new Date(c.check_in_time)
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear
          }).length

          const todayStr = new Date().toDateString()
          if (checkInData.some((c) => new Date(c.check_in_time).toDateString() === todayStr)) {
            streak = 1
            for (let i = 1; i < checkInData.length; i++) {
              const prevDate = new Date(checkInData[i - 1].check_in_time).toDateString()
              const currDate = new Date(checkInData[i].check_in_time).toDateString()
              const dayDiff =
                (new Date(prevDate).getTime() - new Date(currDate).getTime()) / (1000 * 60 * 60 * 24)
              if (dayDiff === 1) streak++
              else break
            }
          }
        }

        // Today's birthdays (gym mates only)
        let birthdays: Array<{ name: string; age: number; user_id: string }> = []
        if (membershipData?.gym_id) {
          const { data: membersForGym } = await supabase
            .from("memberships")
            .select("user_id, users ( full_name, date_of_birth )")
            .eq("gym_id", membershipData.gym_id)

          const today = new Date()
          type MemberRow = { user_id: string; users: { full_name: string; date_of_birth: string | null } | null }
          birthdays =
            (membersForGym as MemberRow[] | null)
              ?.filter((m) => m.users?.date_of_birth && m.user_id !== user.id)
              .filter((m) => {
                const dob = new Date(m.users!.date_of_birth as string)
                return dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate()
              })
              .map((m) => {
                const dob = new Date(m.users!.date_of_birth as string)
                const age = today.getFullYear() - dob.getFullYear()
                return { name: m.users!.full_name, age, user_id: m.user_id }
              }) || []
          setTodaysBirthdays(birthdays)
        }

        // Leaderboard (top monthly check-ins in this gym)
        if (membershipData?.gym_id) {
          const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString()
          const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1).toISOString()

          const { data: leaderboardData } = await supabase
            .from("check_ins")
            .select("user_id, users!inner(full_name)")
            .eq("gym_id", membershipData.gym_id)
            .gte("check_in_time", startOfMonth)
            .lt("check_in_time", startOfNextMonth)

          const counts: Record<string, { name: string; count: number }> = {}
          leaderboardData?.forEach((row: any) => {
            const uid = row.user_id
            const name = row.users.full_name
            counts[uid] = counts[uid] ? { name, count: counts[uid].count + 1 } : { name, count: 1 }
          })

          const sorted = Object.entries(counts)
            .sort(([, a], [, b]) => b.count - a.count)
            .slice(0, 5)
            .map(([uid, d], index) => ({
              rank: index + 1,
              name: d.name,
              streak: d.count, // using monthly visits count here
              isCurrentUser: uid === user.id,
            }))

          setLeaderboard(sorted)
        }

        // Wishes already sent today (disable the button)
        const todayString = new Date().toISOString().split("T")[0]
        const { data: wishesData } = await supabase
          .from("birthday_wishes")
          .select("birthday_user_id")
          .eq("wisher_id", user.id)
          .eq("wish_date", todayString)

        const wishedIds = new Set(wishesData?.map((w) => w.birthday_user_id) || [])
        setWishedMembers(new Set(birthdays.filter((b) => wishedIds.has(b.user_id)).map((b) => b.name)))



        setMemberData({
          name: user.full_name || "",
          coins: totalCoins,
          streak,
          monthlyVisits,
          membershipPlan: membershipData?.gym_plans?.plan_name || "",
          nextPayment: membershipData?.expiry_date || "",
          gymName: membershipData?.gyms?.gym_name || "",
          gymCode: membershipData?.gyms?.gym_code || "",
          gymId: membershipData?.gym_id ?? null,
          coinValue: membershipData?.gyms?.coin_value ?? 4.0,
          referralCode: user.phone_number || "",
          height: user.height || 0,
          weight: user.weight || 0,
          profilePicture: user.profile_picture || null,
        })
      } catch (error) {
        console.error("Error fetching user data:", error)
        setMemberData((prev) => ({ ...prev })) // no mock fallbacks
      }

      setIsLoading(false)
    }

    checkUserRole()
  }, [toast])

  // Separate useEffect for geolocation to avoid blocking UI
  useEffect(() => {
    if (!gymLocation) return

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }
          setLocation(userLoc)

          // Calculate distance to gym
          const distance = calculateDistance(userLoc.lat, userLoc.lng, gymLocation.lat, gymLocation.lng)
          setDistanceFromGym(distance)
          setCanCheckIn(distance <= 0.1)
        },
        (error) => {
          console.error("Geolocation error:", error)
          let errorMessage = "Location access denied"
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location access denied"
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location unavailable"
              break
            case error.TIMEOUT:
              errorMessage = "Location request timeout"
              break
          }
          setLocationError(errorMessage)
          setShowManualCheckIn(true)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        },
      )
    } else {
      setLocationError("Geolocation not supported")
      setShowManualCheckIn(true)
    }
  }, [gymLocation])

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const getPaymentStatus = () => {
    const today = new Date()
    const paymentDate = new Date(memberData.nextPayment)
    const diffTime = paymentDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    let bgColor = "bg-gray-800"
    let borderColor = "border-gray-700"
    let textColor = "text-white"

    if (diffDays < 0) {
      // Expired - dark red
      bgColor = "bg-red-900"
      borderColor = "border-red-800"
      textColor = "text-red-200"
    } else if (diffDays <= 1) {
      // 1 day or less - light red
      bgColor = "bg-red-800"
      borderColor = "border-red-700"
      textColor = "text-red-200"
    } else if (diffDays <= 7) {
      // 7 days or less - orange
      bgColor = "bg-orange-800"
      borderColor = "border-orange-700"
      textColor = "text-orange-200"
    } else if (diffDays < 15) {
      // Less than 15 days - yellow
      bgColor = "bg-yellow-800"
      borderColor = "border-yellow-700"
      textColor = "text-yellow-200"
    } else {
      // 15+ days - light green
      bgColor = "bg-green-800"
      borderColor = "border-green-700"
      textColor = "text-green-200"
    }

    return {
      daysLeft: diffDays,
      bgColor,
      borderColor,
      textColor,
      statusText: diffDays < 0 ? "Expired" : diffDays === 0 ? "Due Today" : `${diffDays} days left`,
    }
  }

  const handleCheckIn = async () => {
    setIsCheckingIn(true)
  
    try {
      const userData = localStorage.getItem("flexio_user")
      if (!userData) throw new Error("User not authenticated")
      
      const user = JSON.parse(userData)
      const now = new Date().toISOString()
      
      // Insert check-in record
      const { error: checkInError } = await supabase
        .from("check_ins")
        .insert({
          user_id: user.id,
          gym_id: memberData.gymId,
          check_in_time: now,
          location_latitude: location?.lat,
          location_longitude: location?.lng,
          distance_from_gym: distanceFromGym,
        })
      
      if (checkInError) throw checkInError
      
      // Award coins
      const { error: coinError } = await supabase
        .from("coin_transactions")
        .insert({
          user_id: user.id,
          gym_id: memberData.gymId,
          transaction_type: "earned",
          amount: 100,
          description: "Daily check-in reward",
        })
      
      if (coinError) throw coinError
      
      // Update member data
      setMemberData((prev) => ({
        ...prev,
        coins: prev.coins + 100,
        monthlyVisits: prev.monthlyVisits + 1,
      }))
      
      toast({
        title: "Check-in successful! 🎉",
        description: "You earned 100 coins for today's workout!",
      })
    } catch (error) {
      console.error("Check-in error:", error)
      toast({
        title: "Check-in failed",
        description: "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsCheckingIn(false)
    }
  }

  const handleManualCheckIn = async () => {
    setIsCheckingIn(true)

    setTimeout(() => {
      toast({
        title: "Manual check-in successful! 🎉",
        description: "You earned 100 coins for today's workout!",
      })
      setIsCheckingIn(false)
      setShowManualCheckIn(false)
    }, 1500)
  }

  const handleReferral = async () => {
    if (!referralPhone) {
      toast({
        title: "Phone number required",
        description: "Please enter your friend's phone number.",
        variant: "destructive",
      })
      return
    }

    // Phone number validation
    const phoneRegex = /^[6-9]\d{9}$/
    if (!phoneRegex.test(referralPhone)) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid 10-digit Indian mobile number.",
        variant: "destructive",
      })
      return
    }

    setTimeout(() => {
      toast({
        title: "Referral sent! 🎉",
        description: "Your friend will receive an invitation SMS. You'll both get 200 coins when they join!",
      })
      setReferralPhone("")
      setShowReferralForm(false)
    }, 1000)
  }

  const handleProfileUpdate = () => {
    toast({
      title: "Profile updated!",
      description: "Your height and weight have been saved successfully.",
    })
    setShowEditProfile(false)
  }

  const handleLogout = () => {
    localStorage.removeItem("flexio_user")
    toast({
      title: "Logged out successfully",
      description: "See you next time!",
    })
    // In a real app, this would clear auth tokens and redirect
    setTimeout(() => {
      window.location.href = "/auth/signin"
    }, 1000)
  }

  const copyReferralCode = () => {
    navigator.clipboard.writeText(memberData.referralCode)
    toast({
      title: "Referral code copied!",
      description: "Share this code with friends to earn rewards.",
    })
  }

  const formatDistance = (distance: number) => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m away`
    }
    return `${distance.toFixed(1)}km away`
  }

  const [birthdayWishes, setBirthdayWishes] = useState<string[]>([])
  const [wishedMembers, setWishedMembers] = useState<Set<string>>(new Set())
  const [todaysBirthdays, setTodaysBirthdays] = useState<{ name: string; age: number; user_id: string }[]>([])

  const isUserBirthdayToday = false // Set to true to test birthday wishes display

  const handleBirthdayWish = async (memberName: string, userId: string) => {
    if (wishedMembers.has(memberName)) return
    try {
      const raw = localStorage.getItem("flexio_user")
      const currentUser = raw ? JSON.parse(raw) : null
      if (!currentUser?.id || !currentUser?.gym_id) {
        toast({
          title: "Not authenticated",
          description: "Please sign in again.",
          variant: "destructive",
        })
        return
      }

      const todayString = new Date().toISOString().split("T")[0]

      const { error } = await supabase.from("birthday_wishes").insert({
        wisher_id: currentUser.id,
        birthday_user_id: userId,
        gym_id: currentUser.gym_id,
        wish_date: todayString,
      })
      if (error) throw error

      setWishedMembers((prev) => new Set([...prev, memberName]))
      setBirthdayWishes((prev) => [...prev, `You wished ${memberName}! 🎉`])
      toast({
        title: "Birthday wish sent! 🎉",
        description: `${memberName} will receive your birthday wishes!`,
      })
    } catch (err: any) {
      console.error("Error sending birthday wish:", err)
      toast({
        title: "Failed to send wish",
        description: err?.message || "Please try again later",
        variant: "destructive",
      })
    }
  }

  const handleProfilePictureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // In a real app, this would upload to a server/cloud storage
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setMemberData((prev) => ({ ...prev, profilePicture: result }))
        toast({
          title: "Profile picture updated!",
          description: "Your new profile picture has been saved.",
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const bmi = calculateBMI()
  const bmiInfo = bmi ? getBMICategory(Number.parseFloat(bmi)) : null
  const myRank = leaderboard.find((m) => m.isCurrentUser)?.rank

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Zap className="h-5 w-5 text-white animate-pulse" />
          </div>
          <p className="text-white">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black pb-20 text-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#da1c24] border-b border-red-800">
        <div className="max-w-md mx-auto px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                <Zap className="h-5 w-5 text-[#da1c24]" />
              </div>
              <span className="font-bold text-white text-lg truncate">Flexio</span>
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
          <div className="text-center px-2">
            <h1 className="text-2xl font-bold text-white mb-1 truncate">
              Welcome back, {memberData.name.split(" ")[0]}!
            </h1>
            <p className="text-lg font-semibold text-gray-300 mb-1 truncate">{memberData.gymName}</p>
            <p className="text-sm text-gray-400 truncate">Member Dashboard</p>
            <Badge variant="secondary" className="bg-blue-900 text-blue-200 mt-2">
              {memberData.membershipPlan}
            </Badge>
          </div>

          <Card className="bg-gray-800/90 border-gray-700 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-2xl text-white">{memberData.coins.toLocaleString()}</CardTitle>
                  <CardDescription className="text-gray-400 text-sm">
                    Total Coins • Worth ₹{(memberData.coins * memberData.coinValue).toLocaleString()}
                  </CardDescription>
                  <p className="text-xs text-gray-500 mt-1">1 coin = ₹{memberData.coinValue.toFixed(2)}</p>
                </div>
                <Trophy className="h-8 w-8 text-yellow-500 flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="text-gray-400 truncate">
                  {locationError ? (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-orange-500 flex-shrink-0" />
                      <span className="truncate">{locationError}</span>
                    </span>
                  ) : distanceFromGym !== null ? (
                    formatDistance(distanceFromGym)
                  ) : (
                    "Getting location..."
                  )}
                </span>
                {canCheckIn && (
                  <Badge variant="secondary" className="bg-green-900 text-green-200 flex-shrink-0">
                    In Range
                  </Badge>
                )}
              </div>

              {/* Check-in logic with improved mobile buttons */}
              {!locationError ? (
                <Button
                  onClick={handleCheckIn}
                  disabled={!canCheckIn || isCheckingIn}
                  className="w-full bg-transparent border-white text-white hover:bg-white hover:text-gray-900 min-h-[44px]"
                  size="lg"
                  variant="outline"
                >
                  {isCheckingIn ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                      <span className="truncate">Checking In...</span>
                    </>
                  ) : canCheckIn ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">Check In Now (+100 coins)</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">Get Closer to Check In</span>
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-orange-950 rounded-lg border border-orange-800">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-orange-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-orange-200 truncate">GPS Check-in Unavailable</span>
                    </div>
                    <p className="text-xs text-orange-300 leading-relaxed">
                      Location access is needed for automatic check-ins. You can still check in manually below.
                    </p>
                  </div>

                  {showManualCheckIn && (
                    <Button
                      onClick={handleManualCheckIn}
                      disabled={isCheckingIn}
                      className="w-full bg-transparent border-white text-white hover:bg-white hover:text-gray-900 min-h-[44px]"
                      size="lg"
                      variant="outline"
                    >
                      {isCheckingIn ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                          <span className="truncate">Checking In...</span>
                        </>
                      ) : (
                        <>
                          <Smartphone className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span className="truncate">Manual Check In (+100 coins)</span>
                        </>
                      )}
                    </Button>
                  )}

                  <Button
                    onClick={() => window.location.reload()}
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-gray-400 hover:text-white min-h-[36px]"
                  >
                    Try GPS Again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {(() => {
            const paymentStatus = getPaymentStatus()
            return (
              <Card className={`${paymentStatus.bgColor} ${paymentStatus.borderColor}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-medium ${paymentStatus.textColor}`}>Next Payment</p>
                      <p className={`text-sm ${paymentStatus.textColor.replace("200", "300")}`}>
                        Due {new Date(memberData.nextPayment).toLocaleDateString()} • {paymentStatus.statusText}
                      </p>
                    </div>
                    <Link href="/member/payment">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`bg-transparent border-current ${paymentStatus.textColor} hover:bg-current hover:text-gray-900`}
                      >
                        Manage
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* AI-Powered Nutrition Plan */}
          <Card className="bg-gradient-to-br from-green-950 to-emerald-950 border-green-800">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="p-3 bg-green-900 rounded-full">
                    <ChefHat className="h-8 w-8 text-green-400" />
                  </div>
                  <Sparkles className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-green-200 mb-2">AI-Powered Nutrition Plan</h3>
                  <p className="text-sm text-green-300 mb-4">
                    Get personalized meal plans tailored to your fitness goals and dietary preferences
                  </p>
                </div>
                <Link href="/member/nutrition" className="block">
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white" size="lg">
                    Create Your Plan Now
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                </div>
                <div className="text-2xl font-bold text-white">{memberData.streak}</div>
                <div className="text-sm text-gray-400">Day Streak</div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-white">{memberData.monthlyVisits}</div>
                <div className="text-sm text-gray-400">This Month</div>
              </CardContent>
            </Card>
          </div>

          {/* BMI Status */}
          {bmi && (
            <Card className="bg-gray-800/90 border-gray-700 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg text-white min-w-0 flex-1">
                    <Activity className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="truncate">BMI Status</span>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEditProfile(!showEditProfile)}
                    className="text-gray-400 hover:text-white flex-shrink-0"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className="text-gray-700"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={`${Math.min((Number.parseFloat(bmi) / 35) * 251, 251)} 251`}
                        className={bmiInfo?.color.replace("text-", "text-") || "text-green-500"}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white">{bmi}</div>
                        <div className="text-xs text-gray-500">BMI</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <p className={`font-medium ${bmiInfo?.color}`}>{bmiInfo?.category}</p>
                  <p className="text-sm text-gray-400">
                    Height: {memberData.height}cm • Weight: {memberData.weight}kg
                  </p>
                </div>

                {showEditProfile && (
                  <div className="space-y-3 p-3 bg-gray-800 rounded-lg">
                    <div className="space-y-2">
                      <Label className="text-white text-sm">Profile Picture</Label>
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                          {memberData.profilePicture ? (
                            <img
                              src={memberData.profilePicture || "/placeholder.svg"}
                              alt="Profile"
                              className="w-full h-full object-cover object-center"
                            />
                          ) : (
                            <span className="text-white font-semibold text-lg text-center">
                              {memberData.name.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePictureUpload}
                            className="hidden"
                            id="profilePictureInput"
                          />
                          <Label
                            htmlFor="profilePictureInput"
                            className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-md border border-gray-600"
                          >
                            <Camera className="h-4 w-4" />
                            Upload Photo
                          </Label>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="height" className="text-white text-sm">
                          Height (cm)
                        </Label>
                        <Input
                          id="height"
                          type="number"
                          value={memberData.height}
                          onChange={(e) =>
                            setMemberData((prev) => ({ ...prev, height: Number.parseInt(e.target.value) || 0 }))
                          }
                          placeholder="175"
                          className="bg-gray-700 border-gray-600 text-white text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="weight" className="text-white text-sm">
                          Weight (kg)
                        </Label>
                        <Input
                          id="weight"
                          type="number"
                          value={memberData.weight}
                          onChange={(e) =>
                            setMemberData((prev) => ({ ...prev, weight: Number.parseInt(e.target.value) || 0 }))
                          }
                          placeholder="70"
                          className="bg-gray-700 border-gray-600 text-white text-sm"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleProfileUpdate}
                      className="w-full bg-transparent border-white text-white hover:bg-white hover:text-gray-900 min-h-[40px]"
                      size="sm"
                      variant="outline"
                    >
                      Update Profile
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Special Birthday Wishes Block */}
          {isUserBirthdayToday && (
            <Card className="bg-gradient-to-br from-pink-950 to-purple-950 border-pink-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-pink-200">🎉 Happy Birthday!</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-pink-300 text-sm">Birthday wishes you received today:</p>
                {birthdayWishes.length > 0 ? (
                  <div className="space-y-2">
                    {birthdayWishes.map((wish, index) => (
                      <div key={index} className="p-2 bg-pink-900/50 rounded text-pink-200 text-sm">
                        {wish}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-pink-400 text-sm italic">No wishes yet, but the day is young! 🎂</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Today's Birthdays Section */}
          {todaysBirthdays.length > 0 && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-white">🎂 Today's Birthdays</CardTitle>
                <CardDescription className="text-gray-400 text-sm">Celebrate with your gym mates!</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {todaysBirthdays.map((member) => (
                  <div key={member.user_id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium text-white">{member.name}</p>
                      <p className="text-sm text-gray-400">Turning {member.age} today!</p>
                    </div>
                    <Button
                      onClick={() => handleBirthdayWish(member.name, member.user_id)}
                      disabled={wishedMembers.has(member.name)}
                      className="bg-transparent border-white text-white hover:bg-white hover:text-gray-900"
                      size="sm"
                      variant="outline"
                    >
                      {wishedMembers.has(member.name) ? "Wished! ✓" : `Wish ${member.name.split(" ")[0]}`}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="bg-gray-800/90 border-gray-700 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg text-white min-w-0 flex-1">
                  <Trophy className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                  <span className="truncate">Gym Leaderboard</span>
                </CardTitle>
                <CardDescription className="text-gray-400 text-sm">
                  Top 5 most active members{typeof myRank === "number" ? ` • You're #${myRank}` : ""}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {leaderboard.map((member) => (
                <div
                  key={member.rank}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    member.isCurrentUser ? "bg-blue-950 border border-blue-800" : "bg-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        member.rank <= 3
                          ? member.rank === 1
                            ? "bg-yellow-500 text-white"
                            : member.rank === 2
                              ? "bg-gray-400 text-white"
                              : "bg-orange-500 text-white"
                          : "bg-gray-600 text-gray-300"
                      }`}
                    >
                      {member.rank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium truncate ${member.isCurrentUser ? "text-blue-200" : "text-white"}`}>
                        {member.name} {member.isCurrentUser && "(You)"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Zap className="h-4 w-4 text-orange-500" />
                    <span className="font-medium text-white">{member.streak}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-gray-800/90 border-gray-700 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg text-white min-w-0 flex-1">
                  <Users className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  <span className="truncate">Refer Friends</span>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReferralForm(!showReferralForm)}
                  className="text-gray-400 hover:text-white flex-shrink-0"
                >
                  {showReferralForm ? "Cancel" : "Refer"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-blue-950 rounded-lg border border-blue-800">
                <p className="text-sm font-medium text-blue-200 mb-1">
                  Earn 200 coins for each friend! (Worth ₹{(200 * memberData.coinValue).toLocaleString()})
                </p>
                <p className="text-xs text-blue-300 leading-relaxed">
                  Your friend also gets 200 coins when they join {memberData.gymName}
                </p>
              </div>

              {showReferralForm ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="referralPhone" className="text-white text-sm">
                      Friend's Phone Number
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">+91</span>
                      <Input
                        id="referralPhone"
                        type="tel"
                        value={referralPhone}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "").slice(0, 10)
                          setReferralPhone(value)
                        }}
                        placeholder="9876543210"
                        className="bg-gray-700 border-gray-600 text-white pl-12 text-sm"
                        maxLength={10}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleReferral}
                    className="w-full bg-transparent border-white text-white hover:bg-white hover:text-gray-900 min-h-[44px]"
                    variant="outline"
                  >
                    <Share2 className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="truncate">Send Invitation</span>
                  </Button>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-2">Or share your referral code:</p>
                    <div className="flex items-center justify-between p-2 bg-gray-700 rounded border border-gray-600">
                      <span className="font-mono text-sm text-white truncate flex-1 mr-2">
                        {memberData.referralCode}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyReferralCode}
                        className="text-gray-400 hover:text-white flex-shrink-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">Your Referral Code</p>
                    <p className="text-sm font-mono text-gray-400 truncate">{memberData.referralCode}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyReferralCode}
                    className="bg-transparent border-white text-white hover:bg-white hover:text-gray-900 flex-shrink-0 ml-3"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    <span className="hidden xs:inline">Copy</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#da1c24] border-t border-red-800">
        <div className="max-w-md mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <Link
              href="/member/dashboard"
              className="flex flex-col items-center gap-1 text-white hover:text-white/80 min-w-0"
            >
              <Home className="h-5 w-5 flex-shrink-0" />
              <span className="text-xs font-medium truncate">Home</span>
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
