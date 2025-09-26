"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Trophy, Gift, Star, Zap, Calendar, Target } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { getCurrentUser, redirectIfNotAuthenticated } from "@/lib/auth"

export default function RewardsPage() {
  const { toast } = useToast()
  const [isRedeeming, setIsRedeeming] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [coins, setCoins] = useState(0)
  const [totalEarned, setTotalEarned] = useState(0)
  const [monthlyVisits, setMonthlyVisits] = useState(0)
  const [streak, setStreak] = useState(0)
  const [transactions, setTransactions] = useState<Array<{ date: string; type: "earned" | "spent" | "bonus"; points: number; description: string }>>([])

  useEffect(() => {
    const user = redirectIfNotAuthenticated("member")
    if (!user) return

    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const userId = user.id

        // Fetch coin transactions for user
        const { data: txData, error: txError } = await supabase
          .from("coin_transactions")
          .select("amount, transaction_type, description, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })

        if (txError) throw txError

        const total = txData?.reduce((sum, t) => sum + (t.transaction_type === "spent" ? -t.amount : t.amount), 0) || 0
        const earned = txData?.filter((t) => t.transaction_type !== "spent").reduce((s, t) => s + t.amount, 0) || 0

        setCoins(total)
        setTotalEarned(earned)
        setTransactions(
          (txData || []).map((t) => ({
            date: t.created_at,
            type: t.transaction_type,
            points: t.transaction_type === "spent" ? -t.amount : t.amount,
            description: t.description || (t.transaction_type === "earned" ? "Gym check-in" : "Coins update"),
          }))
        )

        // Fetch check-ins to compute monthly visits and streak
        const { data: checkInData, error: checkInError } = await supabase
          .from("check_ins")
          .select("check_in_time")
          .eq("user_id", userId)
          .order("check_in_time", { ascending: false })

        if (checkInError) throw checkInError

        if (checkInData && checkInData.length) {
          const now = new Date()
          const currentMonth = now.getMonth()
          const currentYear = now.getFullYear()

          const monthly = checkInData.filter((c) => {
            const d = new Date(c.check_in_time)
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear
          }).length
          setMonthlyVisits(monthly)

          // Calculate streak of consecutive days including today if applicable
          const dates = checkInData.map((c) => new Date(c.check_in_time).toDateString())
          const uniqueDates = Array.from(new Set(dates)).map((d) => new Date(d))
          uniqueDates.sort((a, b) => b.getTime() - a.getTime())

          let s = 0
          let cursor = new Date()
          cursor.setHours(0, 0, 0, 0)

          for (;;) {
            const match = uniqueDates.find((d) => d.getTime() === cursor.getTime())
            if (match) {
              s += 1
              cursor.setDate(cursor.getDate() - 1)
            } else {
              break
            }
          }
          setStreak(s)
        } else {
          setMonthlyVisits(0)
          setStreak(0)
        }
      } catch (e: any) {
        console.error(e)
        setError(e.message || "Failed to load rewards data")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const redemptionTiers = useMemo(() => [
    { id: "tier1", points: 500, value: "₹500", discount: "₹500 off next payment", available: true },
    { id: "tier2", points: 1000, value: "₹1000", discount: "₹1000 off next payment", available: true },
    { id: "tier3", points: 2000, value: "₹2000", discount: "₹2000 off next payment", available: true },
    { id: "tier4", points: 3000, value: "Free Month", discount: "Free Basic membership month", available: false },
  ], [])

  const handleRedeem = async (tierId: string, points: number) => {
    const user = getCurrentUser()
    if (!user) return

    if (coins < points) {
      toast({ title: "Insufficient points", description: `You need ${points - coins} more points for this reward.`, variant: "destructive" })
      return
    }

    try {
      setIsRedeeming(tierId)
      // Record a "spent" transaction; real payment integration would apply discount at checkout
      const { error: spendError } = await supabase.from("coin_transactions").insert({
        user_id: user.id,
        gym_id: user.gym_id,
        transaction_type: "spent",
        amount: points,
        description: `Redeemed ${points} points for discount`,
      })
      if (spendError) throw spendError

      toast({ title: "Reward redeemed successfully!", description: "Your discount will be applied to your next payment." })
      // Refresh data
      const { data: txData } = await supabase
        .from("coin_transactions")
        .select("amount, transaction_type, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      const total = txData?.reduce((sum, t) => sum + (t.transaction_type === "spent" ? -t.amount : t.amount), 0) || 0
      const earned = txData?.filter((t) => t.transaction_type !== "spent").reduce((s, t) => s + t.amount, 0) || 0
      setCoins(total)
      setTotalEarned(earned)
      setTransactions(
        (txData || []).map((t) => ({
          date: t.created_at,
          type: t.transaction_type,
          points: t.transaction_type === "spent" ? -t.amount : t.amount,
          description: t.description || (t.transaction_type === "earned" ? "Gym check-in" : "Coins update"),
        }))
      )
    } catch (e: any) {
      toast({ title: "Redemption failed", description: e.message || "Try again later", variant: "destructive" })
    } finally {
      setIsRedeeming(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-300">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b px-4 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link href="/member/dashboard">
            <Button variant="ghost" size="sm" className="p-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Rewards</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Redeem your points for discounts</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* Points Balance */}
          <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-3xl font-bold">{coins.toLocaleString()}</p>
                  <p className="text-blue-100">Available Points</p>
                </div>
                <Trophy className="h-12 w-12 text-yellow-300" />
              </div>
              <div className="flex items-center justify-between text-sm text-blue-100">
                <span>Total Earned: {totalEarned.toLocaleString()}</span>
                <span>Exchange Rate: 100 pts = ₹1</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{streak}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Day Streak</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{monthlyVisits}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">This Month</div>
              </CardContent>
            </Card>
          </div>

          {/* Redemption Tiers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-green-500" />
                Redeem Points
              </CardTitle>
              <CardDescription>Exchange your points for membership discounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {redemptionTiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`p-4 rounded-lg border ${
                    tier.available
                      ? "border-gray-200 dark:border-gray-700"
                      : "border-gray-100 dark:border-gray-800 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{tier.value}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{tier.discount}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">{tier.points} pts</p>
                      {coins >= tier.points && tier.available && (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        >
                          Available
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleRedeem(tier.id, tier.points)}
                    disabled={!tier.available || coins < tier.points || isRedeeming === tier.id}
                    className="w-full"
                    variant={coins >= tier.points && tier.available ? "default" : "outline"}
                  >
                    {isRedeeming === tier.id
                      ? "Redeeming..."
                      : coins >= tier.points && tier.available
                        ? "Redeem Now"
                        : tier.available
                          ? `Need ${tier.points - coins} more points`
                          : "Coming Soon"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactions.map((transaction, index) => (
                  <div key={`${transaction.date}-${index}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-full ${
                          transaction.type === "earned"
                            ? "bg-green-100 dark:bg-green-900"
                            : transaction.type === "bonus"
                              ? "bg-purple-100 dark:bg-purple-900"
                              : "bg-blue-100 dark:bg-blue-900"
                        }`}
                      >
                        {transaction.type === "earned" ? (
                          <Star className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <Gift className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{transaction.description}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(transaction.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          transaction.points >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {transaction.points >= 0 ? "+" : ""}
                        {transaction.points}
                      </p>
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <p className="text-sm text-gray-500">No transactions yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
