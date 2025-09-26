"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft,
  Search,
  Filter,
  Download,
  Calendar,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Loader2,
  RefreshCw
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"

type WalletTransaction = {
  id: string
  transaction_type: 'recharge' | 'deduction' | 'monthly_billing'
  amount_inr: number
  description: string
  razorpay_payment_id?: string
  created_at: string
}

type FilterType = 'all' | 'recharge' | 'deduction' | 'monthly_billing'

export default function WalletHistoryPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<WalletTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [gymId, setGymId] = useState<string | null>(null)
  const [totalBalance, setTotalBalance] = useState(0)
  const [totalRecharges, setTotalRecharges] = useState(0)
  const [totalDeductions, setTotalDeductions] = useState(0)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user || !user.gym_id) {
      router.push('/auth/signin')
      return
    }
    setGymId(user.gym_id)
    loadTransactions(user.gym_id)
  }, [])

  // Real-time subscription for wallet transactions
  useEffect(() => {
    if (!gymId) return

    const subscription = supabase
      .channel('wallet_transactions_history')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallet_transactions',
          filter: `gym_id=eq.${gymId}`
        },
        (payload) => {
          console.log('Transaction history change:', payload)
          // Reload transactions when changes occur
          loadTransactions(gymId, false)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [gymId])

  useEffect(() => {
    filterTransactions()
  }, [transactions, searchTerm, filterType])

  const loadTransactions = async (gymId: string, showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('gym_id', gymId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setTransactions(data || [])
      calculateTotals(data || [])
    } catch (error: any) {
      console.error('Error loading transactions:', error)
      toast({
        title: "Error",
        description: "Failed to load transaction history. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const calculateTotals = (transactions: WalletTransaction[]) => {
    const recharges = transactions
      .filter(t => t.transaction_type === 'recharge')
      .reduce((sum, t) => sum + t.amount_inr, 0)
    
    // Include both 'deduction' and 'monthly_billing' as deductions
    const deductions = transactions
      .filter(t => t.transaction_type === 'deduction' || t.transaction_type === 'monthly_billing')
      .reduce((sum, t) => sum + Math.abs(t.amount_inr), 0)
    
    setTotalRecharges(recharges)
    setTotalDeductions(deductions)
    setTotalBalance(recharges - deductions)
  }

  const filterTransactions = () => {
    let filtered = transactions

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.transaction_type === filterType)
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.razorpay_payment_id?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredTransactions(filtered)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatAmount = (amount: number, type: 'recharge' | 'deduction' | 'monthly_billing') => {
    const absAmount = Math.abs(amount)
    return type === 'recharge' ? `+₹${absAmount}` : `-₹${absAmount}`
  }

  const getTransactionIcon = (type: 'recharge' | 'deduction' | 'monthly_billing') => {
    return type === 'recharge' ? 
      <TrendingUp className="h-4 w-4 text-green-500" /> : 
      <TrendingDown className="h-4 w-4 text-red-500" />
  }

  const getTransactionBadge = (type: 'recharge' | 'deduction' | 'monthly_billing') => {
    if (type === 'recharge') {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Recharge</Badge>
    } else if (type === 'monthly_billing') {
      return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Monthly Billing</Badge>
    } else {
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Deduction</Badge>
    }
  }

  const refreshTransactions = () => {
    if (gymId) {
      loadTransactions(gymId, true)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-white animate-spin mx-auto mb-4" />
          <p className="text-white">Loading transaction history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#da1c24] via-[#e63946] to-[#da1c24] shadow-2xl">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => router.back()}
                className="text-white hover:bg-white/20 p-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">Wallet Transaction History</h1>
                <p className="text-red-100">Complete record of all wallet activities</p>
              </div>
            </div>
            <Button
              onClick={refreshTransactions}
              variant="ghost"
              className="text-white hover:bg-white/20"
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Current Balance</p>
                  <p className="text-2xl font-bold text-white">₹{totalBalance}</p>
                </div>
                <Wallet className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Recharges</p>
                  <p className="text-2xl font-bold text-green-400">₹{totalRecharges}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Deductions</p>
                  <p className="text-2xl font-bold text-red-400">₹{totalDeductions}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search transactions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>
              </div>
              <Select value={filterType} onValueChange={(value: FilterType) => setFilterType(value)}>
                <SelectTrigger className="w-full md:w-48 bg-gray-700 border-gray-600 text-white">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="all" className="text-white hover:bg-gray-600">All Transactions</SelectItem>
                  <SelectItem value="recharge" className="text-white hover:bg-gray-600">Recharges Only</SelectItem>
                  <SelectItem value="deduction" className="text-white hover:bg-gray-600">Deductions Only</SelectItem>
                  <SelectItem value="monthly_billing" className="text-white hover:bg-gray-600">Monthly Billing Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Transactions List */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <IndianRupee className="h-5 w-5" />
              Transaction History
            </CardTitle>
            <CardDescription className="text-gray-400">
              {filteredTransactions.length} transaction(s) found
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No transactions found</p>
                <p className="text-gray-500 text-sm">Try adjusting your search or filter criteria</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {filteredTransactions.map((transaction, index) => (
                  <div key={`${transaction.id}-${index}`} className="p-4 hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {getTransactionIcon(transaction.transaction_type)}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-white font-medium">{transaction.description}</p>
                            {getTransactionBadge(transaction.transaction_type)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(transaction.created_at)}
                            </span>
                            {transaction.razorpay_payment_id && (
                              <span className="flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                ID: {transaction.razorpay_payment_id.slice(-8)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${
                          transaction.transaction_type === 'recharge' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {formatAmount(transaction.amount_inr, transaction.transaction_type)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}