import { supabase } from './supabase'

export interface SubscriptionData {
  gymId: string
  totalMembers: number
  freeMembers: number
  paidMembers: number
  walletBalance: number
  visibleMembers: number
  hiddenMembers: number
  requiredAmount: number
  nextBillingDate: string
  lastBillingDate?: string
}

export class SubscriptionService {
  private static readonly MONTHLY_CHARGE_PER_MEMBER = 10 // Rs 10 per paid member
  private static readonly FREE_MEMBER_LIMIT = 5
  private static readonly BILLING_DAY = 10 // 10th of every month

  /**
   * Calculate subscription data for a gym
   */
  static async calculateSubscriptionData(gymId: string): Promise<SubscriptionData> {
    try {
      // Get wallet info
      const { data: wallet } = await supabase
        .from('gym_wallets')
        .select('balance_inr, last_billing_date')
        .eq('gym_id', gymId)
        .maybeSingle()

      // Get total members count
      const { data: memberships } = await supabase
        .from('memberships')
        .select('id, start_date')
        .eq('gym_id', gymId)
        .order('start_date', { ascending: true })

      const totalMembers = memberships?.length || 0
      const freeMembers = Math.min(totalMembers, this.FREE_MEMBER_LIMIT)
      const paidMembers = Math.max(0, totalMembers - this.FREE_MEMBER_LIMIT)
      
      const walletBalance = Number(wallet?.balance_inr || 0)
      const maxVisiblePaidMembers = Math.floor(walletBalance / this.MONTHLY_CHARGE_PER_MEMBER)
      const visiblePaidMembers = Math.min(paidMembers, maxVisiblePaidMembers)
      const visibleMembers = freeMembers + visiblePaidMembers
      const hiddenMembers = totalMembers - visibleMembers
      const requiredAmount = hiddenMembers * this.MONTHLY_CHARGE_PER_MEMBER

      // Calculate next billing date
      const now = new Date()
      const nextBilling = new Date(now.getFullYear(), now.getMonth(), this.BILLING_DAY)
      if (now.getDate() >= this.BILLING_DAY) {
        nextBilling.setMonth(nextBilling.getMonth() + 1)
      }

      return {
        gymId,
        totalMembers,
        freeMembers,
        paidMembers,
        walletBalance,
        visibleMembers,
        hiddenMembers,
        requiredAmount,
        nextBillingDate: nextBilling.toISOString().split('T')[0],
        lastBillingDate: wallet?.last_billing_date || undefined
      }
    } catch (error) {
      console.error('Error calculating subscription data:', error)
      throw error
    }
  }

  /**
   * Get visible members based on subscription rules
   */
  static async getVisibleMembers(gymId: string) {
    try {
      const subscriptionData = await this.calculateSubscriptionData(gymId)
      
      // Get all members ordered by join date (first 5 are always free)
      const { data: memberships } = await supabase
        .from('memberships')
        .select(`
          id, user_id, start_date, expiry_date, payment_status, is_active,
          users ( full_name, phone_number, profile_picture_url ),
          gym_plans ( plan_name, duration_months, price_inr )
        `)
        .eq('gym_id', gymId)
        .order('start_date', { ascending: true })

      if (!memberships) return []

      // Mark first 5 as free, rest as paid
      const visibleMemberships = memberships.slice(0, subscriptionData.visibleMembers)
      
      return visibleMemberships.map((m: any, index: number) => ({
        ...m,
        isFree: index < this.FREE_MEMBER_LIMIT,
        memberType: index < this.FREE_MEMBER_LIMIT ? 'free' : 'paid'
      }))
    } catch (error) {
      console.error('Error getting visible members:', error)
      throw error
    }
  }

