"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
  Trash2,
  AlertTriangle,
  Edit,
  Dumbbell,
  Sparkles,
  Bell,
  Menu,
  X,
  ChevronDown,
  Activity,
  BarChart3,
  Users2,
  MessageCircle
} from "lucide-react"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"
import { SubscriptionService, SubscriptionData } from "@/lib/subscription-service"

type GymPlan = {
  id: string
  name: string
  price: number
  duration: string
  features: string[]
  active: boolean
}

// Add this helper function at the top of the component
const safeNumber = (value: any, defaultValue: number = 0): number => {
  const num = Number(value)
  return isFinite(num) && !isNaN(num) ? num : defaultValue
}

export default function GymOwnerDashboard() {
  const { toast } = useToast()
  const router = useRouter()
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
          router.push("/auth/signin")
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
          router.push(role === "member" ? "/member/dashboard" : "/auth/signin")
        }, 2000)
        return
      }
    }

    checkUserRole()
  }, [toast, router])

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
  const [isAddingMemberLoading, setIsAddingMemberLoading] = useState(false)
  const [editingMember, setEditingMember] = useState<any>(null)
  const [bonusCoinsInput, setBonusCoinsInput] = useState<{ [key: number]: string }>({})
  const [activeTab, setActiveTab] = useState("overview")
  const [coinValue, setCoinValue] = useState(4.0)
  const [gymId, setGymId] = useState<string | null>(null)
  const [isPlanSaving, setIsPlanSaving] = useState(false)

  // Add new state variables for member deletion
  const [memberDeleteConfirmOpen, setMemberDeleteConfirmOpen] = useState(false)
  const [memberSecondConfirmOpen, setMemberSecondConfirmOpen] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<any>(null)
  const [isDeletingMember, setIsDeletingMember] = useState(false)
  
  // Add new state variables for payment dialog edit functionality
  const [isEditingPayment, setIsEditingPayment] = useState(false)
  const [originalPlanEndDate, setOriginalPlanEndDate] = useState("")

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
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null)
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false)

  type NotificationSettings = {
    paymentReminders: boolean
    birthdayNotifications: boolean
  }

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    paymentReminders: true,
    birthdayNotifications: true,
  })

  const toggleNotificationSetting = async (setting: 'paymentReminders' | 'birthdayNotifications') => {
    const newValue = !notificationSettings[setting]

    try {
      // Update in database if you have a settings table
      // For now, just update local state
      setNotificationSettings((prev) => ({
        ...prev,
        [setting]: newValue,
      }))

      toast({
        title: "Settings Updated",
        description: `${setting === 'paymentReminders' ? 'Payment reminders' : 'Birthday notifications'} ${newValue ? 'enabled' : 'disabled'}`,
      })
    } catch (error: any) {
      toast({
        title: "Failed to update settings",
        description: error.message || "Please try again",
        variant: "destructive",
      })
    }
  }

  // Additional state for live data
  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number; members: number }[]>([])
  const [recentPayments, setRecentPayments] = useState<any[]>([])
  const [revenueBreakdown, setRevenueBreakdown] = useState<{ planName: string; revenue: number; growth: number; transactionCount?: number }[]>([])
  const [revenueTimeFilter, setRevenueTimeFilter] = useState('1month')
  const [chartData, setChartData] = useState<any[]>([])
  const [revenueStats, setRevenueStats] = useState({
    totalRevenue: 0,
    averageRevenue: 0,
    growth: 0,
    transactionCount: 0
  })
  const [paymentTransactions, setPaymentTransactions] = useState<any[]>([])
  const [isLoadingRevenue, setIsLoadingRevenue] = useState(false)

  // Helper: safe growth calculation
  const safeCalculateGrowth = (current: number, previous: number): number => {
    if (!previous || previous === 0) return current > 0 ? 100 : 0
    const growth = ((current - previous) / previous) * 100
    const val = Math.round(growth * 10) / 10
    return isFinite(val) && !isNaN(val) ? val : 0
  }

  // Helper: safe revenue format in thousands (k)
  const formatRevenue = (revenue: any): string => {
    const r = safeNumber(revenue, 0)
    const out = (r / 1000).toFixed(1) + "k"
    return isFinite(safeNumber(out.replace('k', ''), 0)) ? out : "0.0k"
  }

  // Helper: safe growth format
  const formatGrowth = (growth: any): string => {
    const g = safeNumber(growth, 0)
    return g.toFixed(1)
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

  // Enhanced revenue data loading function
  const loadEnhancedRevenueData = async (timeFilter: string) => {
    if (!gymId) {
      console.log('No gymId available for revenue data loading')
      return
    }
    
    console.log('Loading revenue data for gymId:', gymId, 'timeFilter:', timeFilter)
    setIsLoadingRevenue(true)
    try {
      const now = new Date()
      let startDate: Date
      let groupBy: string
      
      // Calculate date range based on filter
      switch (timeFilter) {
        case '7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          groupBy = 'day'
          break
        case '1month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
          groupBy = 'day'
          break
        case '3months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
          groupBy = 'week'
          break
        case '6months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
          groupBy = 'month'
          break
        case '1year':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
          groupBy = 'month'
          break
        default:
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
          groupBy = 'day'
      }

      console.log('Date range:', startDate.toISOString(), 'to', now.toISOString())

      // Fetch payment data with improved query
      const { data: payments, error } = await supabase
        .from('payments')
        .select(`
          id,
          payment_date,
          amount_inr,
          payment_method,
          payment_status,
          users!inner(full_name, phone_number),
          memberships!inner(
            expiry_date,
            start_date,
            gym_plans!inner(plan_name, price_inr)
          )
        `)
        .eq('gym_id', gymId)
        .eq('payment_status', 'completed')
        .gte('payment_date', startDate.toISOString())
        .order('payment_date', { ascending: false })

      if (error) {
        console.error('Database query error:', error)
        throw error
      }

      console.log('Payments found:', payments?.length || 0)

      // Process data for charts - using real data only
      const processedData = processRevenueData(payments || [], groupBy, startDate, now)
      console.log('Processed data:', processedData)
      
      setChartData(processedData.chartData)
      setRevenueStats(processedData.stats)
      setPaymentTransactions((payments || []).slice(0, 20)) // Latest 20 transactions
      
      // Calculate revenue breakdown by plan from real data
      const planBreakdown = calculatePlanBreakdown(payments || [])
      setRevenueBreakdown(planBreakdown)
      
      // Update existing revenueData for backward compatibility
      const monthlyData = processedData.chartData.slice(-5).map((item: any) => ({
        month: item.period,
        revenue: item.revenue,
        members: item.memberCount || 0
      }))
      setRevenueData(monthlyData)
      
    } catch (error) {
      console.error('Error loading enhanced revenue data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load revenue data',
        variant: 'destructive'
      })
    } finally {
      setIsLoadingRevenue(false)
    }
  }

  // Add function to calculate plan breakdown from real data
  const calculatePlanBreakdown = (payments: any[]) => {
    const planRevenue: { [key: string]: number } = {}
    const planCounts: { [key: string]: number } = {}
    
    // Group payments by plan
    payments.forEach(payment => {
      const planName = payment.memberships?.gym_plans?.plan_name || 'Unknown'
      const amount = Number(payment.amount_inr || 0)
      
      planRevenue[planName] = (planRevenue[planName] || 0) + amount
      planCounts[planName] = (planCounts[planName] || 0) + 1
    })
    
    // Calculate growth (simplified - comparing with previous period)
    return Object.keys(planRevenue).map(planName => ({
      planName,
      revenue: planRevenue[planName],
      growth: 0, // You can implement period comparison for growth calculation
      transactionCount: planCounts[planName]
    }))
  }

  // Data processing function
  const processRevenueData = (payments: any[], groupBy: string, startDate: Date, endDate: Date) => {
    const periods = generatePeriods(startDate, endDate, groupBy)
    const revenueMap: { [key: string]: number } = {}
    let totalRevenue = 0
    let transactionCount = 0

    // Initialize all periods with 0
    periods.forEach(period => {
      revenueMap[period] = 0
    })

    // Process payments
    payments.forEach(payment => {
      const paymentDate = new Date(payment.payment_date)
      const amount = safeNumber(payment.amount_inr, 0) // Use safe number conversion
      
      let periodKey: string
      if (groupBy === 'day') {
        periodKey = paymentDate.toISOString().split('T')[0]
      } else if (groupBy === 'week') {
        const weekStart = new Date(paymentDate)
        weekStart.setDate(paymentDate.getDate() - paymentDate.getDay())
        periodKey = weekStart.toISOString().split('T')[0]
      } else {
        periodKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`
      }

      if (revenueMap.hasOwnProperty(periodKey)) {
        revenueMap[periodKey] += amount
      }
      
      totalRevenue += amount
      transactionCount += 1
    })

    const chartData = periods.map(period => ({
      period,
      revenue: safeNumber(revenueMap[period], 0)
    }))
    
    // Calculate growth
    const currentPeriodRevenue = chartData[chartData.length - 1]?.revenue || 0
    const previousPeriodRevenue = chartData[chartData.length - 2]?.revenue || 0
    const growth = safeCalculateGrowth(currentPeriodRevenue, previousPeriodRevenue)
    
    return {
      chartData,
      stats: {
        totalRevenue,
        averageRevenue: chartData.length > 0 ? totalRevenue / chartData.length : 0,
        growth,
        transactionCount
      }
    }
  }

  // Helper functions for period generation and formatting
  const generatePeriods = (startDate: Date, endDate: Date, groupBy: string): string[] => {
    const periods: string[] = []
    const current = new Date(startDate)
    
    while (current <= endDate) {
      periods.push(formatPeriod(current, groupBy))
      
      switch (groupBy) {
        case 'day':
          current.setDate(current.getDate() + 1)
          break
        case 'week':
          current.setDate(current.getDate() + 7)
          break
        case 'month':
          current.setMonth(current.getMonth() + 1)
          break
      }
    }
    
    return periods
  }

  const formatPeriod = (date: Date, groupBy: string): string => {
    switch (groupBy) {
      case 'day':
        return date.toISOString().split('T')[0]
      case 'week':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        return weekStart.toISOString().split('T')[0]
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      default:
        return date.toISOString().split('T')[0]
    }
  }

  // Updated gymData state - removing mock values
  const [gymData, setGymData] = useState({
    totalMembers: 0,
    activeMembers: 0,
    monthlyRevenue: 0,
    revenueGrowth: 0,
    pendingPayments: 0,
    coinValue: 0,
    location: null,
    ownerName: "",
    gymName: "",
    gymCode: "",
    newMembersThisMonth: 0,
    walletBalance: 0,
    freeMembersUsed: 0,
    totalFreeMembers: 5, // Fixed to 5 as per business logic
    paidMembers: 0,
    hiddenMembers: 0, // Add this field
    requiredAmount: 0, // Add this field
    subscriptionStatus: "",
    nextBillingDate: "",
    monthlyChargePerMember: 0,
    todaysCheckIns: 0, // Add this new field
  })

  const [gymPlans, setGymPlans] = useState<GymPlan[]>([])

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

  // Load subscription data
  const loadSubscriptionData = async () => {
    if (!gymId) return
    
    setIsLoadingSubscription(true)
    try {
      const subData = await SubscriptionService.calculateSubscriptionData(gymId)
      setSubscriptionData(subData)
      
      // Update gymData with subscription info - sync with live data
      setGymData(prev => ({
        ...prev,
        walletBalance: subData.walletBalance,
        nextBillingDate: subData.nextBillingDate,
        totalMembers: subData.totalMembers,
        freeMembersUsed: subData.freeMembers, // Sync with live data
        totalFreeMembers: 5, // Always 5 as per business logic
        paidMembers: subData.paidMembers,
        hiddenMembers: subData.hiddenMembers, // Add hidden members count
        requiredAmount: subData.requiredAmount // Add required amount for hidden members
      }))
    } catch (error) {
      console.error('Error loading subscription data:', error)
    } finally {
      setIsLoadingSubscription(false)
    }
  }

  // Load visible members based on subscription rules
  const loadVisibleMembers = async () => {
    if (!gymId) return
    
    try {
      const visibleMembers = await SubscriptionService.getVisibleMembers(gymId)
      
      // Get user IDs for additional data
      const userIds = visibleMembers.map((m: any) => m.user_id)
      
      // Aggregate coin balances per user
      let coinMap: Record<string, number> = {}
      if (userIds.length > 0) {
        const { data: coinTx } = await supabase
          .from("coin_transactions")
          .select("user_id, amount, transaction_type")
          .in("user_id", userIds)
          .eq("gym_id", gymId)
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
          .eq("gym_id", gymId)
          .order("check_in_time", { ascending: false })
        for (const v of visits || []) {
          if (!lastVisitMap[v.user_id]) lastVisitMap[v.user_id] = v.check_in_time
        }
      }

      setMembers(
        visibleMembers.map((m: any) => ({
          id: m.user_id,
          membershipId: m.id,
          name: m.users?.full_name || "",
          email: "",
          phone: m.users?.phone_number || "",
          plan: m.gym_plans?.plan_name || "",
          status: m.is_active ? "active" : "expired",
          lastVisit: lastVisitMap[m.user_id] || "",
          joinDate: m.start_date,
          planEndDate: m.expiry_date,
          paymentStatus: m.payment_status === "paid" ? "paid" : m.payment_status || "",
          totalVisits: 0,
          weeklyVisits: 0,
          currentStreak: 0,
          totalCoins: coinMap[m.user_id] || 0,
          avatar: "",
          profilePicture: m.users?.profile_picture_url || null,
          isFree: m.isFree,
          memberType: m.memberType
        }))
      )
    } catch (error) {
      console.error('Error loading visible members:', error)
    }
  }

  // Add function to load today's check-ins
  const loadTodaysCheckIns = async () => {
    try {
      if (!gymId) return
      
      const today = new Date().toDateString()
      const todayStart = new Date(today).toISOString()
      const todayEnd = new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000).toISOString()
      
      const { data: checkIns, error } = await supabase
        .from('check_ins')
        .select('id')
        .eq('gym_id', gymId)
        .gte('check_in_time', todayStart)
        .lt('check_in_time', todayEnd)
      
      if (error) {
        console.error('Error fetching today\'s check-ins:', error)
        return
      }
      
      setGymData(prev => ({
        ...prev,
        todaysCheckIns: checkIns?.length || 0
      }))
    } catch (error) {
      console.error('Error loading today\'s check-ins:', error)
    }
  }

  // Load live data from Supabase
  useEffect(() => {
    const user = getCurrentUser()
    if (!user) return

    const load = async () => {
      try {
        // Fetch owner details - Fixed to handle no results
        const { data: ownerData, error: ownerError } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle()
        
        if (ownerError) {
          console.error("Error fetching owner data:", ownerError)
          toast({
            title: "Error",
            description: "Failed to load owner information",
            variant: "destructive",
          })
          return
        }

        // Fetch gym owned by current user - Fixed to handle no results
        const { data: gym, error: gErr } = await supabase
          .from("gyms")
          .select("id, gym_name, gym_code, coin_value, subscription_status, free_member_count")
          .eq("owner_id", user.id)
          .maybeSingle()
        
        if (gErr) {
          console.error("Error fetching gym data:", gErr)
          toast({
            title: "Error",
            description: "Failed to load gym information",
            variant: "destructive",
          })
          return
        }

        if (!gym) {
          toast({
            title: "No Gym Found",
            description: "No gym is associated with your account. Please contact support.",
            variant: "destructive",
          })
          return
        }

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

        // Wallet info - Fixed to handle no results
        const { data: wallet, error: walletError } = await supabase
          .from("gym_wallets")
          .select("balance_inr, last_billing_date")
          .eq("gym_id", gym.id)
          .maybeSingle()
        
        if (walletError) {
          console.error("Error fetching wallet data:", walletError)
        } else if (wallet) {
          // Calculate next billing date (30 days from last billing or today if no last billing)
          const lastBilling = wallet.last_billing_date ? new Date(wallet.last_billing_date) : new Date()
          const nextBilling = new Date(lastBilling)
          nextBilling.setDate(nextBilling.getDate() + 30)
          
          setGymData((prev) => ({
            ...prev,
            walletBalance: Number(wallet.balance_inr || 0),
            nextBillingDate: nextBilling.toISOString().split('T')[0],
          }))
        } else {
          // No wallet record exists, create next billing date as 30 days from now
          const nextBilling = new Date()
          nextBilling.setDate(nextBilling.getDate() + 30)
          
          setGymData((prev) => ({
            ...prev,
            nextBillingDate: nextBilling.toISOString().split('T')[0],
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
        
        // Calculate free and paid members correctly
        const freeMembersUsed = Math.min(totalMembers, 5) // First 5 are free
        const paidMembers = Math.max(0, totalMembers - 5) // Members beyond 5 are paid
        
        setGymData((prev) => ({ 
          ...prev, 
          totalMembers, 
          activeMembers, 
          pendingPayments,
          freeMembersUsed,
          paidMembers
        }))

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

        // Load subscription data and visible members instead of all members
        await loadSubscriptionData()
        await loadVisibleMembers()
      } catch (e: any) {
        console.error("Error loading dashboard data:", e)
        toast({
          title: "Error",
          description: "Failed to load dashboard data. Please refresh the page.",
          variant: "destructive",
        })
      }
    }

    load()
  }, [toast])

  // Reload subscription data when gymId changes
  useEffect(() => {
    if (gymId) {
      loadSubscriptionData()
      loadVisibleMembers()
      loadTodaysCheckIns()
    }
  }, [gymId])

  // Load revenue data when tab changes
  useEffect(() => {
    if (gymId && activeTab === 'revenue') {
      loadEnhancedRevenueData(revenueTimeFilter)
    }
  }, [gymId, activeTab, revenueTimeFilter])

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

    // Set loading state
    setIsAddingMemberLoading(true)

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
      try {
        json = await res.json()
      } catch {
        throw new Error("Invalid response from server")
      }

      if (!res.ok) {
        throw new Error(json.error || "Failed to create member account")
      }

      const newUserId = json.user?.id
      if (!newUserId) {
        throw new Error("User creation failed - no user ID returned")
      }

      // Get the membership that was created
      const { data: membership } = await supabase
        .from("memberships")
        .select("id")
        .eq("user_id", newUserId)
        .eq("gym_id", gymId)
        .single()

      // Calculate plan dates outside the membership check
      const startDate = new Date()
      const expiryDate = new Date()
      if (selectedPlan.duration === "monthly") {
        expiryDate.setMonth(expiryDate.getMonth() + 1)
      } else {
        const months = parseInt(selectedPlan.duration.split(" ")[0]) || 1
        expiryDate.setMonth(expiryDate.getMonth() + months)
      }
      const expiryDateStr = expiryDate.toISOString().split("T")[0]

      if (membership) {
        // Update membership with plan details
        await supabase
          .from("memberships")
          .update({ 
            plan_id: selectedPlan.id, 
            start_date: startDate.toISOString().split("T")[0], 
            expiry_date: expiryDateStr,
            payment_status: "paid",
            is_active: true
          })
          .eq("id", membership.id)

        // Create payment record for the new member with proper validation
        const paymentData = {
          user_id: newUserId,
          gym_id: gymId,
          membership_id: membership.id,
          amount_inr: Number(selectedPlan.price) || 0,
          payment_method: "cash", // Default to cash for manually added members
          payment_status: "completed",
          payment_date: new Date().toISOString(),
          // Remove transaction_id as it doesn't exist in the schema
        }

        // Validate required fields before insertion
        if (!paymentData.user_id || !paymentData.gym_id || !paymentData.membership_id) {
          throw new Error("Missing required payment data: user_id, gym_id, or membership_id")
        }

        const { error: paymentError } = await supabase.from("payments").insert(paymentData)

        if (paymentError) {
        console.error("Error creating payment record:", {
          error: paymentError,
          message: paymentError.message,
          details: paymentError.details,
          hint: paymentError.hint,
          code: paymentError.code,
          paymentData: paymentData
        })
        // Don't throw here - member creation succeeded, payment record is optional
        console.warn("Payment record creation failed, but member was created successfully")
      } else {
        // Refresh revenue data if revenue tab is active
        if (activeTab === "revenue") {
          await loadEnhancedRevenueData(revenueTimeFilter)
        }
      }
      }

      // Refresh data after adding member
      await loadSubscriptionData()
      await loadVisibleMembers()
      
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
          planEndDate: expiryDateStr,
          paymentStatus: "paid", // Set as paid since we created payment record
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
        description: `Account created for ${newMember.name} with ${selectedPlan.name} plan. Default password: 123456.`,
      })
    } catch (err: any) {
      console.error("Full addMember error:", err)
      toast({ 
        title: "Failed to add member", 
        description: err.message || "An unexpected error occurred", 
        variant: "destructive" 
      })
    } finally {
      // Reset loading state
      setIsAddingMemberLoading(false)
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
    setIsEditingPayment(false)
    setOriginalPlanEndDate(member.planEndDate)
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

  // Member deletion functions
  const openMemberDeleteDialog = (member: any) => {
    setMemberToDelete(member)
    setMemberDeleteConfirmOpen(true)
  }
  
  const handleFirstConfirmation = () => {
    setMemberDeleteConfirmOpen(false)
    setMemberSecondConfirmOpen(true)
  }
  
  const handleSecondConfirmation = async () => {
    if (!memberToDelete || !gymId) return
    
    setIsDeletingMember(true)
    
    try {
      // Delete member's membership record
      const { error: membershipError } = await supabase
        .from('memberships')
        .delete()
        .eq('user_id', memberToDelete.id)
        .eq('gym_id', gymId)
      
      if (membershipError) throw membershipError
      
      // Delete related records (payments, check-ins, coin transactions)
      await Promise.all([
        supabase.from('payments').delete().eq('user_id', memberToDelete.id).eq('gym_id', gymId),
        supabase.from('check_ins').delete().eq('user_id', memberToDelete.id).eq('gym_id', gymId),
        supabase.from('coin_transactions').delete().eq('user_id', memberToDelete.id).eq('gym_id', gymId)
      ])
      
      // Update UI state
      setMembers(prev => prev.filter(member => member.id !== memberToDelete.id))
      
      // Refresh data
      await loadSubscriptionData()
      await loadVisibleMembers()
      
      // Update gymData with new member count
      setGymData(prev => ({
        ...prev,
        totalMembers: prev.totalMembers + 1,
        activeMembers: prev.activeMembers + 1
      }))
      
      toast({
        title: "Member Deleted Successfully",
        description: `${memberToDelete.name} has been removed from your gym.`,
      })
      
    } catch (error: any) {
      console.error('Error deleting member:', error)
      toast({
        title: "Failed to Delete Member",
        description: error.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeletingMember(false)
      setMemberSecondConfirmOpen(false)
      setMemberToDelete(null)
    }
  }
  
  const cancelMemberDeletion = () => {
    setMemberDeleteConfirmOpen(false)
    setMemberSecondConfirmOpen(false)
    setMemberToDelete(null)
  }
  
  // Payment dialog edit functions
  const toggleEditMode = () => {
    if (!isEditingPayment) {
      setOriginalPlanEndDate(paymentData.planEndDate)
    }
    setIsEditingPayment(!isEditingPayment)
  }
  
  const validateDateFormat = (dateString: string): boolean => {
    const ddmmyyyyRegex = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-(\d{4})$/
    return ddmmyyyyRegex.test(dateString)
  }
  
  const convertDateFormat = (ddmmyyyy: string): string => {
    const [day, month, year] = ddmmyyyy.split('-')
    return `${year}-${month}-${day}`
  }
  
  const convertToDisplayFormat = (yyyymmdd: string): string => {
    const [year, month, day] = yyyymmdd.split('-')
    return `${day}-${month}-${year}`
  }
  
  const validateFutureDate = (dateString: string): boolean => {
    const inputDate = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return inputDate > today
  }
  
  const handleDateChange = (value: string) => {
    if (isEditingPayment) {
      // If in edit mode, handle DD-MM-YYYY format
      if (validateDateFormat(value)) {
        const convertedDate = convertDateFormat(value)
        if (validateFutureDate(convertedDate)) {
          setPaymentData(prev => ({ ...prev, planEndDate: convertedDate }))
        } else {
          toast({
            title: "Invalid Date",
            description: "Plan end date must be in the future.",
            variant: "destructive",
          })
        }
      } else if (value.length === 10) {
        toast({
          title: "Invalid Format",
          description: "Please use DD-MM-YYYY format.",
          variant: "destructive",
        })
      }
    }
  }

  const handleWalletRecharge = async () => {
    if (!rechargeAmount || Number.parseInt(rechargeAmount) < 10) {
      toast({
        title: "Invalid amount",
        description: "Minimum recharge amount is ₹10",
        variant: "destructive",
      })
      return
    }

    if (!gymId) {
      toast({
        title: "Error",
        description: "Gym ID not found",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/subscription/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: gymId,
          amount: Number.parseInt(rechargeAmount),
          paymentId: `manual_recharge_${Date.now()}`, // In production, this would come from payment gateway
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        toast({
          title: "Wallet Recharged!",
          description: result.message,
        })
        
        // Reload subscription data to reflect new balance
        await loadSubscriptionData()
        await loadVisibleMembers()
        
        setWalletModalOpen(false)
        setRechargeAmount("")
      } else {
        throw new Error(result.message)
      }
    } catch (error: any) {
      toast({
        title: "Recharge Failed",
        description: error.message || "Failed to recharge wallet",
        variant: "destructive",
      })
    }
  }

  const handleManualBilling = async () => {
    if (!gymId) return
    
    try {
      const response = await fetch("/api/subscription/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: gymId,
          action: "process_billing"
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        toast({
          title: "Billing Processed",
          description: result.message,
        })
        
        // Reload data
        await loadSubscriptionData()
        await loadVisibleMembers()
      } else {
        toast({
          title: "Billing Failed",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to process billing",
        variant: "destructive",
      })
    }
  }

  const handleOldWalletRecharge = async () => {
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

  const processMonthlyBilling = async () => {
    if (!gymId) return
    
    try {
      const paidMembers = Math.max(0, gymData.totalMembers - 5)
      const billingAmount = paidMembers * 10
      
      if (billingAmount > 0 && gymData.walletBalance >= billingAmount) {
        // Deduct from wallet
        const { error: walletError } = await supabase
          .from("gym_wallets")
          .update({ 
            balance_inr: gymData.walletBalance - billingAmount,
            last_billing_date: new Date().toISOString().split("T")[0]
          })
          .eq("gym_id", gymId)
        
        if (walletError) throw walletError
        
        // Record transaction
        const { error: transactionError } = await supabase
          .from("wallet_transactions")
          .insert({
            gym_id: gymId,
            transaction_type: "monthly_billing",
            amount_inr: billingAmount,
            description: `Monthly billing for ${paidMembers} paid members`
          })
        
        if (transactionError) throw transactionError
        
        toast({
          title: "Billing Processed",
          description: `₹${billingAmount} deducted for ${paidMembers} paid members`,
        })
        
        // Refresh data
        window.location.reload()
      } else if (billingAmount > gymData.walletBalance) {
        toast({
          title: "Insufficient Balance",
          description: "Please recharge your wallet to continue service",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Billing error:", error)
      toast({
        title: "Billing Failed",
        description: "Failed to process monthly billing",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black pb-20 text-white">
      {/* Modern Header with Enhanced Branding */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-gradient-to-r from-[#da1c24]/95 via-[#e63946]/95 to-[#da1c24]/95 border-b border-red-700/30 shadow-2xl">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Company Logo and Gym Name Section */}
            <div className="flex items-center gap-3">
              {/* Company Logo - Icon Only with White Border */}
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center border-2 border-white/90 shadow-lg">
                <Dumbbell className="h-6 w-6 text-white" />
              </div>
              
              {/* Dynamic Gym Name Section */}
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-transparent bg-gradient-to-r from-white via-red-100 to-white bg-clip-text tracking-tight leading-tight">
                  {gymData.gymName || 'Flexio'}
                </h1>
                <span className="text-xs text-red-100/80 font-medium tracking-wide">
                  Flexio Gym Manager
                </span>
              </div>
            </div>

            {/* Modern Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Notification Bell */}
              <Button
                variant="ghost"
                size="sm"
                className="relative text-white hover:bg-white/20 border border-white/20 rounded-xl p-2 transition-all duration-300 hover:scale-105"
                onClick={() => window.location.href = "/messages"}
              >
                <Bell className="h-4 w-4" />
                {/* Add notification badge if there are unread notifications */}
                <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  3
                </span>
              </Button>
              
              {/* Logout Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-white hover:bg-white/20 border border-white/20 rounded-xl px-3 py-2 transition-all duration-300 hover:scale-105 group"
              >
                <LogOut className="h-4 w-4 mr-2 group-hover:translate-x-0.5 transition-transform duration-300" />
                <span className="font-medium">Logout</span>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
      </header>

      <main className="px-4 py-6 pt-20">
        <div className="max-w-md mx-auto">
          {isLoadingSubscription ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            gymData.gymName && (
              <div className="space-y-6">

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            {/* TabsList removed - navigation now handled by footer */}

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Updated Stats Grid - Only show Total Members and Today's Check-ins */}
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
                        <CheckCircle className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-white">{gymData.todaysCheckIns || 0}</p>
                        <p className="text-sm text-gray-300">Today's Check-ins</p>
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
                        {gymData.paidMembers || 0}
                        {gymData.hiddenMembers > 0 && (
                          <span className="text-xs text-red-400 ml-1">
                            ({gymData.hiddenMembers} hidden)
                          </span>
                        )}
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
                    <p className="text-xs text-gray-400 mb-1">
                      Date: {gymData.nextBillingDate || 'Not set'}
                    </p>
                    <p className="text-xs text-gray-400">
                      Charge: ₹10 × {gymData.paidMembers || 0} paid members = ₹
                      {10 * (gymData.paidMembers || 0)}
                    </p>
                  </div>

                  {/* Hidden Members Warning */}
                  {gymData.hiddenMembers > 0 && (
                    <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
                      <p className="text-sm text-red-300">
                        <AlertCircle className="h-4 w-4 inline mr-1" />
                        {gymData.hiddenMembers} members are hidden due to low balance. Recharge to unhide.
                      </p>
                      <p className="text-xs text-red-400 mt-1">
                        Required: ₹{gymData.requiredAmount} to show all members
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
                            {safeNumber(member.currentStreak) || 
                              // Use deterministic value based on member ID instead of random
                              safeNumber(((parseInt(String(member.id || '').slice(-8), 16) || 0) * 7) % 20) + 1
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
                            disabled={isAddingMemberLoading}
                            className="flex-1 bg-transparent border-white text-white hover:bg-white hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            variant="outline"
                          >
                            {isAddingMemberLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Adding Member
                              </>
                            ) : (
                              "Add Member"
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setIsAddingMember(false)}
                            disabled={isAddingMemberLoading}
                            className="flex-1 bg-transparent border-white text-white hover:bg-white hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
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
                              <Button
                                onClick={() => openMemberDeleteDialog(member)}
                                size="sm"
                                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border-0 px-2 py-2 text-xs"
                              >
                                <Trash2 className="h-3 w-3" />
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

              {/* First Member Delete Confirmation Dialog */}
              <Dialog open={memberDeleteConfirmOpen} onOpenChange={setMemberDeleteConfirmOpen}>
                <DialogContent className="bg-gray-800 border-gray-700 max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Delete Member
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                      Are you sure you want to delete {memberToDelete?.name}?
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={cancelMemberDeletion}
                      variant="outline"
                      className="flex-1 border-gray-600 hover:bg-gray-700 text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleFirstConfirmation}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      Yes, Delete
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Second Member Delete Confirmation Dialog */}
              <Dialog open={memberSecondConfirmOpen} onOpenChange={setMemberSecondConfirmOpen}>
                <DialogContent className="bg-gray-800 border-gray-700 max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Final Confirmation
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                      This action cannot be undone. Confirm deletion of {memberToDelete?.name}?
                      <br /><br />
                      <span className="text-red-400 font-medium">
                        All member data, payments, check-ins, and coins will be permanently deleted.
                      </span>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={cancelMemberDeletion}
                      variant="outline"
                      className="flex-1 border-gray-600 hover:bg-gray-700 text-white"
                      disabled={isDeletingMember}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSecondConfirmation}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      disabled={isDeletingMember}
                    >
                      {isDeletingMember ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        'Confirm Deletion'
                      )}
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
                    <Button
                      onClick={toggleEditMode}
                      size="sm"
                      variant="outline"
                      className="ml-auto border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      {isEditingPayment ? 'Cancel Edit' : 'Edit'}
                    </Button>
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
                    <Label htmlFor="planEndDate" className="text-white flex items-center gap-2">
                      Current Plan End Date
                      {isEditingPayment && (
                        <Badge variant="secondary" className="text-xs">
                          DD-MM-YYYY
                        </Badge>
                      )}
                    </Label>
                    {isEditingPayment ? (
                      <Input
                        id="planEndDate"
                        type="text"
                        placeholder="DD-MM-YYYY"
                        value={paymentData.planEndDate ? convertToDisplayFormat(paymentData.planEndDate) : ''}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                        maxLength={10}
                      />
                    ) : (
                      <Input
                        id="planEndDate"
                        type="date"
                        value={paymentData.planEndDate}
                        className="bg-gray-700 border-gray-600 text-white"
                        disabled
                      />
                    )}
                    <p className="text-xs text-gray-400">
                      {isEditingPayment
                        ? "Enter date in DD-MM-YYYY format. Date must be in the future."
                        : "Plan will be automatically extended based on selected plan duration when payment is marked as paid."}
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
                    onClick={() => {
                      setPaymentModalOpen(false)
                      setIsEditingPayment(false)
                    }}
                    className="flex-1 bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                  >
                    Cancel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Revenue Tab */}
            <TabsContent value="revenue" className="space-y-6">
              {/* Revenue Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">Total Revenue</p>
                        <p className="text-2xl font-bold text-white">
                          ₹{revenueStats.totalRevenue.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-2 bg-green-600/20 rounded-lg">
                        <IndianRupee className="h-5 w-5 text-green-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">Average Revenue</p>
                        <p className="text-2xl font-bold text-white">
                          ₹{Math.round(revenueStats.averageRevenue).toLocaleString()}
                        </p>
                      </div>
                      <div className="p-2 bg-blue-600/20 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-blue-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">Growth Rate</p>
                        <p className={`text-2xl font-bold ${
                          revenueStats.growth >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {revenueStats.growth >= 0 ? '+' : ''}{revenueStats.growth.toFixed(1)}%
                        </p>
                      </div>
                      <div className={`p-2 rounded-lg ${
                        revenueStats.growth >= 0 ? 'bg-green-600/20' : 'bg-red-600/20'
                      }`}>
                        <TrendingUp className={`h-5 w-5 ${
                          revenueStats.growth >= 0 ? 'text-green-400' : 'text-red-400'
                        }`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">Transactions</p>
                        <p className="text-2xl font-bold text-white">
                          {revenueStats.transactionCount}
                        </p>
                      </div>
                      <div className="p-2 bg-purple-600/20 rounded-lg">
                        <CreditCard className="h-5 w-5 text-purple-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Interactive Revenue Chart */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg text-white">Revenue Trends</CardTitle>
                      <CardDescription className="text-gray-400">
                        Interactive revenue visualization with time filters
                      </CardDescription>
                    </div>
                    <Select value={revenueTimeFilter} onValueChange={setRevenueTimeFilter}>
                      <SelectTrigger className="w-[180px] bg-gray-700 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="7days" className="text-white hover:bg-gray-700">
                          Last 7 Days
                        </SelectItem>
                        <SelectItem value="1month" className="text-white hover:bg-gray-700">
                          Last Month
                        </SelectItem>
                        <SelectItem value="3months" className="text-white hover:bg-gray-700">
                          Last 3 Months
                        </SelectItem>
                        <SelectItem value="6months" className="text-white hover:bg-gray-700">
                          Last 6 Months
                        </SelectItem>
                        <SelectItem value="1year" className="text-white hover:bg-gray-700">
                          Last Year
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingRevenue ? (
                    <div className="h-80 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : chartData.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis 
                            dataKey="period" 
                            stroke="#9ca3af"
                            fontSize={12}
                            tickFormatter={(value) => {
                            try {
                              const date = new Date(value)
                              if (isNaN(date.getTime())) return value
                              if (revenueTimeFilter === '7days' || revenueTimeFilter === '1month') {
                                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              } else {
                                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                              }
                            } catch {
                              return value
                            }
                          }}
                          />
                          <YAxis 
                            stroke="#9ca3af"
                            fontSize={12}
                            tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                          />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: '#1f2937',
                              border: '1px solid #374151',
                              borderRadius: '8px',
                              color: '#ffffff'
                            }}
                            formatter={(value: any) => [`₹${safeNumber(value, 0).toLocaleString()}`, 'Revenue']}
                            labelFormatter={(label: any) => {
                              const date = new Date(label)
                              if (isNaN(date.getTime())) return label
                              return date.toLocaleDateString()
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="#10b981"
                            strokeWidth={2}
                            fill="url(#revenueGradient)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center bg-gray-700/30 rounded-lg">
                      <div className="text-center">
                        <TrendingUp className="h-12 w-12 text-gray-500 mx-auto mb-2" />
                        <p className="text-white font-medium">No Revenue Data</p>
                        <p className="text-gray-400 text-sm">No payments found for the selected period</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Revenue Breakdown and Recent Transactions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Breakdown by Plan */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg text-white">Revenue by Plan</CardTitle>
                    <CardDescription className="text-gray-400">
                      Revenue distribution across membership plans
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {revenueBreakdown.length > 0 ? (
                      <div className="space-y-4">
                        {revenueBreakdown.map((plan, index) => (
                          <div key={plan.planName} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full`} style={{
                                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]
                              }} />
                              <span className="text-white font-medium">{plan.planName}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-bold">₹{plan.revenue.toLocaleString()}</p>
                              <p className="text-xs text-gray-400">
                                {plan.transactionCount || 0} transactions
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <CreditCard className="h-12 w-12 text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-400">No plan revenue data available</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Transactions */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg text-white">Recent Transactions</CardTitle>
                    <CardDescription className="text-gray-400">
                      Latest payment transactions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {paymentTransactions.length > 0 ? (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {paymentTransactions.map((transaction, index) => (
                          <div key={transaction.id || index} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors">
                            <div className="flex-1">
                              <p className="text-white font-medium text-sm">
                                {transaction.users?.full_name || 'Unknown Member'}
                              </p>
                              <p className="text-gray-400 text-xs">
                                {transaction.memberships?.gym_plans?.plan_name || 'Unknown Plan'}
                              </p>
                              <p className="text-gray-500 text-xs">
                                {new Date(transaction.payment_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-green-400 font-bold text-sm">
                                ₹{Number(transaction.amount_inr || 0).toLocaleString()}
                              </p>
                              <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                                {transaction.payment_method || 'cash'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <MessageSquare className="h-12 w-12 text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-400">No recent transactions</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
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
                {/* Gym Code Section */}
                <Card className="bg-gray-800/50 border border-gray-700 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Gym Code</CardTitle>
                    <CardDescription className="text-gray-300">Share this code with new members to join your gym</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 px-4 py-2 text-lg font-mono"
                      >
                        {gymData.gymCode}
                      </Badge>
                      <Button
                        onClick={copyGymCode}
                        className="bg-transparent border border-white text-white hover:bg-white hover:text-gray-900"
                        size="sm"
                      >
                        Copy Code
                      </Button>
                    </div>
                    <p className="text-gray-400 text-sm">
                      New members can use this code during registration to join {gymData.gymName}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border border-gray-700 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Coin Value Settings</CardTitle>
                    <CardDescription className="text-gray-300">Set how much each coin is worth in INR</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-white">Coin Value (INR)</Label>
                      <div className="flex gap-2 mt-2">
                        {isEditingCoinValue ? (
                          <>
                            <Input
                              type="number"
                              step="0.1"
                              value={tempCoinValue}
                              onChange={(e) => setTempCoinValue(e.target.value)}
                              placeholder="4.0"
                              className="bg-gray-700 border-gray-600 text-white"
                            />
                            <Button
                              onClick={saveCoinValue}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              Save
                            </Button>
                            <Button
                              onClick={cancelCoinValueEdit}
                              variant="outline"
                              className="border-gray-600 text-white hover:bg-gray-700 bg-transparent"
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Input
                              type="number"
                              step="0.1"
                              value={gymData.coinValue.toString()}
                              readOnly
                              className="bg-gray-700 border-gray-600 text-white"
                            />
                            <Button
                              onClick={handleCoinValueEdit}
                              className="bg-transparent border border-white text-white hover:bg-white hover:text-gray-900"
                            >
                              Edit
                            </Button>
                          </>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm mt-1">Current: 1 coin = ₹{gymData.coinValue.toFixed(2)}</p>
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
                      {gymData.location ? (
                        <p className="text-gray-300">
                          Lat: {gymData.location.lat.toFixed(6)}, Lng: {gymData.location.lng.toFixed(6)}
                        </p>
                      ) : (
                        <p className="text-gray-300">Location not set</p>
                      )}
                    </div>
                    <Button
                      onClick={updateGymLocation}
                      disabled={isGettingLocation}
                      className="bg-transparent border border-white text-white hover:bg-white hover:text-gray-900"
                    >
                      {isGettingLocation ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Getting Location...
                        </>
                      ) : (
                        <>
                          <MapPin className="h-4 w-4 mr-2" />
                          Update Location
                        </>
                      )}
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
                      <Button
                        onClick={() => toggleNotificationSetting('paymentReminders')}
                        variant="outline"
                        className={`border-gray-600 hover:bg-gray-700 bg-transparent ${
                          notificationSettings.paymentReminders
                            ? 'text-green-400 border-green-400'
                            : 'text-gray-400 border-gray-600'
                        }`}
                      >
                        {notificationSettings.paymentReminders ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white">Birthday Notifications</p>
                        <p className="text-gray-300 text-sm">Get notified about member birthdays</p>
                      </div>
                      <Button
                        onClick={() => toggleNotificationSetting('birthdayNotifications')}
                        variant="outline"
                        className={`border-gray-600 hover:bg-gray-700 bg-transparent ${
                          notificationSettings.birthdayNotifications
                            ? 'text-green-400 border-green-400'
                            : 'text-gray-400 border-gray-600'
                        }`}
                      >
                        {notificationSettings.birthdayNotifications ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
                </div>
              )
            )}
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
                  className="border-gray-600 hover:bg-gray-700 hover:text-white text-white"
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
                className="flex-1 border-gray-600 hover:bg-gray-700 text-white"
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

      {/* Enhanced Footer Navigation - Matching Header Design */}
      <div className="fixed bottom-0 left-0 right-0 backdrop-blur-xl bg-gradient-to-r from-[#da1c24]/95 via-[#e63946]/95 to-[#da1c24]/95 border-t border-red-700/30 shadow-2xl z-50">
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center justify-around py-3">
            {/* Home */}
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-xl transition-all duration-300 hover:scale-105 ${
                activeTab === "overview" 
                  ? "bg-white/20 text-white shadow-lg" 
                  : "text-red-100/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <Home className="h-5 w-5" />
              <span className="text-xs font-medium tracking-wide">Home</span>
            </button>

            {/* Plans */}
            <button
              onClick={() => setActiveTab("plans")}
              className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-xl transition-all duration-300 hover:scale-105 ${
                activeTab === "plans" 
                  ? "bg-white/20 text-white shadow-lg" 
                  : "text-red-100/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <CreditCard className="h-5 w-5" />
              <span className="text-xs font-medium tracking-wide">Plans</span>
            </button>

            {/* Revenue */}
            <button
              onClick={() => setActiveTab("revenue")}
              className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-xl transition-all duration-300 hover:scale-105 ${
                activeTab === "revenue" 
                  ? "bg-white/20 text-white shadow-lg" 
                  : "text-red-100/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <BarChart3 className="h-5 w-5" />
              <span className="text-xs font-medium tracking-wide">Revenue</span>
            </button>

            {/* Members */}
            <button
              onClick={() => setActiveTab("members")}
              className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-xl transition-all duration-300 hover:scale-105 ${
                activeTab === "members" 
                  ? "bg-white/20 text-white shadow-lg" 
                  : "text-red-100/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <Users className="h-5 w-5" />
              <span className="text-xs font-medium tracking-wide">Members</span>
            </button>

            {/* Settings */}
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-xl transition-all duration-300 hover:scale-105 ${
                activeTab === "settings" 
                  ? "bg-white/20 text-white shadow-lg" 
                  : "text-red-100/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <Settings className="h-5 w-5" />
              <span className="text-xs font-medium tracking-wide">Settings</span>
            </button>
          </div>
        </div>
        
        {/* Subtle gradient overlay matching header */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
      </div>

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
