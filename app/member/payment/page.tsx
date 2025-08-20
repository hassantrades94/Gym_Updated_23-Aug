"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ArrowLeft, CreditCard, Check, Star, Crown, Zap, Coins } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { getCurrentUser, redirectIfNotAuthenticated } from "@/lib/auth"

export default function PaymentPage() {
  const { toast } = useToast()
  const [selectedPlan, setSelectedPlan] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [gymName, setGymName] = useState<string>("")
  const [gymId, setGymId] = useState<string | null>(null)
  const [coinValue, setCoinValue] = useState<number>(4.0)
  const [coins, setCoins] = useState<number>(0)
  const [nextPayment, setNextPayment] = useState<string>("")
  const [currentPlan, setCurrentPlan] = useState<string>("")

  type Plan = { id: string; plan_name: string; price_inr: number; duration_months: number; is_active: boolean; gym_id?: string }
  const [membershipPlans, setMembershipPlans] = useState<Plan[]>([])

  const availableDiscounts = [
    { coins: 125, discount: 500, label: "₹500 off" },
    { coins: 250, discount: 1000, label: "₹1000 off" },
    { coins: 500, discount: 2000, label: "₹2000 off" },
  ]

  const [selectedDiscount, setSelectedDiscount] = useState<number>(0)

  useEffect(() => {
    const user = redirectIfNotAuthenticated("member")
    if (!user) return

    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch membership and gym info
        const { data: membership, error: mError } = await supabase
          .from("memberships")
          .select(
            `id, plan_id, gym_id, start_date, expiry_date,
             gyms ( id, gym_name, coin_value ),
             gym_plans!memberships_plan_id_fkey ( id, plan_name, price_inr, duration_months, is_active )`
          )
          .eq("user_id", user.id)
          .single()
        if (mError) throw mError

        const gymsRelation = membership?.gyms as any
        const gymObj = Array.isArray(gymsRelation) ? gymsRelation[0] : gymsRelation
        const plansRelation = membership?.gym_plans as any
        const planObj = Array.isArray(plansRelation) ? plansRelation[0] : plansRelation

        setGymName(gymObj?.gym_name || "")
        setCoinValue(gymObj?.coin_value || 4.0)
        setGymId(membership?.gym_id || gymObj?.id || null)
        setNextPayment(membership?.expiry_date || "")
        setCurrentPlan(planObj?.plan_name || "")

        // Fetch all active plans for the user's gym
        if (membership?.gym_id) {
          const { data: plans, error: pError } = await supabase
            .from("gym_plans")
            .select("id, plan_name, price_inr, duration_months, is_active, gym_id")
            .eq("gym_id", membership.gym_id)
            .eq("is_active", true)
            .order("price_inr", { ascending: true })

          if (pError) throw pError
          setMembershipPlans(plans || [])
          setSelectedPlan(membership?.plan_id || plans?.[0]?.id || "")
        }

        // Fetch coin transactions to calculate balance
        const { data: txData, error: txError } = await supabase
          .from("coin_transactions")
          .select("amount, transaction_type")
          .eq("user_id", user.id)

        if (txError) throw txError
        const balance = (txData || []).reduce((sum: number, t: { amount: number; transaction_type: string }) =>
          sum + (t.transaction_type === "spent" ? -t.amount : t.amount),
        0)
        setCoins(balance)

        // Fetch payment history
        if (membership?.gym_id) {
          const { data: payHistory, error: phError } = await supabase
            .from("payments")
            .select("payment_date, amount_inr, payment_status")
            .eq("user_id", user.id)
            .eq("gym_id", membership.gym_id)
            .order("payment_date", { ascending: false })

          if (phError) throw phError

          const mapped: History[] = (payHistory || []).map((p: any) => ({
            id: p.id,
            date: p.payment_date,
            amount: Number(p.amount_inr),
            plan: "Membership",
            status: p.payment_status === "completed" ? "paid" : p.payment_status,
          }))
          setPaymentHistory(dedupeHistory(mapped))
        }
      } catch (e: any) {
        console.error(e)
        setError(e.message || "Failed to load payment info")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  // Preload Razorpay script once to preserve user-gesture context for modal
  useEffect(() => {
    const ensure = async () => {
      if (typeof window === "undefined") return
      if ((window as any).Razorpay) return
      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.async = true
      document.body.appendChild(script)
    }
    ensure()
  }, [])

  type History = {
    id: string
    date: string
    amount: number
    plan: string
    status: string
    method?: string | null
    razorpay_payment_id?: string | null
    discount?: number
  }
  const [paymentHistory, setPaymentHistory] = useState<History[]>([])

  const dedupeHistory = (items: History[]) => {
    const seen = new Set<string>()
    return items.filter((p) => {
      const day = new Date(p.date).toISOString().slice(0, 10) // YYYY-MM-DD
      const key = p.razorpay_payment_id ? `rp:${p.razorpay_payment_id}` : `m:${p.method || '-'}|d:${day}|a:${p.amount}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const refreshPaymentHistory = async (userId: string, gym: string) => {
    const { data: payHistory } = await supabase
      .from("payments")
      .select("id, payment_date, amount_inr, payment_status, payment_method, razorpay_payment_id")
      .eq("user_id", userId)
      .eq("gym_id", gym)
      .order("payment_date", { ascending: false })

    const mapped: History[] = (payHistory || []).map((p: any) => ({
      id: p.id,
      date: p.payment_date,
      amount: Number(p.amount_inr),
      plan: "Membership",
      status: p.payment_status === "completed" ? "paid" : p.payment_status,
      method: p.payment_method || null,
      razorpay_payment_id: p.razorpay_payment_id || null,
    }))
    setPaymentHistory(dedupeHistory(mapped))
  }

  const formatMethod = (p: History) => {
    if (p.razorpay_payment_id) return "Razorpay"
    if (!p.method) return "-"
    const m = p.method.toLowerCase()
    if (m === "upipay") return "UPI"
    return m.charAt(0).toUpperCase() + m.slice(1)
  }

  const addMonths = (date: Date, months: number) => {
    const d = new Date(date)
    d.setMonth(d.getMonth() + months)
    return d
  }

  const extendMembership = async (userId: string, gym: string, months: number) => {
    try {
      // Base from current expiry or today, whichever is later
      const base = nextPayment ? new Date(nextPayment) : new Date()
      const today = new Date()
      const from = base > today ? base : today
      const newExpiry = addMonths(from, months)
      const newExpiryISO = newExpiry.toISOString().slice(0, 10) // YYYY-MM-DD

      const updates: any = { expiry_date: newExpiryISO, plan_id: selectedPlan }
      const { error: updErr } = await supabase
        .from("memberships")
        .update(updates)
        .eq("user_id", userId)
        .eq("gym_id", gym)
      if (updErr) throw updErr

      setNextPayment(newExpiryISO)
      setCurrentPlan(membershipPlans.find((p) => p.id === selectedPlan)?.plan_name || currentPlan)
    } catch (e) {
      console.error("Failed to extend membership:", e)
    }
  }

  const calculateTotal = () => {
    const plan = membershipPlans.find((p) => p.id === selectedPlan)
    return plan ? Math.max(0, plan.price_inr - selectedDiscount) : 0
  }

  const loadRazorpay = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && (window as any).Razorpay) {
        resolve(true)
        return
      }
      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const handlePayment = async () => {
    const user = getCurrentUser()
    if (!user) {
      console.error("No user found")
      toast({ title: "Authentication error", description: "Please sign in again", variant: "destructive" })
      return
    }
    setIsProcessing(true)

    try {
      const plan = membershipPlans.find((p) => p.id === selectedPlan)
      if (!plan) {
        console.error("No plan selected")
        throw new Error("Please select a plan")
      }
      if (!gymId) {
        console.error("No gym ID found")
        throw new Error("No gym found for your membership")
      }

      const amountToPay = calculateTotal()
      console.log("Payment attempt:", { user: user.id, plan: plan.id, gym: gymId, amount: amountToPay })

      // If discount fully covers the plan, just record payment without opening checkout
      if (amountToPay <= 0) {
        if (selectedDiscount > 0) {
          await supabase.from("coin_transactions").insert({
            user_id: user.id,
            gym_id: gymId,
            transaction_type: "spent",
            amount: Math.round(selectedDiscount / coinValue),
            description: `Applied discount ₹${selectedDiscount} on ${plan.plan_name}`,
          })
        }
        await supabase.from("payments").insert({
          user_id: user.id,
          gym_id: gymId,
          membership_id: null,
          amount_inr: 0,
          payment_method: "coins",
          payment_status: "completed",
          payment_date: new Date().toISOString(),
        })
        await extendMembership(user.id, gymId, plan.duration_months)
        await refreshPaymentHistory(user.id, gymId)
        toast({ title: "Payment recorded!", description: `Your ${plan.plan_name} membership has been updated.` })
        setIsProcessing(false)
        return
      }

      // Try online payment via Razorpay first
      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(amountToPay * 100), // paise
          currency: "INR",
          receipt: `m-${Date.now().toString(36)}-${(user.id || "").replace(/-/g, "").slice(0, 8)}`,
          notes: { type: "membership", plan_id: plan.id, gym_id: gymId },
        }),
      })

      console.log("Order response:", { status: orderRes.status, ok: orderRes.ok })

      if (orderRes.ok) {
        const orderData = await orderRes.json()
        console.log("Order data:", orderData)
        const ok = await loadRazorpay()
        if (!ok) {
          console.error("Failed to load Razorpay script")
          throw new Error("Failed to load Razorpay. Please check your internet connection.")
        }

        console.log("Creating Razorpay instance...")
        const rzp = new (window as any).Razorpay({
          ...orderData.razorpayOptions,
          prefill: {
            contact: user.phone_number || "",
            name: user.full_name || "",
          },
          handler: async (response: any) => {
            console.log("Payment success:", response)
            // Record successful payment
            const razorpayPaymentId = response?.razorpay_payment_id || null
            if (razorpayPaymentId) {
              const { data: existing } = await supabase
                .from("payments")
                .select("id")
                .eq("razorpay_payment_id", razorpayPaymentId)
                .maybeSingle()
              if (!existing) {
                await supabase.from("payments").insert({
                  user_id: user.id,
                  gym_id: gymId,
                  membership_id: null,
                  amount_inr: amountToPay,
                  payment_method: "online",
                  razorpay_payment_id: razorpayPaymentId,
                  payment_status: "completed",
                  payment_date: new Date().toISOString(),
                })
              }
            } else {
              await supabase.from("payments").insert({
                user_id: user.id,
                gym_id: gymId,
                membership_id: null,
                amount_inr: amountToPay,
                payment_method: "online",
                payment_status: "completed",
                payment_date: new Date().toISOString(),
              })
            }

            if (selectedDiscount > 0) {
              await supabase.from("coin_transactions").insert({
                user_id: user.id,
                gym_id: gymId,
                transaction_type: "spent",
                amount: Math.round(selectedDiscount / coinValue),
                description: `Applied discount ₹${selectedDiscount} on ${plan.plan_name}`,
              })
            }

            await extendMembership(user.id, gymId, plan.duration_months)
            await refreshPaymentHistory(user.id, gymId)
            toast({ title: "Payment successful!", description: `Your ${plan.plan_name} membership has been updated.` })
            setIsProcessing(false)
          },
          modal: {
            ondismiss: () => {
              console.log("Payment modal dismissed")
              toast({ title: "Payment cancelled", description: "You closed the payment window." })
              setIsProcessing(false)
            },
          },
          theme: { color: "#da1c24" },
        })
        console.log("Opening Razorpay modal...")
        rzp.on("payment.failed", () => {
          console.error("Payment failed")
          toast({ title: "Payment failed", description: "Your payment did not go through.", variant: "destructive" })
          setIsProcessing(false)
        })
        rzp.open()
        return
      }

      console.error("Order creation failed:", orderRes.status, await orderRes.text())
      toast({ title: "Payment initialization failed", description: "Could not open Razorpay. Please try again.", variant: "destructive" })
      setIsProcessing(false)
      return
    } catch (e: any) {
      console.error("Payment error:", e)
      setIsProcessing(false)
      toast({ title: "Payment failed", description: e.message || "Try again later", variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <p className="text-gray-300">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link href="/member/dashboard">
            <Button variant="ghost" size="sm" className="p-2 text-white hover:bg-gray-700">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
              Membership & Payment
            </h1>
            <p className="text-sm text-gray-400">Manage your subscription</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* Current Plan Status */}
          <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700 hover:bg-gray-800/70 transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white py-0">
                <CreditCard className="h-5 w-5 text-red-500" />
                Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-2xl font-bold text-white capitalize">{currentPlan || ""}</p>
                  <p className="text-sm text-gray-400 py-[9px]">
                    Next payment: {nextPayment ? new Date(nextPayment).toLocaleDateString() : "-"}
                  </p>
                  <p className="text-xs text-red-400 mt-1">{gymName}</p>
                </div>
                <Badge className="bg-green-900/50 text-green-400 border-green-700">Active</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-red-400"></div>
            </CardContent>
          </Card>

          {/* Coins Card */}
          <Card className="bg-gradient-to-r from-red-900/30 to-red-800/30 border-red-700/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-red-200 flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    Your Coins
                  </p>
                  <p className="text-2xl font-bold text-white">{coins.toLocaleString()}</p>
                  <p className="text-sm text-red-300">Worth ₹{(coins * coinValue).toLocaleString()} • 1 coin = ₹{coinValue}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-red-400">Set by {gymName}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plan Selection */}
          <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Choose Your Plan</CardTitle>
              <CardDescription className="text-gray-400">Select the membership that fits your fitness goals</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan} className="space-y-4">
                {membershipPlans.map((plan) => (
                  <div key={plan.id} className="relative">
                    <Label
                      htmlFor={plan.id}
                      className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedPlan === plan.id
                          ? "border-red-500 bg-red-900/20 backdrop-blur-sm"
                          : "border-gray-700 hover:bg-gray-800/50 hover:border-gray-600"
                      }`}
                    >
                      <RadioGroupItem value={plan.id} id={plan.id} className="border-gray-600 text-red-500" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-semibold text-white">{plan.plan_name}</span>
                          <span className="text-2xl font-bold text-white">₹{Number(plan.price_inr).toLocaleString()}</span>
                          <span className="text-sm text-gray-400">/{plan.duration_months} mo</span>
                        </div>
                        {/* Features would be a separate table; omitting for now */}
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Coins Discount */}
          <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Apply Coins Discount</CardTitle>
              <CardDescription className="text-gray-400">You have {coins.toLocaleString()} coins available</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-700 bg-gray-800/30">
                  <Label htmlFor="no-discount" className="flex items-center gap-2 cursor-pointer text-white">
                    <input
                      type="radio"
                      id="no-discount"
                      name="discount"
                      checked={selectedDiscount === 0}
                      onChange={() => setSelectedDiscount(0)}
                      className="text-red-500"
                    />
                    <span>No discount</span>
                  </Label>
                  <span className="text-sm text-gray-400">Save coins</span>
                </div>

                {availableDiscounts.map((discount) => (
                  <div
                    key={discount.coins}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                      coins >= discount.coins
                        ? "border-gray-700 bg-gray-800/30 hover:bg-gray-800/50"
                        : "border-gray-800 bg-gray-900/30 opacity-50"
                    }`}
                  >
                    <Label
                      htmlFor={`discount-${discount.coins}`}
                      className={`flex items-center gap-2 text-white ${coins >= discount.coins ? "cursor-pointer" : "cursor-not-allowed"}`}
                    >
                      <input
                        type="radio"
                        id={`discount-${discount.coins}`}
                        name="discount"
                        checked={selectedDiscount === discount.discount}
                        onChange={() => setSelectedDiscount(discount.discount)}
                        disabled={coins < discount.coins}
                        className="text-red-500"
                      />
                      <span>{discount.label}</span>
                    </Label>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Costs {Math.round(discount.discount / coinValue)} coins</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Order Summary</CardTitle>
              <CardDescription className="text-gray-400">Review your payment details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-white">
                <div className="flex items-center justify-between">
                  <span>Plan</span>
                  <span>
                    {membershipPlans.find((p) => p.id === selectedPlan)?.plan_name || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Price</span>
                  <span>₹{Number(membershipPlans.find((p) => p.id === selectedPlan)?.price_inr || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Discount</span>
                  <span>- ₹{selectedDiscount.toLocaleString()}</span>
                </div>
                <Separator className="bg-gray-700" />
                <div className="flex items-center justify-between font-bold">
                  <span>Total</span>
                  <span>₹{calculateTotal().toLocaleString()}</span>
                </div>
              </div>
              <Button onClick={handlePayment} className="w-full mt-4" disabled={isProcessing}>
                {isProcessing ? "Processing..." : "Pay Now"}
              </Button>
            </CardContent>
          </Card>
          
          {/* Payment History - Move this inside the component */}
          <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paymentHistory.length === 0 && (
                  <p className="text-sm text-gray-400">No payments recorded yet.</p>
                )}
                {paymentHistory.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                    <div>
                      <p className="font-medium text-white">{payment.plan} Plan</p>
                      <p className="text-sm text-gray-400">
                        {new Date(payment.date).toLocaleDateString()} • {formatMethod(payment)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-white">₹{payment.amount.toLocaleString()}</p>
                      <Badge className="bg-green-900/50 text-green-400 border-green-700 mt-1">{payment.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

// Remove the orphaned JSX code that was outside the component (lines 384-409)