  /**
   * Process monthly billing on the 10th of each month
   */
  static async processMonthlyBilling(gymId: string): Promise<{ success: boolean; message: string }> {
    try {
      const subscriptionData = await this.calculateSubscriptionData(gymId)
      const billingAmount = subscriptionData.paidMembers * this.MONTHLY_CHARGE_PER_MEMBER

      if (billingAmount === 0) {
        return { success: true, message: 'No paid members to bill' }
      }

      if (subscriptionData.walletBalance < billingAmount) {
        // Insufficient balance - update gym status
        await supabase
          .from('gyms')
          .update({ subscription_status: 'suspended' })
          .eq('id', gymId)

        return { 
          success: false, 
          message: `Insufficient balance. Required: ₹${billingAmount}, Available: ₹${subscriptionData.walletBalance}` 
        }
      }

      // Deduct amount from wallet
      const newBalance = subscriptionData.walletBalance - billingAmount
      const { error: walletError } = await supabase
        .from('gym_wallets')
        .update({ 
          balance_inr: newBalance,
          last_billing_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('gym_id', gymId)

      if (walletError) throw walletError

      // Record transaction
      await supabase
        .from('wallet_transactions')
        .insert({
          gym_id: gymId,
          transaction_type: 'monthly_billing',
          amount_inr: -billingAmount,
          description: `Monthly billing for ${subscriptionData.paidMembers} paid members`
        })

      // Ensure gym status is active
      await supabase
        .from('gyms')
        .update({ subscription_status: 'active' })
        .eq('id', gymId)

      return { 
        success: true, 
        message: `Successfully billed ₹${billingAmount} for ${subscriptionData.paidMembers} paid members` 
      }
    } catch (error) {
      console.error('Error processing monthly billing:', error)
      return { success: false, message: 'Failed to process billing' }
    }
  }

  /**
   * Recharge wallet
   */
  static async rechargeWallet(gymId: string, amount: number, paymentId?: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get current balance
      const { data: wallet } = await supabase
        .from('gym_wallets')
        .select('balance_inr')
        .eq('gym_id', gymId)
        .maybeSingle()

      const currentBalance = Number(wallet?.balance_inr || 0)
      const newBalance = currentBalance + amount

      // Update wallet balance
      const { error: walletError } = await supabase
        .from('gym_wallets')
        .upsert({
          gym_id: gymId,
          balance_inr: newBalance,
          updated_at: new Date().toISOString()
        })

      if (walletError) throw walletError

      // Record transaction
      await supabase
        .from('wallet_transactions')
        .insert({
          gym_id: gymId,
          transaction_type: 'recharge',
          amount_inr: amount,
          razorpay_payment_id: paymentId,
          description: `Wallet recharge of ₹${amount}`
        })

      // If gym was suspended, reactivate it if balance is sufficient
      const subscriptionData = await this.calculateSubscriptionData(gymId)
      if (subscriptionData.paidMembers * this.MONTHLY_CHARGE_PER_MEMBER <= newBalance) {
        await supabase
          .from('gyms')
          .update({ subscription_status: 'active' })
          .eq('id', gymId)
      }

      return { success: true, message: `Wallet recharged with ₹${amount}` }
    } catch (error) {
      console.error('Error recharging wallet:', error)
      return { success: false, message: 'Failed to recharge wallet' }
    }
  }

  /**
   * Handle member deletion and auto-promote paid members to free
   */
  static async handleMemberDeletion(gymId: string, deletedMemberId: string): Promise<void> {
    try {
      // Get all remaining members ordered by join date
      const { data: remainingMembers } = await supabase
        .from('memberships')
        .select('id, user_id, start_date')
        .eq('gym_id', gymId)
        .neq('id', deletedMemberId)
        .order('start_date', { ascending: true })

      if (!remainingMembers) return

      const totalRemaining = remainingMembers.length
      const newFreeCount = Math.min(totalRemaining, this.FREE_MEMBER_LIMIT)

      // Update gym's free member count
      await supabase
        .from('gyms')
        .update({ 
          free_member_count: newFreeCount,
          total_active_members: totalRemaining
        })
        .eq('id', gymId)

      // If we had exactly 5 free members and one was deleted,
      // the 6th member (first paid member) should become free
      // This is handled automatically by our ordering system
    } catch (error) {
      console.error('Error handling member deletion:', error)
      throw error
    }
  }

  /**
   * Check if billing is due (runs daily)
   */
  static async checkBillingDue(): Promise<void> {
    try {
      const today = new Date()
      const isToday10th = today.getDate() === this.BILLING_DAY

      if (!isToday10th) return

      // Get all active gyms that haven't been billed today
      const todayStr = today.toISOString().split('T')[0]
      const { data: gyms } = await supabase
        .from('gyms')
        .select(`
          id,
          gym_wallets (last_billing_date)
        `)
        .eq('subscription_status', 'active')

      for (const gym of gyms || []) {
        const lastBillingDate = gym.gym_wallets?.[0]?.last_billing_date
        
        // Skip if already billed today
        if (lastBillingDate === todayStr) continue

        // Process billing for this gym
        await this.processMonthlyBilling(gym.id)
      }
    } catch (error) {
      console.error('Error checking billing due:', error)
    }
  }
}
