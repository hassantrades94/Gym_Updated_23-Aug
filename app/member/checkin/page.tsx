"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  MapPin,
  Navigation,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowLeft,
  Zap,
  Target,
  Timer,
  Award,
  Home
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { MemberAccessService } from "@/lib/member-access-service"
import { locationTrackingService } from "@/lib/location-tracking-service"

export default function CheckInPage() {
  const { toast } = useToast()
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [distanceFromGym, setDistanceFromGym] = useState<number | null>(null)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [memberData, setMemberData] = useState({
    name: "",
    gymName: "",
    coins: 0,
    streak: 0,
    gymId: null as string | null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [gymLocation, setGymLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [trackingActive, setTrackingActive] = useState(false)
  const [continuousPresenceTime, setContinuousPresenceTime] = useState(0)
  const [locationStatus, setLocationStatus] = useState<'checking' | 'inside' | 'outside' | 'error'>('checking')
  const [validationStatus, setValidationStatus] = useState({
    withinRadius: false,
    hasRequiredPresence: false,
    canCheckIn: false,
  })
  const [accessDenied, setAccessDenied] = useState<{
    reason: string
    memberType: 'free' | 'paid'
    memberPosition: number
    gymOwner: { name: string; phone?: string } | null
  } | null>(null)

  // Load user data and initialize location tracking
  useEffect(() => {
    const checkUserAndInitialize = async () => {
      try {
        const userStr = localStorage.getItem("flexio_user")
        if (!userStr) {
          toast({
            title: "Authentication required",
            description: "Please sign in to continue.",
            variant: "destructive",
          })
          setTimeout(() => {
            window.location.href = "/auth/signin"
          }, 2000)
          return
        }

        const user = JSON.parse(userStr)
        const { data: membershipData, error } = await supabase
          .from("memberships")
          .select(`
            *, 
            gyms(gym_name, location_latitude, location_longitude, coin_value),
            gym_plans(plan_name)
          `)
          .eq("user_id", user.id)
          .eq("is_active", true)
          .single()

        if (error || !membershipData) {
          toast({
            title: "Membership not found",
            description: "No active membership found. Please contact your gym.",
            variant: "destructive",
          })
          setTimeout(() => {
            window.location.href = "/auth/signin"
          }, 2000)
          return
        }

        // Check member access
        const accessResult = await MemberAccessService.checkMemberAccess(user.id, membershipData.gym_id)
        
        if (!accessResult.hasAccess) {
          const gymOwner = await MemberAccessService.getGymOwnerContact(membershipData.gym_id)
          
          toast({
            title: "Check-in Access Restricted",
            description: accessResult.memberType === 'paid' 
              ? `Your gym owner needs to recharge their wallet to maintain your membership access. ${accessResult.reason}`
              : accessResult.reason,
            variant: "destructive",
          })

          setAccessDenied({
            reason: accessResult.reason || 'Access denied',
            memberType: accessResult.memberType,
            memberPosition: accessResult.memberPosition,
            gymOwner: gymOwner
          })
          return
        }

        // Set gym location
        if (membershipData?.gyms?.location_latitude && membershipData?.gyms?.location_longitude) {
          setGymLocation({
            lat: Number(membershipData.gyms.location_latitude),
            lng: Number(membershipData.gyms.location_longitude),
          })
        }

        // Get current coins and streak
        const { data: coinData } = await supabase
          .from("coin_transactions")
          .select("amount")
          .eq("user_id", user.id)
        const totalCoins = coinData?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0

        const { data: checkInData } = await supabase
          .from("check_ins")
          .select("check_in_time")
          .eq("user_id", user.id)
          .order("check_in_time", { ascending: false })
          .limit(10)

        let streak = 0
        if (checkInData?.length) {
          const todayStr = new Date().toDateString()
          if (checkInData.some((c) => new Date(c.check_in_time).toDateString() === todayStr)) {
            streak = 1
            for (let i = 1; i < checkInData.length; i++) {
              const prevDate = new Date(checkInData[i - 1].check_in_time).toDateString()
              const currDate = new Date(checkInData[i].check_in_time).toDateString()
              const dayDiff = (new Date(prevDate).getTime() - new Date(currDate).getTime()) / (1000 * 60 * 60 * 24)
              if (dayDiff === 1) {
                streak++
              } else {
                break
              }
            }
          }
        }

        setMemberData({
          name: user.full_name,
          gymName: membershipData?.gyms?.gym_name || '',
          coins: totalCoins,
          streak,
          gymId: membershipData?.gym_id ?? null,
        })
      } catch (error) {
        console.error("Error loading check-in data:", error)
        toast({
          title: "Error",
          description: "Failed to load check-in data. Please try again.",
          variant: "destructive",
        })
      }

      setIsLoading(false)
    }

    checkUserAndInitialize()
  }, [toast])

  // Initialize location tracking
  useEffect(() => {
    if (!gymLocation) return

    const startLocationTracking = async () => {
      try {
        locationTrackingService.setGymLocation(gymLocation)
        
        locationTrackingService.setCallbacks({
          onLocationUpdate: (data) => {
            setLocation(data.lastPosition || { lat: 0, lng: 0 })
            setDistanceFromGym(data.distance)
            setContinuousPresenceTime(data.continuousTime)
            setValidationStatus(data.validationStatus)
            setLocationStatus(data.isWithinRadius ? 'inside' : 'outside')
          },
          onAutoCheckIn: () => {
            handleAutoCheckIn()
          },
        })

        await locationTrackingService.startTracking()
        setTrackingActive(true)
        setLocationError(null)
      } catch (error) {
        console.error('Location tracking error:', error)
        setLocationError('Location tracking failed')
        setLocationStatus('error')
      }
    }

    startLocationTracking()
  }, [gymLocation])

  const handleCheckIn = async () => {
    if (isCheckingIn) return
    setIsCheckingIn(true)

    try {
      const userStr = localStorage.getItem("flexio_user")
      if (!userStr) throw new Error("User not found")
      
      const user = JSON.parse(userStr)
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          gymId: memberData.gymId,
          location: location,
          distanceFromGym: distanceFromGym,
        }),
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        toast({
          title: "Check-in Successful! 🎉",
          description: `You've earned ${result.coinsEarned} coins!`,
        })
        
        // Update member data
        setMemberData(prev => ({
          ...prev,
          coins: prev.coins + result.coinsEarned,
          streak: result.newStreak,
        }))
        
        // Reset check-in trigger
        locationTrackingService.resetCheckInTrigger()
        
        // Redirect to dashboard after successful check-in
        setTimeout(() => {
          window.location.href = '/member/dashboard'
        }, 2000)
      } else {
        throw new Error(result.error || 'Check-in failed')
      }
    } catch (error) {
      console.error('Check-in error:', error)
      
      // Provide user-friendly error messages based on error type
      let errorMessage = "Please try again."
      let errorTitle = "Check-in Failed"
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase()
        
        if (message.includes('minimum presence requirement') || 
            message.includes('geofence') || 
            message.includes('location') ||
            message.includes('distance')) {
          errorTitle = "Location Check Failed"
          errorMessage = "Are you sure you are in the Gym? Please make sure you're within the gym premises and try again."
        } else if (message.includes('access') || message.includes('membership')) {
          errorMessage = "Please check your membership status or contact the gym owner."
        } else {
          errorMessage = error.message
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsCheckingIn(false)
    }
  }

  const handleAutoCheckIn = async () => {
    await handleCheckIn()
  }

  const formatTime = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / 60000)
    const seconds = Math.floor((milliseconds % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Access denied screen
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-800/90 border-gray-700">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <CardTitle className="text-xl font-bold text-white">
              Check-in Access Restricted
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-400">
                You are member #{accessDenied.memberPosition} ({accessDenied.memberType} member)
              </p>
              <p className="text-sm text-gray-300">
                {accessDenied.reason}
              </p>
            </div>
            
            {accessDenied.memberType === 'paid' && (
              <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
                <h4 className="font-medium text-blue-300 mb-2">What does this mean?</h4>
                <ul className="text-sm text-blue-200 space-y-1">
                  <li>• Your gym owner needs to recharge their wallet</li>
                  <li>• This ensures your membership fees are covered</li>
                  <li>• The first 5 members are always free</li>
                  <li>• Paid members require ₹10/month wallet balance</li>
                </ul>
              </div>
            )}

            {accessDenied.gymOwner && (
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <h4 className="font-medium text-white mb-2">Contact Your Gym</h4>
                <p className="text-sm text-gray-300">
                  Gym: {accessDenied.gymOwner.name}
                </p>
                {accessDenied.gymOwner.phone && (
                  <p className="text-sm text-gray-300">
                    Phone: {accessDenied.gymOwner.phone}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={() => window.location.reload()} 
                className="flex-1"
                variant="outline"
              >
                Retry Access
              </Button>
              <Link href="/member/dashboard" className="flex-1">
                <Button className="w-full">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Zap className="h-6 w-6 text-white animate-pulse" />
          </div>
          <p className="text-white text-lg font-medium">Preparing Check-in...</p>
          <p className="text-gray-400 text-sm mt-2">Getting your location and gym details</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-red-600 via-red-500 to-red-600 shadow-2xl border-b border-red-400/20">
        <div className="max-w-md mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/member/dashboard" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                <ArrowLeft className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Check In</h1>
                <p className="text-xs text-red-100/80">{memberData.gymName}</p>
              </div>
            </Link>
            
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-white">
                  {memberData.name || 'Member'}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs px-2 py-0.5">
                    {memberData.coins} coins
                  </Badge>
                  <Badge variant="secondary" className="bg-orange-500/20 text-orange-200 border-0 text-xs px-2 py-0.5">
                    {memberData.streak} streak
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-6 py-8 space-y-6">
        {/* Location Status Card */}
        <Card className="bg-gray-800/90 border-gray-700/50 backdrop-blur-xl shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-white">
              <MapPin className="h-5 w-5 text-red-400" />
              <span>Location Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Location Status */}
            <div className="p-4 bg-gradient-to-r from-gray-700/50 to-gray-800/50 rounded-xl border border-gray-600/30">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-4 h-4 rounded-full ${
                  locationStatus === 'inside' ? 'bg-green-400 shadow-lg shadow-green-400/50 animate-pulse' :
                  locationStatus === 'outside' ? 'bg-red-400 shadow-lg shadow-red-400/50' :
                  locationStatus === 'checking' ? 'bg-yellow-400 shadow-lg shadow-yellow-400/50 animate-pulse' :
                  'bg-gray-400'
                }`} />
                <span className="text-sm font-medium text-white">
                  {location ? (
                    distanceFromGym !== null ? (
                      distanceFromGym <= 15 ? (
                        <span className="text-green-300">Inside gym area ({distanceFromGym.toFixed(1)}m)</span>
                      ) : (
                        <span className="text-red-300">Outside gym area ({distanceFromGym.toFixed(1)}m away)</span>
                      )
                    ) : (
                      <span className="text-yellow-300">Calculating distance...</span>
                    )
                  ) : (
                    <span className="text-gray-300">Getting location...</span>
                  )}
                </span>
              </div>
              
              {/* Continuous Presence Timer */}
              {trackingActive && (
                <div className="flex items-center gap-2 text-sm">
                  <Timer className="h-4 w-4 text-blue-400" />
                  <span className="text-blue-300">
                    Continuous presence: {formatTime(continuousPresenceTime)}
                  </span>
                </div>
              )}
            </div>

            {/* Requirements Status */}
            <div className="p-4 bg-gradient-to-r from-gray-700/30 to-gray-800/30 rounded-xl border border-gray-600/20">
              <h4 className="font-semibold mb-3 text-sm text-white flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-400" />
                Check-in Requirements
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  {validationStatus.withinRadius ? 
                    <CheckCircle className="h-4 w-4 text-green-400" /> : 
                    <AlertCircle className="h-4 w-4 text-red-400" />
                  }
                  <span className={`font-medium ${
                    validationStatus.withinRadius ? 'text-green-300' : 'text-red-300'
                  }`}>
                    Within 15m radius
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {validationStatus.hasRequiredPresence ? 
                    <CheckCircle className="h-4 w-4 text-green-400" /> : 
                    <Clock className="h-4 w-4 text-yellow-400" />
                  }
                  <span className={`font-medium ${
                    validationStatus.hasRequiredPresence ? 'text-green-300' : 'text-yellow-300'
                  }`}>
                    20 minutes continuous presence
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Check-in Button */}
        <Card className="bg-gray-800/90 border-gray-700/50 backdrop-blur-xl shadow-2xl">
          <CardContent className="p-6">
            <Button
              onClick={handleCheckIn}
              disabled={isCheckingIn}
              className={`w-full h-16 text-lg font-bold rounded-2xl transition-all duration-300 ${
                validationStatus.canCheckIn 
                  ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg shadow-green-600/30 hover:shadow-green-600/50' 
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-600/30'
              }`}
            >
              {isCheckingIn ? (
                <>
                  <Clock className="mr-3 h-6 w-6 animate-spin" />
                  Processing Check-in...
                </>
              ) : validationStatus.canCheckIn ? (
                <>
                  <CheckCircle className="mr-3 h-6 w-6" />
                  Check In Now
                </>
              ) : (
                <>
                  <Navigation className="mr-3 h-6 w-6" />
                  Get Closer to Check In
                </>
              )}
            </Button>
            
            {/* Help Text */}
            <div className="mt-4 text-center">
              {!validationStatus.withinRadius && (
                <p className="text-sm text-gray-400">
                  Move within 15 meters of the gym to enable check-in
                </p>
              )}
              {validationStatus.withinRadius && !validationStatus.hasRequiredPresence && (
                <p className="text-sm text-gray-400">
                  Stay in the gym area for {Math.ceil((20 * 60 * 1000 - continuousPresenceTime) / 60000)} more minutes
                </p>
              )}
              {validationStatus.canCheckIn && (
                <p className="text-sm text-green-400">
                  ✓ All requirements met! You can check in now
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-500/20 backdrop-blur-xl shadow-xl">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-orange-500/30">
                <Award className="h-5 w-5 text-white" />
              </div>
              <div className="text-2xl font-bold text-white mb-1">{memberData.streak}</div>
              <div className="text-xs text-gray-400 font-medium">Day Streak</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border-yellow-500/20 backdrop-blur-xl shadow-xl">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-yellow-500/30">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div className="text-2xl font-bold text-white mb-1">{memberData.coins}</div>
              <div className="text-xs text-gray-400 font-medium">Total Coins</div>
            </CardContent>
          </Card>
        </div>

        {/* Error Display */}
        {locationError && (
          <Card className="bg-red-500/10 border-red-500/20 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-red-300 font-medium">Location Error</p>
                  <p className="text-red-200 text-sm">{locationError}</p>
                  <p className="text-red-200 text-xs mt-1">
                    Please enable location services and refresh the page
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/98 backdrop-blur-xl border-t border-gray-800/50 shadow-2xl">
        <div className="max-w-md mx-auto px-6 py-4">
          <div className="flex justify-center">
            <Link
              href="/member/dashboard"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200"
            >
              <Home className="h-5 w-5" />
              <span className="text-sm font-medium">Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}