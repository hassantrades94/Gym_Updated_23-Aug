"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Users,
  TrendingUp,
  MessageSquare,
  Search,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Trophy,
  Medal,
  Award,
  UserPlus,
  Zap,
  LogOut,
  Home,
  Settings,
  CreditCard,
  IndianRupee,
  Plus,
  Check,
  MapPin,
  Coins,
  Wallet,
  Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"

type GymPlan = {
  id: string
  name: string
  price: number
  duration: string
  features: string[]
  active: boolean
}

export default function GymOwnerDashboard() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    const checkUserRole = () => {
      const userData = localStorage.getItem("flexio_user")
      if (!userData) {
        toast({
          title: "Access Denied",
          description: "Please sign in to access the gym owner dashboard.",
          variant: "destructive",
        })
        setTimeout(() => {
          window.location.href = "/auth/signin"
        }, 2000)
        return
      }

      const user = JSON.parse(userData)
      const role = user.userType || (user.user_type === "gym_owner" ? "owner" : user.user_type)
      if (role !== "owner") {
        toast({
          title: "Access Denied",
          description: "This is the gym owner dashboard. Members should use the member dashboard.",
          variant: "destructive",
        })
        setTimeout(() => {
          window.location.href = role === "member" ? "/member/dashboard" : "/auth/signin"
        }, 2000)
        return
      }
    }

    checkUserRole()
  }, [toast])

  const [selectedFilter, setSelectedFilter] = useState("all")
  const [isEditingCoinValue, setIsEditingCoinValue] = useState(false)
  const [isEditingLocation, setIsEditingLocation] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [tempCoinValue, setTempCoinValue] = useState("")
  const [isAddingPlan, setIsAddingPlan] = useState(false)
  // Add new states for edit/delete
  const [isEditingPlan, setIsEditingPlan] = useState(false)
  const [editingPlan, setEditingPlan] = useState<GymPlan | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [planToDelete, setPlanToDelete] = useState<string | null>(null)
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [editingMember, setEditingMember] = useState<any>(null)
  const [bonusCoinsInput, setBonusCoinsInput] = useState<{ [key: number]: string }>({})
  const [activeTab, setActiveTab] = useState("overview")
  const [coinValue, setCoinValue] = useState(4.0)
  const [gymId, setGymId] = useState<string | null>(null)
  const [isPlanSaving, setIsPlanSaving] = useState(false)

  const [coinModalOpen, setCoinModalOpen] = useState(false)
  const [selectedMemberForCoins, setSelectedMemberForCoins] = useState<any>(null)
  const [coinAmount, setCoinAmount] = useState("")

  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [selectedMemberForPayment, setSelectedMemberForPayment] = useState<any>(null)
  const [paymentData, setPaymentData] = useState({
    status: "",
    planEndDate: "",
    newPlan: "",
    paymentMode: "",
  })

  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState("")

  // Additional state for live data
  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number; members: number }[]>([])
  const [recentPayments, setRecentPayments] = useState<any[]>([])
  const [revenueBreakdown, setRevenueBreakdown] = useState<{ planName: string; revenue: number; growth: number }[]>([])

  // Helper: safe growth calculation
  const safeCalculateGrowth = (current: number, previous: number): number => {
    if (!previous || previous === 0) return current > 0 ? 100 : 0
    const growth = ((current - previous) / previous) * 100
    const val = Math.round(growth * 10) / 10
    return isFinite(val) && !isNaN(val) ? val : 0
  }

  // Helper: safe revenue format in Lakhs
  const safeFormatRevenueL = (revenue: number): string => {
    const r = Number(revenue) || 0
    const out = (r / 100000).toFixed(1)
    return isFinite(Number(out)) ? out : "0.0"
  }

  // Helper: safe growth format with sign
  const safeFormatGrowth = (growth: number): string => {
    const g = Number(growth)
    if (!isFinite(g) || isNaN(g)) return "0"
    return g > 0 ? `+${g}` : `${g}`
  }

  // Updated gymData state - removing mock values
  const [gymData, setGymData] = useState({
    totalMembers: 0,
    activeMembers: 0,
    monthlyRevenue: 0,
    revenueGrowth: 0,
    pendingPayments: 0,
    coinValue: 4.0,
    location: { lat: 40.7128, lng: -74.006 },
    ownerName: "",
    gymName: "",
    gymCode: "",
    newMembersThisMonth: 0,
    walletBalance: 0,
    freeMembersUsed: 0,
    totalFreeMembers: 5,
    subscriptionStatus: "active",
    nextBillingDate: "",
    monthlyChargePerMember: 15,
  })

  const [gymPlans, setGymPlans] = useState<GymPlan[]>([
    {
      id: "1",
      name: "Basic",
      price: 2400, // INR
      duration: "monthly",
      features: ["Equipment access", "Locker room", "Basic support"],
      active: true,
    },
    {
      id: "2",
      name: "Standard",
      price: 4000, // INR
      duration: "monthly",
      features: ["Everything in Basic", "Group classes", "Nutrition tracking", "Priority support"],
      active: true,
    },
    {
      id: "3",
      name: "Premium",
      price: 7200, // INR
      duration: "monthly",
      features: ["Everything in Standard", "Personal training", "Advanced analytics", "24/7 access"],
      active: true,
    },
  ])

  const [newPlan, setNewPlan] = useState({
    name: "",
    price: "",
    duration: "monthly",
    features: "",
  })

  const [newMember, setNewMember] = useState({
    name: "",
    phone: "",
    plan: "",
  })

  // Load live data from Supabase
  useEffect(() => {
    const user = getCurrentUser()
    if (!user) return

    const load = async () => {
      try {
        // Fetch owner details
        const { data: ownerData, error: ownerError } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", user.id)
          .single()
        if (ownerError) throw ownerError

        // Fetch gym owned by current user
        const { data: gym, error: gErr } = await supabase
          .from("gyms")
          .select("id, gym_name, gym_code, coin_value, subscription_status, free_member_count")
          .eq("owner_id", user.id)
          .single()
        if (gErr) throw gErr

        setGymId(gym.id)
        const coinVal = Number(gym.coin_value || 4)
        setCoinValue(coinVal)
        setGymData((prev) => ({
          ...prev,
          ownerName: ownerData?.full_name || "Gym Owner",
          gymName: gym.gym_name,
          gymCode: gym.gym_code,
          coinValue: coinVal,
          subscriptionStatus: gym.subscription_status,
          freeMembersUsed: Number(gym.free_member_count || 0),
        }))

        // Wallet info
        const { data: wallet } = await supabase
          .from("gym_wallets")
          .select("balance_inr, last_billing_date")
          .eq("gym_id", gym.id)
          .single()
        if (wallet) {
          setGymData((prev) => ({
            ...prev,
            walletBalance: Number(wallet.balance_inr || 0),
            nextBillingDate: wallet.last_billing_date || prev.nextBillingDate,
          }))
        }

        // Active gym plans
        const { data: plans } = await supabase
          .from("gym_plans")
          .select("id, plan_name, price_inr, duration_months, is_active")
          .eq("gym_id", gym.id)
          .eq("is_active", true)
          .order("price_inr", { ascending: true })
        setGymPlans(
          (plans || []).map((p) => ({
            id: p.id,
            name: p.plan_name,
            price: Number(p.price_inr),
            duration: p.duration_months === 1 ? "monthly" : `${p.duration_months} months`,
            features: [],
            active: p.is_active,
          }))
        )

        // Memberships summary and members list
        const { data: mems } = await supabase
          .from("memberships")
          .select("id, is_active, payment_status, start_date, expiry_date, user_id")
          .eq("gym_id", gym.id)
        const totalMembers = mems?.length || 0
        const activeMembers = (mems || []).filter((m) => m.is_active).length
        const pendingPayments = (mems || []).filter((m) => m.payment_status !== "paid").length
        setGymData((prev) => ({ ...prev, totalMembers, activeMembers, pendingPayments }))

        // Compute revenue growth and monthly revenue
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

        // Current month revenue
        const { data: currentPayments } = await supabase
          .from("payments")
          .select("amount_inr")
          .eq("gym_id", gym.id)
          .eq("payment_status", "completed")
          .gte("payment_date", monthStart.toISOString())

        // Last month revenue
        const { data: lastMonthPayments } = await supabase
          .from("payments")
          .select("amount_inr")
          .eq("gym_id", gym.id)
          .eq("payment_status", "completed")
          .gte("payment_date", lastMonthStart.toISOString())
          .lt("payment_date", monthStart.toISOString())

        const currentRevenue = (currentPayments || []).reduce((s, p) => s + Number(p.amount_inr || 0), 0)
        const lastRevenue = (lastMonthPayments || []).reduce((s, p) => s + Number(p.amount_inr || 0), 0)
        const growthPct = safeCalculateGrowth(currentRevenue, lastRevenue)

        // New members this month
        const { data: newMembers } = await supabase
          .from("memberships")
          .select("id")
          .eq("gym_id", gym.id)
          .gte("start_date", monthStart.toISOString().split("T")[0])

        setGymData((prev) => ({
          ...prev,
          monthlyRevenue: currentRevenue || 0,
          revenueGrowth: growthPct,
          newMembersThisMonth: newMembers?.length || 0,
        }))

        // Revenue history for last 5 months
        const months: { month: string; revenue: number; members: number }[] = []
        for (let i = 4; i >= 0; i--) {
          const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)

          const { data: revPays } = await supabase
            .from("payments")
            .select("amount_inr")
            .eq("gym_id", gym.id)
            .eq("payment_status", "completed")
            .gte("payment_date", start.toISOString())
            .lt("payment_date", end.toISOString())

          const { data: memberCount } = await supabase
            .from("memberships")
            .select("id")
            .eq("gym_id", gym.id)
            .lte("start_date", end.toISOString().split("T")[0])
            .gte("expiry_date", start.toISOString().split("T")[0])

          const revenue = (revPays || []).reduce((s, p) => s + Number(p.amount_inr || 0), 0)
          const monthName = start.toLocaleDateString("en-US", { month: "short" })
          months.push({ month: monthName, revenue, members: memberCount?.length || 0 })
        }
        setRevenueData(months)

        // Revenue breakdown by plan (current month vs last month)
        const { data: planRevenue } = await supabase
          .from("payments")
          .select(`
            amount_inr,
            payment_date,
            memberships!inner(
              gym_plans!inner(plan_name)
            )
          `)
          .eq("gym_id", gym.id)
          .eq("payment_status", "completed")
          .gte("payment_date", monthStart.toISOString())

        const { data: lastPlanRevenue } = await supabase
          .from("payments")
          .select(`
            amount_inr,
            memberships!inner(
              gym_plans!inner(plan_name)
            )
          `)
          .eq("gym_id", gym.id)
          .eq("payment_status", "completed")
          .gte("payment_date", lastMonthStart.toISOString())
          .lt("payment_date", monthStart.toISOString())

        const currentByPlan: Record<string, number> = {}
        const lastByPlan: Record<string, number> = {}

        ;(planRevenue || []).forEach((p: any) => {
          const plan = p.memberships?.gym_plans?.plan_name || "Other"
          currentByPlan[plan] = (currentByPlan[plan] || 0) + Number(p.amount_inr || 0)
        })
        ;(lastPlanRevenue || []).forEach((p: any) => {
          const plan = p.memberships?.gym_plans?.plan_name || "Other"
          lastByPlan[plan] = (lastByPlan[plan] || 0) + Number(p.amount_inr || 0)
        })

        const breakdown = Object.keys(currentByPlan).map((planName) => {
          const curr = currentByPlan[planName] || 0
          const prev = lastByPlan[planName] || 0
          const g = prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0
          return { planName, revenue: curr, growth: g }
        })
        setRevenueBreakdown(breakdown)

        // Recent payments for "Online Payments"
        const { data: recent } = await supabase
          .from("payments")
          .select(`
            amount_inr,
            payment_date,
            payment_method,
            users!inner(full_name),
            memberships!inner(
              expiry_date,
              gym_plans!inner(plan_name)
            )
          `)
          .eq("gym_id", gym.id)
          .eq("payment_status", "completed")
          .order("payment_date", { ascending: false })
          .limit(5)

        setRecentPayments(recent || [])

        // Members list with joined user and plan data
        const { data: memberRows } = await supabase
          .from("memberships")
          .select(
            `id, user_id, start_date, expiry_date, payment_status, is_active,
             users ( full_name, phone_number, profile_picture_url ),
             gym_plans ( plan_name, duration_months, price_inr )`
          )
          .eq("gym_id", gym.id)

        const userIds = (memberRows || []).map((m: any) => m.user_id)

        // Aggregate coin balances per user
        let coinMap: Record<string, number> = {}
        if (userIds.length > 0) {
          const { data: coinTx } = await supabase
            .from("coin_transactions")
            .select("user_id, amount, transaction_type")
            .in("user_id", userIds)
            .eq("gym_id", gym.id)
          for (const tx of coinTx || []) {
            const delta = tx.transaction_type === "spent" ? -Number(tx.amount) : Number(tx.amount)
            coinMap[tx.user_id] = (coinMap[tx.user_id] || 0) + delta
          }
        }

        // Last visit per user
        let lastVisitMap: Record<string, string> = {}
        if (userIds.length > 0) {
          const { data: visits } = await supabase
            .from("check_ins")
            .select("user_id, check_in_time")
            .in("user_id", userIds)
            .eq("gym_id", gym.id)
            .order("check_in_time", { ascending: false })
          for (const v of visits || []) {
            if (!lastVisitMap[v.user_id]) lastVisitMap[v.user_id] = v.check_in_time
          }
        }

        setMembers(
          (memberRows || []).map((m: any) => ({
            id: m.user_id,
            membershipId: m.id, // Add membershipId for updates
            name: m.users?.full_name || "Member",
            email: "",
            phone: m.users?.phone_number || "",
            plan: m.gym_plans?.plan_name || "-",
            status: m.is_active ? "active" : "expired",
            lastVisit: lastVisitMap[m.user_id] || "",
            joinDate: m.start_date,
            planEndDate: m.expiry_date,
            paymentStatus: m.payment_status === "paid" ? "paid" : m.payment_status || "pending",
            totalVisits: 0,
            weeklyVisits: 0,
            currentStreak: 0,
            totalCoins: coinMap[m.user_id] || 0,
            avatar: "/placeholder.svg?height=40&width=40",
            profilePicture: m.users?.profile_picture_url || null,
          }))
        )
      } catch (e: any) {
        console.error(e)
        toast({ title: "Failed to load gym data", description: e.message || "", variant: "destructive" })
      }
    }

    load()
  }, [])

  const getDaysUntilExpiration = (status: string, joinDate: string): number => {
    if (status !== "expiring") return 0

    // Use deterministic calculation based on join date instead of random
    const join = new Date(joinDate)
    const now = new Date()
    const monthsActive = Math.floor((now.getTime() - join.getTime()) / (1000 * 60 * 60 * 24 * 30))

    // Simulate different expiration scenarios deterministically
    if (monthsActive % 3 === 0) return 3 // Expiring in 3 days
    if (monthsActive % 7 === 0) return 7 // Expiring in 7 days
    // Use modulo for deterministic "random" value based on join date
    return (monthsActive % 10) + 1 // Deterministic 1-10 days based on join date
  }

  const [members, setMembers] = useState([
    {
      id: 1,
      name: "Alex Johnson",
      email: "alex@example.com",
      phone: "+91 98765 43210",
      plan: "Standard",
      status: "active",
      lastVisit: "2024-01-10",
      joinDate: "2023-06-15",
      planEndDate: "2024-06-15", // Added plan end date
      paymentStatus: "paid", // Added payment status
      totalVisits: 89,
      weeklyVisits: 5,
      currentStreak: 12,
      totalCoins: 1450,
      avatar: "/placeholder.svg?height=40&width=40",
      profilePicture: null, // Will contain uploaded profile picture URL
    },
    {
      id: 2,
      name: "Sarah Chen",
      email: "sarah@example.com",
      phone: "+91 98765 43211",
      plan: "Premium",
      status: "expiring",
      lastVisit: "2024-01-09",
      joinDate: "2023-03-20",
      planEndDate: "2024-01-15", // Added plan end date
      paymentStatus: "pending", // Added payment status
      totalVisits: 156,
      weeklyVisits: 6,
      currentStreak: 8,
      totalCoins: 2340,
      avatar: "/placeholder.svg?height=40&width=40",
      profilePicture: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face", // Sample profile picture
    },
    {
      id: 3,
      name: "Mike Rodriguez",
      email: "mike@example.com",
      phone: "+91 98765 43212",
      plan: "Basic",
      status: "expired",
      lastVisit: "2023-12-28",
      joinDate: "2023-01-10",
      planEndDate: "2023-12-31", // Added plan end date
      paymentStatus: "overdue", // Added payment status
      totalVisits: 45,
      weeklyVisits: 2,
      currentStreak: 0,
      totalCoins: 680,
      avatar: "/placeholder.svg?height=40&width=40",
      profilePicture: null,
    },
    {
      id: 4,
      name: "Emma Wilson",
      email: "emma@example.com",
      phone: "+91 98765 43213",
      plan: "Standard",
      status: "active",
      lastVisit: "2024-01-11",
      joinDate: "2023-08-05",
      planEndDate: "2024-08-05", // Added plan end date
      paymentStatus: "paid", // Added payment status
      totalVisits: 67,
      weeklyVisits: 4,
      currentStreak: 15,
      totalCoins: 1120,
      avatar: "/placeholder.svg?height=40&width=40",
      profilePicture: null,
    },
    {
      id: 5,
      name: "David Kumar",
      email: "david@example.com",
      phone: "+91 98765 43214",
      plan: "Premium",
      status: "active",
      lastVisit: "2024-01-11",
      joinDate: "2023-04-12",
      planEndDate: "2024-04-12", // Added plan end date
      paymentStatus: "paid", // Added payment status
      totalVisits: 134,
      weeklyVisits: 7,
      currentStreak: 22,
      totalCoins: 2890,
      avatar: "/placeholder.svg?height=40&width=40",
      profilePicture: null,
    },
  ])


  const gymSettings = {
    coinValue: 4.0,
  }

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.phone.toLowerCase().includes(searchTerm.toLowerCase())

    let matchesFilter = false
    if (selectedFilter === "all") {
      matchesFilter = true
    } else if (selectedFilter === "expiring-3") {
      const daysUntilExpiration = getDaysUntilExpiration(member.status, member.joinDate)
      matchesFilter = member.status === "expiring" && daysUntilExpiration <= 3
    } else if (selectedFilter === "expiring-7") {
      const daysUntilExpiration = getDaysUntilExpiration(member.status, member.joinDate)
      matchesFilter = member.status === "expiring" && daysUntilExpiration <= 7
    } else if (selectedFilter === "expiring") {
      matchesFilter = member.status === "expiring"
    } else {
      matchesFilter = member.status === selectedFilter
    }

    return matchesSearch && matchesFilter
  })

  const leaderboard = [...members]
    .filter((member) => member.status === "active")
    .sort((a, b) => {
      // Sort by current streak first, then by weekly visits, then by total visits
      if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak
      if (b.weeklyVisits !== a.weeklyVisits) return b.weeklyVisits - a.weeklyVisits
      return b.totalVisits - a.totalVisits
    })
    .slice(0, 5)

  const copyGymCode = () => {
    navigator.clipboard.writeText(gymData.gymCode)
    toast({
      title: "Gym code copied!",
      description: "Share this code with new members to join your gym.",
    })
  }

  const handleCoinValueEdit = () => {
    setTempCoinValue(gymData.coinValue.toString())
    setIsEditingCoinValue(true)
  }

  const saveCoinValue = async () => {
    const newValue = Number.parseFloat(tempCoinValue)
    if (isNaN(newValue) || newValue <= 0) {
      toast({
        title: "Invalid coin value",
        description: "Please enter a valid positive number.",
        variant: "destructive",
      })
      return
    }

    try {
      const { error } = await supabase
        .from("gyms")
        .update({ coin_value: newValue })
        .eq("id", gymId)
      
      if (error) throw error

      setCoinValue(newValue)
      setGymData((prev) => ({ ...prev, coinValue: newValue }))
      setIsEditingCoinValue(false)
      toast({
        title: "Coin value updated!",
        description: `1 coin is now worth ₹${newValue.toFixed(2)}`,
      })
    } catch (error: any) {
      toast({
        title: "Failed to update coin value",
        description: error.message || "Please try again",
        variant: "destructive",
      })
    }
  }

  const cancelCoinValueEdit = () => {
    setIsEditingCoinValue(false)
    setTempCoinValue("")
  }

  const updateGymLocation = async () => {
    setIsGettingLocation(true)

    if (!gymId) {
      setIsGettingLocation(false)
      toast({ title: "Gym not loaded", description: "Please wait and try again.", variant: "destructive" })
      return
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const lat = position.coords.latitude
            const lng = position.coords.longitude

            const { error } = await supabase
              .from("gyms")
              .update({ location_latitude: lat, location_longitude: lng })
              .eq("id", gymId)
            if (error) throw error

            setGymData((prev) => ({
              ...prev,
              location: { lat, lng },
            }))
            setIsGettingLocation(false)
            setIsEditingLocation(false)
            toast({
              title: "Location updated!",
              description: "Your gym location has been updated successfully.",
            })
          } catch (err: any) {
            setIsGettingLocation(false)
            toast({ title: "Failed to update location", description: err.message || "", variant: "destructive" })
          }
        },
        (error) => {
          setIsGettingLocation(false)
          toast({
            title: "Location access denied",
            description: "Unable to get your current location.",
            variant: "destructive",
          })
        },
      )
    } else {
      setIsGettingLocation(false)
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation.",
        variant: "destructive",
      })
    }
  }

  const addGymPlan = async () => {
    if (!newPlan.name || !newPlan.price || !newPlan.features) {
      toast({
        title: "Missing information",
        description: "Please fill in all plan details.",
        variant: "destructive",
      })
      return
    }

    if (!gymId) {
      toast({
        title: "Error",
        description: "Gym ID not found. Please refresh the page.",
        variant: "destructive",
      })
      return
    }

    setIsPlanSaving(true)
    try {
      // Map duration string to months
      const durationMonthsMap: Record<string, number> = {
        monthly: 1,
        quarterly: 3,
        "6 months": 6,
        yearly: 12,
      }

      const durationMonths = durationMonthsMap[newPlan.duration] || 1

      if (isEditingPlan && editingPlan) {
        const { error } = await supabase
          .from("gym_plans")
          .update({
            plan_name: newPlan.name,
            price_inr: Number.parseInt(newPlan.price),
            duration_months: durationMonths,
          })
          .eq("id", editingPlan.id)
          .eq("gym_id", gymId)

        if (error) throw error

        const updatedPlan = {
          id: editingPlan.id,
          name: newPlan.name,
          price: Number.parseInt(newPlan.price),
          duration: newPlan.duration,
          features: newPlan.features.split(",").map((f) => f.trim()).filter((f) => f),
          active: editingPlan.active,
        }

        setGymPlans((prev) => prev.map((p) => (p.id === editingPlan.id ? updatedPlan : p)))
        toast({ title: "Plan updated!", description: `${updatedPlan.name} plan has been updated successfully.` })
      } else {
        const { data: insertedPlan, error } = await supabase
          .from("gym_plans")
          .insert({
            gym_id: gymId,
            plan_name: newPlan.name,
            price_inr: Number.parseInt(newPlan.price),
            duration_months: durationMonths,
            is_active: true,
          })
          .select()
          .single()

        if (error) throw error

        const plan = {
          id: insertedPlan.id,
          name: newPlan.name,
          price: Number.parseInt(newPlan.price),
          duration: newPlan.duration,
          features: newPlan.features.split(",").map((f) => f.trim()).filter((f) => f),
          active: true,
        }

        setGymPlans((prev) => [...prev, plan])
        toast({ title: "Plan added!", description: `${plan.name} plan has been created successfully.` })
      }

      setNewPlan({ name: "", price: "", duration: "monthly", features: "" })
      setIsAddingPlan(false)
      setIsEditingPlan(false)
      setEditingPlan(null)
    } catch (err: any) {
      toast({
        title: isEditingPlan ? "Failed to update plan" : "Failed to add plan",
        description: err.message || "An error occurred while saving the plan.",
        variant: "destructive",
      })
    } finally {
      setIsPlanSaving(false)
    }
  }

  const togglePlanStatus = async (planId: string) => {
    if (!gymId) {
      toast({
        title: "Error",
        description: "Gym ID not found. Please refresh the page.",
        variant: "destructive",
      })
      return
    }

    try {
      // Find current plan status
      const currentPlan = gymPlans.find(p => p.id === planId)
      if (!currentPlan) return

      const newStatus = !currentPlan.active

      // Update in Supabase
      const { error } = await supabase
        .from("gym_plans")
        .update({ is_active: newStatus })
        .eq("id", planId)
        .eq("gym_id", gymId)

      if (error) {
        throw error
      }

      // Update local state
      setGymPlans((prev) => prev.map((plan) => (plan.id === planId ? { ...plan, active: newStatus } : plan)))
      toast({
        title: "Plan updated!",
        description: "Plan status has been changed.",
      })
    } catch (err: any) {
      toast({
        title: "Failed to update plan",
        description: err.message || "An error occurred while updating the plan.",
        variant: "destructive",
      })
    }
  }

  const startEditPlan = (plan: GymPlan) => {
    setEditingPlan(plan)
    setNewPlan({
      name: plan.name,
      price: plan.price.toString(),
      duration: plan.duration,
      features: plan.features.join(", "),
    })
    setIsEditingPlan(true)
    setIsAddingPlan(true)
  }

  const confirmDeletePlan = (planId: string) => {
    setPlanToDelete(planId)
    setDeleteConfirmOpen(true)
  }

  const deletePlan = async () => {
    if (!gymId || !planToDelete) {
      toast({ title: "Error", description: "Plan ID or Gym ID not found.", variant: "destructive" })
      return
    }
    try {
      const { error } = await supabase.from("gym_plans").delete().eq("id", planToDelete).eq("gym_id", gymId)
      if (error) throw error
      setGymPlans((prev) => prev.filter((p) => p.id !== planToDelete))
      toast({ title: "Plan deleted!", description: "The plan has been removed." })
    } catch (err: any) {
      toast({
        title: "Failed to delete plan",
        description: err.message || "An error occurred while deleting the plan.",
        variant: "destructive",
      })
    } finally {
      setDeleteConfirmOpen(false)
      setPlanToDelete(null)
    }
  }

  const addMember = async () => {
    if (!newMember.name || !newMember.phone || !newMember.plan) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields (name, phone, plan).",
        variant: "destructive",
      })
      return
    }

    // Phone number validation
    const phoneRegex = /^[6-9]\d{9}$/
    if (!phoneRegex.test(newMember.phone)) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid 10-digit Indian mobile number.",
        variant: "destructive",
      })
      return
    }

    if (!gymId || !gymData?.gymCode) {
      toast({ title: "Error", description: "Gym info missing.", variant: "destructive" })
      return
    }

    try {
      // Find selected plan id
      const selectedPlan = gymPlans.find((p) => p.name === newMember.plan)
      if (!selectedPlan) {
        toast({ title: "Plan not found", description: "Please select a valid plan.", variant: "destructive" })
        return
      }

      // Call signup API to create member user and base membership
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: newMember.phone,
          password: "123456",
          fullName: newMember.name,
          userType: "member",
          gymCode: gymData.gymCode,
        }),
      })

      let json: any
      const ct = res.headers.get("content-type") || ""
      if (ct.includes("application/json")) {
        json = await res.json()
      } else {
        const text = await res.text()
        try {
          json = JSON.parse(text)
        } catch {
          json = { error: text || "Server returned a non-JSON response" }
        }
      }

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create member")
      }

      const newUserId = json.user.id

      // Update membership with the selected plan_id and dates
      const startDate = new Date()
      let months = 1
      if (typeof selectedPlan.duration === "string") {
        const match = selectedPlan.duration.match(/(\d+)\s*months?/i)
        if (match) {
          months = Number(match[1])
        } else {
          const d = selectedPlan.duration.toLowerCase()
          if (d === "monthly") months = 1
          else if (d === "quarterly") months = 3
          else if (d === "yearly") months = 12
        }
      }
      const end = new Date(startDate)
      end.setMonth(end.getMonth() + months)
      const expiryDate = end.toISOString().split("T")[0]

      // Find membership row for the user
      const { data: membership } = await supabase
        .from("memberships")
        .select("id")
        .eq("user_id", newUserId)
        .eq("gym_id", gymId)
        .single()

      if (membership) {
        await supabase
          .from("memberships")
          .update({ plan_id: selectedPlan.id, start_date: startDate.toISOString().split("T")[0], expiry_date: expiryDate })
          .eq("id", membership.id)
      }

      // Update UI state
      setMembers((prev) => [
        ...prev,
        {
          id: newUserId,
          membershipId: membership?.id,
          name: newMember.name,
          email: "",
          phone: newMember.phone,
          plan: newMember.plan,
          status: "active",
          lastVisit: "",
          joinDate: startDate.toISOString().split("T")[0],
          planEndDate: expiryDate,
          paymentStatus: "pending",
          totalVisits: 0,
          weeklyVisits: 0,
          currentStreak: 0,
          totalCoins: 0,
          avatar: "/placeholder.svg?height=40&width=40",
          profilePicture: null,
        },
      ])

      setNewMember({ name: "", phone: "", plan: "" })
      setIsAddingMember(false)

      toast({
        title: "Member added successfully! 🎉",
        description: `Account created for ${newMember.name}. Default password: 123456. They can login with their phone number.`,
      })
    } catch (err: any) {
      toast({ title: "Failed to add member", description: err.message || "", variant: "destructive" })
    }
  }

  const updateMember = () => {
    if (!editingMember) return

    setMembers((prev) =>
      prev.map((member) => (member.id === editingMember.id ? { ...member, ...editingMember } : member)),
    )
    setEditingMember(null)
    toast({
      title: "Member updated!",
      description: "Member details have been saved.",
    })
  }

  const giveBonusCoins = async (memberId: number, bonusAmount: number) => {
    try {
      if (!gymId) {
        toast({ title: "Missing gym context", description: "Please reload the page and try again.", variant: "destructive" })
        return
      }
      const member = members.find((m) => m.id === memberId)
      if (!member) {
        toast({ title: "Member not found", description: "Unable to award coins to this member.", variant: "destructive" })
        return
      }

      // Insert coin transaction in Supabase
      const { error: coinErr } = await supabase.from("coin_transactions").insert({
        user_id: memberId,
        gym_id: gymId,
        transaction_type: "bonus",
        amount: bonusAmount,
        description: `Bonus coins awarded by gym owner`,
      })
      if (coinErr) throw coinErr

      // Update local state optimistically
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, totalCoins: (m.totalCoins || 0) + bonusAmount } : m)),
      )

      toast({
        title: "Bonus coins awarded!",
        description: `${bonusAmount} coins have been added to the member's account.`,
      })
      // Clear the input after successful update
      setBonusCoinsInput((prev) => ({ ...prev, [memberId]: "" }))
    } catch (err: any) {
      toast({ title: "Failed to add coins", description: err.message || "", variant: "destructive" })
    }
  }

  const handleManualBonusCoins = (memberId: number) => {
    const inputValue = bonusCoinsInput[memberId]
    const bonusAmount = Number.parseInt(inputValue) || 0

    if (bonusAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid number of coins.",
        variant: "destructive",
      })
      return
    }

    giveBonusCoins(memberId, bonusAmount)
  }

  const handleLogout = () => {
    localStorage.removeItem("flexio_user")
    toast({
      title: "Logged out successfully",
      description: "See you next time!",
    })
    setTimeout(() => {
      window.location.href = "/auth/signin"
    }, 1000)
  }

  const getStatusIcon = (status: string, joinDate?: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-3 w-3 text-[rgba(157,230,155,1)]" />
      case "expiring":
        const days = getDaysUntilExpiration(status, joinDate || "")
        return <Clock className="h-3 w-3 text-slate-100" />
      case "expired":
        return <AlertCircle className="h-3 w-3" />
      default:
        return null
    }
  }

  const getLeaderboardIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-5 w-5 text-yellow-500" />
      case 1:
        return <Medal className="h-5 w-5 text-gray-400" />
      case 2:
        return <Award className="h-5 w-5 text-amber-600" />
      default:
        return <span className="text-lg font-bold text-gray-500">#{index + 1}</span>
    }
  }

  const handleGiveBonusCoins = (memberId: number, coins: string) => {
    const coinsNum = Number.parseInt(coins)
    if (coinsNum > 0) {
      // Update member's coins in the state
      setMembers((prev) =>
        prev.map((member) =>
          member.id === memberId ? { ...member, totalCoins: member.totalCoins + coinsNum } : member,
        ),
      )

      toast({
        title: "Coins Added Successfully",
        description: `Added ${coinsNum} coins to member's account`,
      })
      setCoinModalOpen(false)
      setCoinAmount("")
      setSelectedMemberForCoins(null)
    } else {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid number of coins.",
        variant: "destructive",
      })
    }
  }

  const openCoinModal = (member: any) => {
    setSelectedMemberForCoins(member)
    setCoinModalOpen(true)
  }

  const handleGiveBonusCoinsOld = (memberId: number, bonusAmount: string) => {
    const amount = Number.parseInt(bonusAmount, 10)
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid number of coins.",
        variant: "destructive",
      })
      return
    }

    setMembers((prev) =>
      prev.map((member) =>
        member.id === memberId ? { ...member, totalCoins: (member.totalCoins || 0) + amount } : member,
      ),
    )
    toast({
      title: "Bonus coins awarded!",
      description: `${amount} coins have been added to the member's account.`,
    })
    setBonusCoinsInput((prev) => ({ ...prev, [memberId]: "" }))
  }

  const openPaymentModal = (member: any) => {
    setSelectedMemberForPayment(member)
    setPaymentData({
      status: member.paymentStatus,
      planEndDate: member.planEndDate,
      newPlan: member.plan,
      paymentMode: "", // default to placeholder "Select" when opening
    })
    setPaymentModalOpen(true)
  }

  const updatePaymentDetails = async () => {
    if (!selectedMemberForPayment) return

    const oldPlan = selectedMemberForPayment.plan
    const oldEndDate = selectedMemberForPayment.planEndDate
    const selectedPlan = gymPlans.find((p) => p.name === paymentData.newPlan)

    // Calculate new expiration date based on plan duration
      let newEndDate = paymentData.planEndDate
      if (selectedPlan && paymentData.status === "paid") {
        const currentEndDate = new Date(selectedMemberForPayment.planEndDate)
        const today = new Date()
        const startDate = currentEndDate > today ? currentEndDate : today

        // Resolve duration to days (supports "monthly" or "N months")
        let durationInDays = 30
        if (typeof selectedPlan.duration === "string") {
          const match = selectedPlan.duration.match(/(\d+)\s*months?/i)
          if (match) {
            durationInDays = Number(match[1]) * 30
          } else {
            const d = selectedPlan.duration.toLowerCase()
            if (d === "monthly") durationInDays = 30
            else if (d === "quarterly") durationInDays = 90
            else if (d === "yearly") durationInDays = 365
          }
        }

        const calculatedEndDate = new Date(startDate)
        calculatedEndDate.setDate(calculatedEndDate.getDate() + durationInDays)
        newEndDate = calculatedEndDate.toISOString().split("T")[0]
      }

    try {
      if (!gymId) throw new Error("Gym ID not available")

      const membershipUpdates: any = {
        payment_status: paymentData.status,
        payment_mode: paymentData.paymentMode,
        expiry_date: newEndDate,
        updated_at: new Date().toISOString(),
      }
      if (selectedPlan?.id) membershipUpdates.plan_id = selectedPlan.id

      const { error: memErr } = await supabase
        .from("memberships")
        .update(membershipUpdates)
        .eq("id", selectedMemberForPayment.membershipId)
        .eq("gym_id", gymId)
      if (memErr) throw memErr

      if (paymentData.status === "paid" && selectedPlan) {
        const { error: payErr } = await supabase.from("payments").insert({
          user_id: selectedMemberForPayment.id,
          gym_id: gymId,
          membership_id: selectedMemberForPayment.membershipId,
          amount_inr: Number(selectedPlan.price) || 0,
          payment_method: paymentData.paymentMode,
          payment_status: "completed",
          payment_date: new Date().toISOString(),
        })
        if (payErr) throw payErr
      }

      setMembers((prev) =>
        prev.map((member) =>
          member.id === selectedMemberForPayment.id
            ? {
                ...member,
                paymentStatus: paymentData.status,
                planEndDate: newEndDate,
                plan: paymentData.newPlan,
                paymentMode: paymentData.paymentMode,
                status:
                  paymentData.status === "paid"
                    ? "active"
                    : paymentData.status === "overdue"
                      ? "expired"
                      : member.status,
              }
            : member,
        ),
      )

      const newPrice = (gymPlans.find((p) => p.name === paymentData.newPlan)?.price ?? 0)
      const oldPrice = (gymPlans.find((p) => p.name === oldPlan)?.price ?? 0)
      let notificationMessage = ""
      if (oldPlan !== paymentData.newPlan) {
        notificationMessage = `Your plan has been ${newPrice > oldPrice ? "upgraded" : "downgraded"} from ${oldPlan} to ${paymentData.newPlan} plan valid until ${new Date(newEndDate).toLocaleDateString()}. Payment received via ${paymentData.paymentMode}.`
      } else if (oldEndDate !== newEndDate) {
        notificationMessage = `Your ${paymentData.newPlan} plan has been extended until ${new Date(newEndDate).toLocaleDateString()}. Payment received via ${paymentData.paymentMode}.`
      } else {
        notificationMessage = `Your payment status has been updated to ${paymentData.status}. Payment mode: ${paymentData.paymentMode}.`
      }

      toast({
        title: "Payment details updated!",
        description: `${selectedMemberForPayment.name} will be notified: "${notificationMessage}"`,
      })

      setPaymentModalOpen(false)
      setSelectedMemberForPayment(null)
    } catch (e: any) {
      toast({ title: "Failed to update payment details", description: e.message || "", variant: "destructive" })
    }
  }

  const openCoinsModal = (member: any) => {
    setSelectedMemberForCoins(member)
    setCoinModalOpen(true)
  }

  const handleWalletRecharge = async () => {
    if (!rechargeAmount || Number.parseInt(rechargeAmount) < 30) return

    try {
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number.parseInt(rechargeAmount) * 100, // paise
          currency: "INR",
          receipt: `wallet_recharge_${Date.now()}`,
          notes: { type: "wallet_recharge", gym_id: gymId },
        }),
      })

      let order: any
      try {
        const contentType = response.headers.get("content-type") || ""
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        if (!contentType.includes("application/json")) {
          throw new Error("Server returned non-JSON response")
        }
        order = await response.json()
      } catch (parseError: any) {
        console.error("JSON parsing error:", parseError)
        throw new Error("Invalid response from payment server. Please try again.")
      }

      const options = {
        ...order.razorpayOptions,
        handler: async (resp: any) => {
          try {
            const amountInt = Number.parseInt(rechargeAmount)

            const { error: txErr } = await supabase.from("wallet_transactions").insert({
              gym_id: gymId,
              transaction_type: "recharge",
              amount_inr: amountInt,
              razorpay_payment_id: resp?.razorpay_payment_id,
              description: "Wallet recharge via Razorpay",
            })
            if (txErr) throw txErr

            const newBalance = (gymData.walletBalance || 0) + amountInt
            const { error: wErr } = await supabase
              .from("gym_wallets")
              .upsert({ gym_id: gymId, balance_inr: newBalance }, { onConflict: "gym_id" })
            if (wErr) throw wErr

            toast({
              title: "Recharge Successful! 🎉",
              description: `₹${rechargeAmount} added to your wallet`,
            })
            setGymData((prev) => ({ ...prev, walletBalance: newBalance }))
            setWalletModalOpen(false)
            setRechargeAmount("")
          } catch (err: any) {
            toast({
              title: "Recharge recorded with issues",
              description: err.message || "Payment captured but failed to sync wallet. Please refresh.",
              variant: "destructive",
            })
          }
        },
        prefill: {
          name: gymData.ownerName,
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()
    } catch (error: any) {
      console.error("Error creating order:", error)
      toast({
        title: "Payment failed",
        description: error.message || "Unable to process payment. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black pb-20 text-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#da1c24] border-b border-red-800">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <Zap className="h-5 w-5 text-[#da1c24]" />
              </div>
              <span className="font-bold text-transparent bg-gradient-to-r from-white to-red-200 bg-clip-text text-lg">
                Flexio
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white hover:bg-white/20 border border-white/20"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 pt-20">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Welcome Section */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-transparent bg-gradient-to-r from-white via-red-200 to-white bg-clip-text mb-2">
              {gymData.gymName} Dashboard
            </h1>
            <p className="text-gray-300 text-lg">Welcome back, {gymData.ownerName}!</p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <Badge
                variant="secondary"
                className="bg-gradient-to-r from-green-600 to-green-700 text-white border-0 px-4 py-2"
              >
                {gymData.gymName}
              </Badge>
              <Badge
                variant="secondary"
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 px-4 py-2"
              >
                Code: {gymData.gymCode}
              </Badge>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            {/* Updated TabsList to hide Plans and Settings tabs */}
            <TabsList className="grid w-full grid-cols-4 bg-gray-800/50 border border-gray-700 backdrop-blur-sm">
              <TabsTrigger
                value="overview"
                className="text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-red-700 data-[state=active]:text-white hover:bg-gray-700/50"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="members"
                className="text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-red-700 data-[state=active]:text-white hover:bg-gray-700/50"
              >
                Members
              </TabsTrigger>
              <TabsTrigger
                value="revenue"
                className="text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-red-700 data-[state=active]:text-white hover:bg-gray-700/50"
              >
                Revenue
              </TabsTrigger>
              <TabsTrigger
                value="messages"
                className="text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-red-700 data-[state=active]:text-white hover:bg-gray-700/50"
              >
                Messages
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-gray-800/50 border border-gray-700 backdrop-blur-sm hover:bg-gray-800/70 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-white">{gymData.totalMembers || 0}</p>
                        <p className="text-sm text-gray-300">Total Members</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border border-gray-700 backdrop-blur-sm hover:bg-gray-800/70 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-r from-green-600 to-green-700 rounded-full">
                        <IndianRupee className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-white">₹{safeFormatRevenueL(gymData.monthlyRevenue)}L</p>
                        <p className="text-sm text-gray-300">Monthly Revenue</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border border-gray-700 backdrop-blur-sm hover:bg-gray-800/70 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full">
                        <TrendingUp className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-white">{safeFormatGrowth(gymData.revenueGrowth)}%</p>
                        <p className="text-sm text-gray-300">Growth</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border border-gray-700 backdrop-blur-sm hover:bg-gray-800/70 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-r from-purple-600 to-purple-700 rounded-full">
                        <UserPlus className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-white">{gymData.newMembersThisMonth || 0}</p>
                        <p className="text-sm text-gray-300">New Members</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-green-500" />
                    Wallet & Subscription
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Manage your gym subscription and member billing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Wallet Balance */}
                  <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-400">Current Balance</p>
                      <p className="text-2xl font-bold text-green-400">₹{gymData.walletBalance}</p>
                    </div>
                    <Button
                      onClick={() => setWalletModalOpen(true)}
                      className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white border-0"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Recharge
                    </Button>
                  </div>

                  {/* Member Limits */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-700/30 rounded-lg">
                      <p className="text-xs text-gray-400">Free Members</p>
                      <p className="text-lg font-semibold text-white">
                        {gymData.freeMembersUsed}/{gymData.totalFreeMembers}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-700/30 rounded-lg">
                      <p className="text-xs text-gray-400">Paid Members</p>
                      <p className="text-lg font-semibold text-white">
                        {gymData.totalMembers - gymData.totalFreeMembers}
                      </p>
                    </div>
                  </div>

                  {/* Billing Info */}
                  <div className="p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-blue-300">Next Billing</p>
                      <Badge variant="outline" className="border-blue-500 text-blue-300">
                        {gymData.subscriptionStatus}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mb-1">Date: {gymData.nextBillingDate}</p>
                    <p className="text-xs text-gray-400">
                      Charge: ₹{gymData.monthlyChargePerMember} × {gymData.activeMembers} members = ₹
                      {gymData.monthlyChargePerMember * gymData.activeMembers}
                    </p>
                  </div>

                  {/* Member Addition Cost */}
                  {gymData.freeMembersUsed >= gymData.totalFreeMembers && (
                    <div className="p-3 bg-orange-900/20 border border-orange-700/30 rounded-lg">
                      <p className="text-sm text-orange-300">
                        <AlertCircle className="h-4 w-4 inline mr-1" />
                        New member cost: ₹15 per member
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Most Active Members</CardTitle>
                  <CardDescription className="text-gray-400">Top performers this month</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {members.slice(0, 5).map((member, index) => (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  index === 0
                    ? "bg-yellow-500 text-white"
                    : index === 1
                      ? "bg-gray-400 text-white"
                      : index === 2
                        ? "bg-orange-500 text-white"
                        : "bg-gray-600 text-gray-300"
                }`}
              >
                {index + 1}
              </div>
                          <div>
                            <p className="font-medium text-white">{member.name}</p>
                            <p className="text-sm text-gray-400">{member.plan} Plan</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-orange-500" />
                          <span className="font-medium text-white">
                            {member.currentStreak || 
                              // Use deterministic value based on member ID instead of random
                              ((member.id * 7) % 20) + 1
                            }
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Members Tab */}
            <TabsContent value="members" className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search members..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-gray-800/50 border-gray-700 text-white placeholder-gray-400 focus:border-red-500 leading-8"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                    <SelectTrigger className="w-32 bg-gray-800/50 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="all" className="text-white">
                        All
                      </SelectItem>
                      <SelectItem value="active" className="text-white">
                        Active
                      </SelectItem>
                      <SelectItem value="expiring" className="text-white">
                        Expiring
                      </SelectItem>
                      <SelectItem value="expiring-3" className="text-white">
                        Expiring in 3 days
                      </SelectItem>
                      <SelectItem value="expiring-7" className="text-white">
                        Expiring in 7 days
                      </SelectItem>
                      <SelectItem value="expired" className="text-white">
                        Expired
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Dialog open={isAddingMember} onOpenChange={setIsAddingMember}>
                    <DialogTrigger asChild>
                      <Button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border-0">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-gray-800 border-gray-700">
                      <DialogHeader>
                        <DialogTitle className="text-white">Add New Member</DialogTitle>
                        <DialogDescription className="text-gray-400">
                          Add a member directly to your gym
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="memberName" className="text-white">
                            Full Name
                          </Label>
                          <Input
                            id="memberName"
                            value={newMember.name}
                            onChange={(e) => setNewMember((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter member's full name"
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="memberPhone" className="text-white">
                            Phone Number *
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">+91</span>
                            <Input
                              id="memberPhone"
                              type="tel"
                              value={newMember.phone}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, "").slice(0, 10)
                                setNewMember((prev) => ({ ...prev, phone: value }))
                              }}
                              placeholder="9876543210"
                              className="bg-gray-700 border-gray-600 text-white pl-12"
                              maxLength={10}
                              required
                            />
                          </div>
                          <p className="text-xs text-gray-500">Member will receive login credentials via SMS</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="memberPlan" className="text-white">
                            Plan *
                          </Label>
                          <Select
                            value={newMember.plan}
                            onValueChange={(value) => setNewMember((prev) => ({ ...prev, plan: value }))}
                          >
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                              <SelectValue placeholder="Select a plan" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-700 border-gray-600 text-white">
                              {gymPlans
                                .filter((plan) => plan.active)
                                .map((plan) => (
                                  <SelectItem key={plan.id} value={plan.name} className="text-white">
                                    {plan.name} - ₹{plan.price}/{plan.duration}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={addMember}
                            className="flex-1 bg-transparent border-white text-white hover:bg-white hover:text-gray-900"
                            variant="outline"
                          >
                            Add Member
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setIsAddingMember(false)}
                            className="flex-1 bg-transparent border-white text-white hover:bg-white hover:text-gray-900"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="space-y-4">
                {filteredMembers.map((member) => (
                  <Card
                    key={member.id}
                    className="bg-gray-800/90 border-gray-700 hover:bg-gray-700/50 transition-colors backdrop-blur-sm"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {member.profilePicture ? (
                            <img
                              src={member.profilePicture || "/placeholder.svg"}
                              alt={member.name}
                              className="w-full h-full object-cover object-center"
                            />
                          ) : (
                            <span className="text-white font-semibold text-lg text-center">
                              {member.name.charAt(0)}
                            </span>
                          )}
                        </div>

                        {/* Member Info */}
                        <div className="flex-1 min-w-0">
                          <div className="space-y-2">
                            <div>
                              <h3 className="font-semibold text-white text-base leading-tight truncate">
                                {member.name}
                              </h3>
                              <p className="text-gray-300 text-sm truncate">{member.phone}</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-1.5">
                                {getStatusIcon(member.status, member.joinDate)}
                                <span
                                  className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${
                                    member.status === "active"
                                      ? "bg-green-900/50 text-green-400"
                                      : member.status === "expiring"
                                        ? "bg-yellow-900/50 text-yellow-400"
                                        : "bg-red-900/50 text-red-400"
                                  }`}
                                >
                                  {member.status === "expiring"
                                    ? `Expiring in ${getDaysUntilExpiration(member.status, member.joinDate)} days`
                                    : member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                                </span>
                              </div>
                              <Badge
                                variant="secondary"
                                className="bg-gray-700/70 text-gray-200 border-gray-600 text-xs"
                              >
                                {member.plan}
                              </Badge>
                            </div>

                            <p className="text-xs text-gray-400 truncate">
                              Plan expires: {new Date(member.planEndDate).toLocaleDateString()}
                            </p>

                            <div className="flex gap-2 pt-2">
                              <Button
                                onClick={() => openPaymentModal(member)}
                                size="sm"
                                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0 px-3 py-2 text-xs flex-1"
                              >
                                <CreditCard className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span className="truncate">Manage</span>
                              </Button>
                              <Button
                                onClick={() => openCoinModal(member)}
                                size="sm"
                                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white border-0 px-3 py-2 text-xs flex-1"
                              >
                                <Coins className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span className="truncate">Add Coins</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Delete Confirmation Dialog */}
              <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent className="bg-gray-800 border-gray-700 max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-white">Delete Plan</DialogTitle>
                    <DialogDescription className="text-gray-400">
                      Are you sure you want to delete this plan? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => setDeleteConfirmOpen(false)}
                      variant="outline"
                      className="flex-1 border-gray-600 hover:bg-gray-700 text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={deletePlan}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      Delete
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
              <DialogContent className="bg-gray-800 border-gray-700 max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-500" />
                    Manage Payment & Plan
                  </DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Update payment status and plan details for {selectedMemberForPayment?.name}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="planType" className="text-white">
                      Plan Type
                    </Label>
                    <Select
                      value={paymentData.newPlan}
                      onValueChange={(value) => setPaymentData((prev) => ({ ...prev, newPlan: value }))}
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-700 border-gray-600">
                        {gymPlans
                          .filter((plan) => plan.active)
                          .map((plan) => (
                            <SelectItem key={plan.id} value={plan.name} className="text-white">
                              {plan.name} - ₹{plan.price}/{plan.duration}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paymentMode" className="text-white">
                      Payment Receive Mode
                    </Label>
                    <Select
                      value={paymentData.paymentMode}
                      onValueChange={(value) =>
                        setPaymentData((prev) => ({ ...prev, paymentMode: value, status: "paid" }))
                      }
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-700 border-gray-600">
                        <SelectItem value="online" className="text-white">
                          Online
                        </SelectItem>
                        <SelectItem value="cash" className="text-white">
                          Cash
                        </SelectItem>
                        <SelectItem value="upi" className="text-white">
                          UPI
                        </SelectItem>
                        <SelectItem value="card" className="text-white">
                          Card
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paymentStatus" className="text-white">
                      Payment Status
                    </Label>
                    <Select
                      value={paymentData.status}
                      onValueChange={(value) => setPaymentData((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-700 border-gray-600">
                        <SelectItem value="paid" className="text-white">
                          Paid
                        </SelectItem>
                        <SelectItem value="pending" className="text-white">
                          Pending
                        </SelectItem>
                        <SelectItem value="overdue" className="text-white">
                          Overdue
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="planEndDate" className="text-white">
                      Current Plan End Date
                    </Label>
                    <Input
                      id="planEndDate"
                      type="date"
                      value={paymentData.planEndDate}
                      onChange={(e) => setPaymentData((prev) => ({ ...prev, planEndDate: e.target.value }))}
                      className="bg-gray-700 border-gray-600 text-white"
                      disabled
                    />
                    <p className="text-xs text-gray-400">
                      Plan will be automatically extended based on selected plan duration when payment is marked as
                      paid.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={updatePaymentDetails}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0"
                  >
                    Update & Notify
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPaymentModalOpen(false)}
                    className="flex-1 bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                  >
                    Cancel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Revenue Tab */}
            <TabsContent value="revenue" className="space-y-6">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Revenue Trends</CardTitle>
                  <CardDescription className="text-gray-400">
                    {revenueData.length >= 3 ? "Interactive revenue chart" : "Monthly revenue and member growth"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {revenueData.length >= 3 ? (
                    // Interactive graph view for 3+ months
                    <div className="h-64 flex items-center justify-center bg-gray-700 rounded-lg">
                      <div className="text-center">
                        <TrendingUp className="h-12 w-12 text-green-500 mx-auto mb-2" />
                        <p className="text-white font-medium">Interactive Revenue Chart</p>
                        <p className="text-gray-400 text-sm">Chart visualization would be rendered here</p>
                      </div>
                    </div>
                  ) : (
                    // Table format for less than 3 months
                    <div className="space-y-4">
                      {revenueData.map((data) => {
                        const maxRevenue = Math.max(...revenueData.map((d) => d.revenue), 1) // avoid -Infinity
                        const progressValue = maxRevenue > 0 ? (data.revenue / maxRevenue) * 100 : 0
                        const safeValue = isFinite(progressValue) && !isNaN(progressValue) ? progressValue : 0
                        return (
                          <div key={data.month} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-12 text-sm font-medium text-gray-400">{data.month}</div>
                              <div className="flex-1">
                                <Progress value={safeValue} className="h-2" />
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-white">₹{(data.revenue || 0).toLocaleString()}</p>
                              <p className="text-sm text-gray-400">{data.members || 0} members</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Revenue Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {revenueBreakdown.length > 0 ? (
                  revenueBreakdown.map((plan) => (
                    <Card key={plan.planName} className="bg-gray-800 border-gray-700">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-white">₹{plan.revenue.toLocaleString()}</p>
                        <p className="text-sm text-gray-400">{plan.planName} Plans</p>
                        <p className={`text-xs ${plan.growth >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {plan.growth >= 0 ? "+" : ""}{plan.growth.toFixed(1)}%
                        </p>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-white">₹0</p>
                      <p className="text-sm text-gray-400">No Revenue Data</p>
                      <p className="text-xs text-gray-600">--</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Messages Tab */}
            <TabsContent value="messages" className="space-y-6">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-green-500" />
                    Online Payments
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentPayments.length > 0 ? (
                    <div className="space-y-3">
                      {recentPayments.map((payment: any, index: number) => (
                        <div key={index} className="p-3 bg-green-900/20 border border-green-700 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-green-400">Payment Successful</p>
                              <p className="text-xs text-gray-400">
                                {payment.users?.full_name || "Member"} -{" "}
                                {payment.memberships?.gym_plans?.plan_name || "Plan"}
                              </p>
                              <p className="text-xs text-gray-500">
                                Plan expires:{" "}
                                {payment.memberships?.expiry_date
                                  ? new Date(payment.memberships.expiry_date).toLocaleDateString()
                                  : "--"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-400">
                                ₹{Number(payment.amount_inr || 0).toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-400">
                                {payment.payment_date
                                  ? new Date(payment.payment_date).toLocaleString("en-US", {
                                      hour: "numeric",
                                      minute: "numeric",
                                      timeZone: "Asia/Kolkata",
                                    })
                                  : "Recently"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-gray-400">
                      <CreditCard className="h-12 w-12 mx-auto mb-2 text-gray-600" />
                      <p>No recent payments</p>
                      <p className="text-sm">Payment history will appear here</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full justify-start bg-transparent border-white text-white hover:bg-white hover:text-gray-900"
                    variant="outline"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Send Payment Reminder ({gymData.pendingPayments} members)
                  </Button>
                  <Button
                    className="w-full justify-start bg-transparent border-white text-white hover:bg-white hover:text-gray-900"
                    variant="outline"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Send Monthly Newsletter
                  </Button>
                  <Button
                    className="w-full justify-start bg-transparent border-white text-white hover:bg-white hover:text-gray-900"
                    variant="outline"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Message All Active Members
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Plans Tab Content - Hidden from tabs but accessible via footer */}
            <TabsContent value="plans" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Membership Plans</h2>
                <Dialog
                  open={isAddingPlan}
                  onOpenChange={(open) => {
                    setIsAddingPlan(open)
                    if (!open) {
                      setIsEditingPlan(false)
                      setEditingPlan(null)
                      setNewPlan({ name: "", price: "", duration: "monthly", features: "" })
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border-0">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Plan
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-800 border-gray-700">
                    <DialogHeader>
                      <DialogTitle className="text-white">{isEditingPlan ? "Edit Plan" : "Create New Plan"}</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        {isEditingPlan ? "Update the membership plan details" : "Add a new membership plan to your gym"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="planName" className="text-white">
                            Plan Name
                          </Label>
                          <Input
                            id="planName"
                            value={newPlan.name}
                            onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                            placeholder="e.g., Premium"
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                        </div>
                        <div>
                          <Label htmlFor="planPrice" className="text-white">
                            Price (₹)
                          </Label>
                          <Input
                            id="planPrice"
                            type="number"
                            value={newPlan.price}
                            onChange={(e) => setNewPlan({ ...newPlan, price: e.target.value })}
                            placeholder="2400"
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="planDuration" className="text-white">
                          Duration
                        </Label>
                        <select
                          id="planDuration"
                          value={newPlan.duration}
                          onChange={(e) => setNewPlan({ ...newPlan, duration: e.target.value })}
                          className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
                        >
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="6 months">6 months</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="planFeatures" className="text-white">
                          Features (comma-separated)
                        </Label>
                        <textarea
                          id="planFeatures"
                          value={newPlan.features}
                          onChange={(e) => setNewPlan({ ...newPlan, features: e.target.value })}
                          placeholder="Equipment access, Locker room, Basic support"
                          className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
                          rows={3}
                        />
                      </div>
                      <Button
                        onClick={addGymPlan}
                        className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border-0"
                      >
                        {isEditingPlan ? "Update Plan" : "Create Plan"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4">
                {gymPlans.map((plan) => (
                  <Card
                    key={plan.id}
                    className="bg-gray-800/50 border border-gray-700 backdrop-blur-sm hover:bg-gray-800/70 transition-all duration-300"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                          <p className="text-2xl font-bold text-green-400 mt-1">₹{plan.price.toLocaleString()}</p>
                          <p className="text-sm text-gray-400">per {plan.duration}</p>
                          <div className="mt-3">
                            <p className="text-sm text-gray-300 mb-2">Features:</p>
                            <ul className="text-sm text-gray-400 space-y-1">
                              {plan.features.map((feature, index) => (
                                <li key={index} className="flex items-center gap-2">
                                  <Check className="h-3 w-3 text-green-500" />
                                  {feature}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Badge
                            variant={plan.active ? "default" : "secondary"}
                            className={plan.active ? "bg-green-600 text-white" : "bg-gray-600 text-gray-300"}
                          >
                            {plan.active ? "Active" : "Inactive"}
                          </Badge>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => startEditPlan(plan)}
                              size="sm"
                              variant="outline"
                              className="bg-transparent border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                            >
                              Edit
                            </Button>
                            <Button
                              onClick={() => confirmDeletePlan(plan.id)}
                              size="sm"
                              variant="outline"
                              className="bg-transparent border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                            >
                              Delete
                            </Button>
                          </div>
                          <Button
                            onClick={() => togglePlanStatus(plan.id)}
                            size="sm"
                            variant="outline"
                            className="bg-transparent border-white text-white hover:bg-white hover:text-black"
                          >
                            {plan.active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Settings Tab Content - Hidden from tabs but accessible via footer */}
            <TabsContent value="settings" className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Settings</h2>

              <div className="grid gap-6">
                <Card className="bg-gray-800/50 border border-gray-700 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Coin Value Settings</CardTitle>
                    <CardDescription className="text-gray-300">Set how much each coin is worth in INR</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-white">Coin Value (INR)</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          type="number"
                          step="0.1"
                          value={tempCoinValue}
                          onChange={(e) => setTempCoinValue(e.target.value)}
                          placeholder="4.0"
                          className="bg-gray-700 border-gray-600 text-white"
                        />
                        <Button
                          onClick={() => {
                            setCoinValue(Number.parseFloat(tempCoinValue) || 4.0)
                            setTempCoinValue("")
                            toast({ title: "Updated!", description: "Coin value has been updated." })
                          }}
                          className="bg-transparent border border-white text-white hover:bg-white hover:text-gray-900"
                        >
                          Update
                        </Button>
                      </div>
                      <p className="text-gray-400 text-sm mt-1">Current: 1 coin = ₹{coinValue.toFixed(2)}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border border-gray-700 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Location Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-white">Current Location</Label>
                      <p className="text-gray-300">Mumbai, Maharashtra, India</p>
                    </div>
                    <Button
                      onClick={() => {
                        toast({ title: "Location Updated!", description: "Gym location has been updated." })
                      }}
                      className="bg-transparent border border-white text-white hover:bg-white hover:text-gray-900"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Update Location
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border border-gray-700 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Notifications</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white">Payment Reminders</p>
                        <p className="text-gray-300 text-sm">Send automatic payment reminders to members</p>
                      </div>
                      <Button variant="outline" className="border-gray-600 text-white hover:bg-gray-700 bg-transparent">
                        Enabled
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white">Birthday Notifications</p>
                        <p className="text-gray-300 text-sm">Get notified about member birthdays</p>
                      </div>
                      <Button variant="outline" className="border-gray-600 text-white hover:bg-gray-700 bg-transparent">
                        Enabled
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
        <DialogContent className="bg-gray-900 border border-gray-700 text-white max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-transparent bg-gradient-to-r from-green-400 to-green-600 bg-clip-text">
              Recharge Wallet
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Add funds to your gym wallet. Minimum recharge: ₹30
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="recharge-amount" className="text-white">
                Recharge Amount (₹)
              </Label>
              <Input
                id="recharge-amount"
                type="number"
                placeholder="Enter amount (min ₹30)"
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-green-500"
                min="30"
              />
              {rechargeAmount && Number.parseInt(rechargeAmount) < 30 && (
                <p className="text-red-400 text-sm mt-1">Minimum recharge amount is ₹30</p>
              )}
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {[50, 100, 200, 500, 1000, 2000].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  onClick={() => setRechargeAmount(amount.toString())}
                  className="border-gray-600 hover:bg-gray-700 hover:text-white text-black"
                >
                  ₹{amount}
                </Button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setWalletModalOpen(false)
                  setRechargeAmount("")
                }}
                className="flex-1 border-gray-600 hover:bg-gray-700 text-black"
              >
                Cancel
              </Button>
              <Button
onClick={handleWalletRecharge}
                disabled={!rechargeAmount || Number.parseInt(rechargeAmount) < 30}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white border-0"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Pay with Razorpay
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#da1c24] border-t border-red-800">
        <div className="max-w-4xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <button
              onClick={() => setActiveTab("overview")}
              className="flex flex-col items-center gap-1 text-white hover:text-white/80 min-w-0"
            >
              <Home className="h-5 w-5 flex-shrink-0" />
              <span className="text-xs font-medium truncate">Home</span>
            </button>

            <button
              onClick={() => setActiveTab("plans")}
              className="flex flex-col items-center gap-1 text-white hover:text-white/80 min-w-0"
            >
              <CreditCard className="h-5 w-5 flex-shrink-0" />
              <span className="text-xs font-medium truncate">Plans</span>
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className="flex flex-col items-center gap-1 text-white hover:text-white/80 min-w-0"
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <span className="text-xs font-medium truncate">Settings</span>
            </button>
          </div>
        </div>
      </footer>

      <Dialog open={coinModalOpen} onOpenChange={setCoinModalOpen}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Add Coins</DialogTitle>
            <DialogDescription className="text-gray-400">
              Add bonus coins to {selectedMemberForCoins?.name}'s account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coinAmount" className="text-white">
                Number of Coins
              </Label>
              <Input
                id="coinAmount"
                type="number"
                value={coinAmount}
                onChange={(e) => setCoinAmount(e.target.value)}
                placeholder="Enter coins amount"
                className="bg-gray-700 border-gray-600 text-white"
                min="1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setCoinModalOpen(false)}
                variant="outline"
                className="flex-1 bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleGiveBonusCoins(selectedMemberForCoins?.id, coinAmount)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                Add Coins
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
