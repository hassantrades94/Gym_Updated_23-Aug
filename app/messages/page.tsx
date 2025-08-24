"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Bell,
  Filter,
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2,
  ArrowLeft,
  MessageSquare,
  Users,
  Calendar,
  Loader2,
  Eye,
  EyeOff,
  CreditCard,
  FilterX
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"

type NotificationType = "system" | "member" | "payment" | "maintenance" | "promotion"
type NotificationPriority = "low" | "medium" | "high" | "urgent"

type PaymentNotification = {
  id: string
  payerName: string
  planName: string
  amount: number
  paymentDate: string
  paymentStatus: "completed" | "pending" | "failed"
  subscriptionType: string
  duration: string
}

type Notification = {
  id: string
  title: string
  message: string
  type: NotificationType
  priority: NotificationPriority
  timestamp: string
  isRead: boolean
  actionRequired: boolean
  relatedUserId?: string
  relatedUserName?: string
  paymentDetails?: PaymentNotification
}

export default function MessagesPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([])
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<"owner" | "member">("owner")
  const [gymId, setGymId] = useState<string | null>(null)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isFilterExpanded, setIsFilterExpanded] = useState(false)

  // Load notifications on component mount
  useEffect(() => {
    loadNotifications()
    
    // Set up real-time subscription for payment updates
    const paymentSubscription = supabase
      .channel('payment_notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments'
        },
        (payload) => {
          console.log('Payment update received:', payload)
          // Reload notifications when payment data changes
          loadNotifications()
        }
      )
      .subscribe()

    return () => {
      paymentSubscription.unsubscribe()
    }
  }, [])

  // Filter notifications when filter criteria change
  useEffect(() => {
    filterNotifications()
  }, [notifications, typeFilter, priorityFilter, showUnreadOnly])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const user = getCurrentUser()
      if (!user) {
        router.push("/auth/signin")
        return
      }

      // Determine user role and gym ID
      const { data: gymData } = await supabase
        .from("gyms")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle()

      if (gymData) {
        setUserRole("owner")
        setGymId(gymData.id)
        await loadOwnerNotifications(gymData.id)
      } else {
        setUserRole("member")
        await loadMemberNotifications(user.id)
      }
    } catch (error) {
      console.error("Error loading notifications:", error)
      toast({
        title: "Error",
        description: "Failed to load notifications",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadOwnerNotifications = async (gymId: string) => {
    try {
      // Load real notifications from various sources
      const [membershipData, paymentData, systemData] = await Promise.all([
        loadMembershipNotifications(gymId),
        loadLivePaymentNotifications(gymId),
        loadSystemNotifications(gymId)
      ])

      const allNotifications = [...membershipData, ...paymentData, ...systemData]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setNotifications(allNotifications)
    } catch (error) {
      console.error("Error loading owner notifications:", error)
    }
  }

  const loadMembershipNotifications = async (gymId: string): Promise<Notification[]> => {
    const { data: memberships } = await supabase
      .from("gym_memberships")
      .select(`
        id,
        expiry_date,
        users!inner(full_name)
      `)
      .eq("gym_id", gymId)
      .eq("is_active", true)

    const notifications: Notification[] = []
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    memberships?.forEach((membership) => {
      const expiryDate = new Date(membership.expiry_date)
      if (expiryDate <= sevenDaysFromNow && expiryDate > now) {
        notifications.push({
          id: `membership-${membership.id}`,
          title: "Membership Expiring Soon",
          message: `${membership.users.full_name}'s membership expires on ${expiryDate.toLocaleDateString()}`,
          type: "member",
          priority: "medium",
          timestamp: new Date().toISOString(),
          isRead: false,
          actionRequired: true,
          relatedUserName: membership.users.full_name
        })
      }
    })

    return notifications
  }

  const loadLivePaymentNotifications = async (gymId: string): Promise<Notification[]> => {
    try {
      // Load all recent payments with comprehensive data
      const { data: payments, error } = await supabase
        .from("payments")
        .select(`
          id,
          amount_inr,
          payment_status,
          payment_date,
          created_at,
          users!inner(
            id,
            full_name,
            phone_number
          ),
          memberships!inner(
            id,
            gym_plans!inner(
              id,
              plan_name,
              duration_months,
              price_inr
            )
          )
        `)
        .eq("gym_id", gymId)
        .order("payment_date", { ascending: false })
        .limit(50)

      if (error) {
        console.error("Error loading payments:", error)
        return []
      }

      const notifications: Notification[] = []

      payments?.forEach((payment) => {
        const paymentDetails: PaymentNotification = {
          id: payment.id,
          payerName: payment.users.full_name,
          planName: payment.memberships.gym_plans.plan_name,
          amount: payment.amount_inr,
          paymentDate: payment.payment_date || payment.created_at,
          paymentStatus: payment.payment_status as "completed" | "pending" | "failed",
          subscriptionType: payment.memberships.gym_plans.plan_name,
          duration: `${payment.memberships.gym_plans.duration_months} months`
        }

        // Create notifications based on payment status
        if (payment.payment_status === "completed") {
          notifications.push({
            id: `payment-success-${payment.id}`,
            title: "Payment Received",
            message: `₹${payment.amount_inr.toLocaleString()} payment received from ${payment.users.full_name} for ${payment.memberships.gym_plans.plan_name}`,
            type: "payment",
            priority: "low",
            timestamp: payment.payment_date || payment.created_at,
            isRead: false,
            actionRequired: false,
            relatedUserName: payment.users.full_name,
            paymentDetails
          })
        } else if (payment.payment_status === "pending") {
          notifications.push({
            id: `payment-pending-${payment.id}`,
            title: "Pending Payment",
            message: `Payment of ₹${payment.amount_inr.toLocaleString()} from ${payment.users.full_name} requires approval`,
            type: "payment",
            priority: "high",
            timestamp: payment.payment_date || payment.created_at,
            isRead: false,
            actionRequired: true,
            relatedUserName: payment.users.full_name,
            paymentDetails
          })
        } else if (payment.payment_status === "failed") {
          notifications.push({
            id: `payment-failed-${payment.id}`,
            title: "Payment Failed",
            message: `Payment of ₹${payment.amount_inr.toLocaleString()} from ${payment.users.full_name} has failed`,
            type: "payment",
            priority: "urgent",
            timestamp: payment.payment_date || payment.created_at,
            isRead: false,
            actionRequired: true,
            relatedUserName: payment.users.full_name,
            paymentDetails
          })
        }
      })

      return notifications
    } catch (error) {
      console.error("Error loading live payment notifications:", error)
      return []
    }
  }

  const loadSystemNotifications = async (gymId: string): Promise<Notification[]> => {
    // Add system notifications like low wallet balance, subscription issues, etc.
    const { data: gymData } = await supabase
      .from("gyms")
      .select("wallet_balance, subscription_status")
      .eq("id", gymId)
      .single()

    const notifications: Notification[] = []

    if (gymData?.wallet_balance < 100) {
      notifications.push({
        id: "low-balance",
        title: "Low Wallet Balance",
        message: `Your wallet balance is ₹${gymData.wallet_balance}. Please recharge to avoid service interruption.`,
        type: "system",
        priority: "urgent",
        timestamp: new Date().toISOString(),
        isRead: false,
        actionRequired: true
      })
    }

    return notifications
  }

  const loadMemberNotifications = async (userId: string) => {
    // Load member-specific notifications
    const mockMemberNotifications: Notification[] = [
      {
        id: "welcome",
        title: "Welcome to the Gym!",
        message: "Your membership has been activated. Enjoy your fitness journey!",
        type: "system",
        priority: "low",
        timestamp: new Date().toISOString(),
        isRead: false,
        actionRequired: false
      }
    ]
    setNotifications(mockMemberNotifications)
  }

  const filterNotifications = () => {
    let filtered = notifications

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((notification) => notification.type === typeFilter)
    }

    // Priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter((notification) => notification.priority === priorityFilter)
    }

    // Unread filter
    if (showUnreadOnly) {
      filtered = filtered.filter((notification) => !notification.isRead)
    }

    setFilteredNotifications(filtered)
  }

  const markAsRead = async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification
      )
    )
  }

  const markAllAsRead = async () => {
    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, isRead: true }))
    )
    toast({
      title: "All notifications marked as read",
      description: "All notifications have been marked as read",
    })
  }

  const deleteNotification = async (notificationId: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== notificationId))
    toast({
      title: "Notification deleted",
      description: "Notification has been removed",
    })
  }

  const clearAllFilters = () => {
    setTypeFilter("all")
    setPriorityFilter("all")
    setShowUnreadOnly(false)
  }

  const getPriorityColor = (priority: NotificationPriority) => {
    switch (priority) {
      case "urgent":
        return "bg-red-600 text-white"
      case "high":
        return "bg-orange-600 text-white"
      case "medium":
        return "bg-yellow-600 text-white"
      case "low":
        return "bg-blue-600 text-white"
      default:
        return "bg-gray-600 text-white"
    }
  }

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case "system":
        return <Bell className="h-4 w-4" />
      case "member":
        return <Users className="h-4 w-4" />
      case "payment":
        return <CreditCard className="h-4 w-4" />
      case "maintenance":
        return <AlertCircle className="h-4 w-4" />
      case "promotion":
        return <MessageSquare className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const formatPaymentDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return "Today"
    if (diffDays === 2) return "Yesterday"
    if (diffDays <= 7) return `${diffDays - 1} days ago`
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    })
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length
  const paymentCount = notifications.filter((n) => n.type === "payment").length
  const hasActiveFilters = typeFilter !== "all" || priorityFilter !== "all" || showUnreadOnly

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-4" />
          <p className="text-white">Loading notifications...</p>
        </div>
      </div>
    )
  }

  // Enhanced back button handler
  const handleBackNavigation = () => {
    if (window.history.length > 1) {
      router.back()
    } else {
      // Fallback navigation based on user role
      if (userRole === "owner") {
        router.push("/owner/dashboard")
      } else {
        router.push("/member/dashboard")
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black pb-20 text-white">
      {/* Mobile-Optimized Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-gradient-to-r from-[#da1c24]/95 via-[#e63946]/95 to-[#da1c24]/95 border-b border-red-700/30 shadow-2xl">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackNavigation}
                className="text-white hover:bg-white/20 border border-white/20 rounded-xl p-2 transition-all duration-300 hover:scale-105 touch-manipulation"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex flex-col">
                <h1 className="text-lg font-bold text-transparent bg-gradient-to-r from-white via-red-100 to-white bg-clip-text tracking-tight">
                  Notifications
                </h1>
                <div className="flex items-center gap-2 text-xs text-red-100/80">
                  <span>{unreadCount} unread</span>
                  <span>•</span>
                  <span>{paymentCount} payments</span>
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="text-white hover:bg-white/20 border border-white/20 rounded-xl px-3 py-1.5 text-xs transition-all duration-300 hover:scale-105 disabled:opacity-50 touch-manipulation"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Mark All Read
            </Button>
          </div>
        </div>
        
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
      </header>

      <main className="px-4 py-4">
        <div className="max-w-md mx-auto space-y-4">
          {/* Simplified Filters - Only Two Filters */}
          <Card className="bg-gray-800/50 border border-gray-700 backdrop-blur-sm">
            <CardContent className="p-3 space-y-3">
              {/* Filter Toggle */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                  className="text-gray-300 hover:text-white hover:bg-gray-700/50 p-2 h-8 text-xs touch-manipulation"
                >
                  <Filter className="h-3 w-3 mr-1" />
                  Filters
                  {hasActiveFilters && (
                    <Badge className="ml-2 h-4 w-4 p-0 bg-red-600 text-white text-xs flex items-center justify-center">
                      !
                    </Badge>
                  )}
                </Button>
                
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-2 h-8 text-xs touch-manipulation"
                  >
                    <FilterX className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              {/* Expandable Filters - Only Two Filters */}
              {isFilterExpanded && (
                <div className="space-y-3 pt-2 border-t border-gray-600">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white h-9 text-xs touch-manipulation">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="all" className="text-white hover:bg-gray-700 text-xs">All Types</SelectItem>
                        <SelectItem value="payment" className="text-white hover:bg-gray-700 text-xs">Payments</SelectItem>
                        <SelectItem value="member" className="text-white hover:bg-gray-700 text-xs">Members</SelectItem>
                        <SelectItem value="system" className="text-white hover:bg-gray-700 text-xs">System</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white h-9 text-xs touch-manipulation">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="all" className="text-white hover:bg-gray-700 text-xs">All Priorities</SelectItem>
                        <SelectItem value="urgent" className="text-white hover:bg-gray-700 text-xs">Urgent</SelectItem>
                        <SelectItem value="high" className="text-white hover:bg-gray-700 text-xs">High</SelectItem>
                        <SelectItem value="medium" className="text-white hover:bg-gray-700 text-xs">Medium</SelectItem>
                        <SelectItem value="low" className="text-white hover:bg-gray-700 text-xs">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant={showUnreadOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                    className={`w-full h-9 text-xs touch-manipulation ${
                      showUnreadOnly 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'border-gray-600 text-gray-300 hover:bg-gray-700/50'
                    }`}
                  >
                    {showUnreadOnly ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                    {showUnreadOnly ? 'Show All' : 'Unread Only'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enhanced Notifications List */}
          {filteredNotifications.length === 0 ? (
            <Card className="bg-gray-800/50 border border-gray-700 backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <Bell className="h-10 w-10 text-gray-500 mx-auto mb-3" />
                <h3 className="text-base font-medium text-white mb-2">No notifications found</h3>
                <p className="text-sm text-gray-400">
                  {hasActiveFilters
                    ? "Try adjusting your filters"
                    : "You're all caught up!"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`bg-gray-800/50 border backdrop-blur-sm hover:bg-gray-800/70 transition-all duration-300 cursor-pointer touch-manipulation ${
                    notification.isRead ? 'border-gray-700' : 'border-red-500/50 bg-red-900/10'
                  }`}
                  onClick={() => {
                    setSelectedNotification(notification)
                    setIsDetailModalOpen(true)
                    if (!notification.isRead) {
                      markAsRead(notification.id)
                    }
                  }}
                >
                  <CardContent className="p-3">
                    {/* Payment Notification Enhanced Layout */}
                    {notification.type === "payment" && notification.paymentDetails ? (
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                              notification.paymentDetails.paymentStatus === "completed" 
                                ? 'bg-green-600/20 text-green-400' 
                                : notification.paymentDetails.paymentStatus === "pending"
                                ? 'bg-orange-600/20 text-orange-400'
                                : 'bg-red-600/20 text-red-400'
                            }`}>
                              {notification.paymentDetails.paymentStatus === "completed" ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : notification.paymentDetails.paymentStatus === "pending" ? (
                                <Clock className="h-4 w-4" />
                              ) : (
                                <AlertCircle className="h-4 w-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className={`font-medium text-sm truncate ${
                                  notification.isRead ? 'text-gray-300' : 'text-white'
                                }`}>
                                  {notification.paymentDetails.payerName}
                                </h3>
                                {!notification.isRead && (
                                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mb-1">
                                {notification.paymentDetails.planName} • {notification.paymentDetails.duration}
                              </p>
                              <div className="flex items-center justify-between">
                                <span className={`text-sm font-semibold ${
                                  notification.paymentDetails.paymentStatus === "completed" 
                                    ? 'text-green-400' 
                                    : notification.paymentDetails.paymentStatus === "pending"
                                    ? 'text-orange-400'
                                    : 'text-red-400'
                                }`}>
                                  ₹{notification.paymentDetails.amount.toLocaleString()}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatPaymentDate(notification.paymentDetails.paymentDate)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteNotification(notification.id)
                            }}
                            className="text-gray-400 hover:text-red-400 hover:bg-red-900/20 p-1 h-auto flex-shrink-0 touch-manipulation"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs px-2 py-0.5 ${
                            notification.paymentDetails.paymentStatus === "completed" 
                              ? 'bg-green-600 text-white' 
                              : notification.paymentDetails.paymentStatus === "pending"
                              ? 'bg-orange-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}>
                            {notification.paymentDetails.paymentStatus.toUpperCase()}
                          </Badge>
                          {notification.actionRequired && (
                            <Badge variant="outline" className="text-xs px-2 py-0.5 border-orange-500 text-orange-400">
                              Action Required
                            </Badge>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Standard Notification Layout */
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                            notification.isRead ? 'bg-gray-700' : 'bg-red-600/20'
                          }`}>
                            {getTypeIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className={`font-medium text-sm truncate ${
                                notification.isRead ? 'text-gray-300' : 'text-white'
                              }`}>
                                {notification.title}
                              </h3>
                              {!notification.isRead && (
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                              )}
                            </div>
                            <p className={`text-xs line-clamp-2 mb-2 ${
                              notification.isRead ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge className={`text-xs px-2 py-0.5 ${getPriorityColor(notification.priority)}`}>
                                {notification.priority.toUpperCase()}
                              </Badge>
                              {notification.actionRequired && (
                                <Badge variant="outline" className="text-xs px-2 py-0.5 border-orange-500 text-orange-400">
                                  Action Required
                                </Badge>
                              )}
                              <span className="text-xs text-gray-500 ml-auto">
                                {formatPaymentDate(notification.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteNotification(notification.id)
                          }}
                          className="text-gray-400 hover:text-red-400 hover:bg-red-900/20 p-1 h-auto flex-shrink-0 touch-manipulation"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Enhanced Notification Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-sm mx-auto m-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {selectedNotification && getTypeIcon(selectedNotification.type)}
              {selectedNotification?.title}
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
              {selectedNotification && formatPaymentDate(selectedNotification.timestamp)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Payment Details */}
            {selectedNotification?.paymentDetails && (
              <div className="p-3 bg-gray-700/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Payer:</span>
                  <span className="text-sm font-medium text-white">
                    {selectedNotification.paymentDetails.payerName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Plan:</span>
                  <span className="text-sm text-white">
                    {selectedNotification.paymentDetails.planName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Duration:</span>
                  <span className="text-sm text-white">
                    {selectedNotification.paymentDetails.duration}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Amount:</span>
                  <span className="text-lg font-semibold text-green-400">
                    ₹{selectedNotification.paymentDetails.amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Status:</span>
                  <Badge className={`text-xs ${
                    selectedNotification.paymentDetails.paymentStatus === "completed" 
                      ? 'bg-green-600 text-white' 
                      : selectedNotification.paymentDetails.paymentStatus === "pending"
                      ? 'bg-orange-600 text-white'
                      : 'bg-red-600 text-white'
                  }`}>
                    {selectedNotification.paymentDetails.paymentStatus.toUpperCase()}
                  </Badge>
                </div>
              </div>
            )}
            
            <p className="text-gray-300 text-sm">{selectedNotification?.message}</p>
            
            <div className="flex items-center gap-2">
              <Badge className={`text-xs ${selectedNotification && getPriorityColor(selectedNotification.priority)}`}>
                {selectedNotification?.priority.toUpperCase()}
              </Badge>
              {selectedNotification?.actionRequired && (
                <Badge variant="outline" className="text-xs border-orange-500 text-orange-400">
                  Action Required
                </Badge>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => setIsDetailModalOpen(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white h-9 text-sm touch-manipulation"
              >
                Close
              </Button>
              {selectedNotification?.actionRequired && (
                <Button
                  onClick={() => {
                    toast({
                      title: "Action taken",
                      description: "Notification action has been processed",
                    })
                    setIsDetailModalOpen(false)
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white h-9 text-sm touch-manipulation"
                >
                  Take Action
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}