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
      // Get wallet info for billing dates
      const { data: wallet } = await supabase
        .from('gym_wallets')
        .select('last_billing_date')
        .eq('gym_id', gymId)
        .maybeSingle()

      // Calculate net balance from all wallet transactions
      const { data: transactions, error: transactionError } = await supabase
        .from('wallet_transactions')
        .select('amount_inr, transaction_type')
        .eq('gym_id', gymId)
      
      if (transactionError) throw transactionError
      
      const walletBalance = (transactions || []).reduce((total, tx) => {
        const amount = Number(tx.amount_inr || 0)
        // Recharge transactions add to balance, all other types (deduction, monthly_billing) subtract
        if (tx.transaction_type === 'recharge') {
          return total + Math.abs(amount) // Ensure positive for recharges
        } else {
          return total - Math.abs(amount) // Ensure negative for deductions/billing
        }
      }, 0)

      // Get total members count
      const { data: memberships } = await supabase
        .from('memberships')
        .select('id, start_date')
        .eq('gym_id', gymId)
        .order('start_date', { ascending: true })

      const totalMembers = memberships?.length || 0
      const freeMembers = Math.min(totalMembers, this.FREE_MEMBER_LIMIT)
      const paidMembers = Math.max(0, totalMembers - this.FREE_MEMBER_LIMIT)
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

      // Record billing transaction (amount should be positive for deduction)
      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          gym_id: gymId,
          transaction_type: 'monthly_billing',
          amount_inr: billingAmount, // Positive amount for deduction
          description: `Monthly subscription billing: ${subscriptionData.paidMembers} members`,
          created_at: new Date().toISOString()
        })

      if (transactionError) throw transactionError

      // Update billing date in wallet record
      const { error: walletError } = await supabase
        .from('gym_wallets')
        .upsert({
          gym_id: gymId,
          last_billing_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        }, { onConflict: 'gym_id' })

      if (walletError) throw walletError

      // Ensure gym status is active
      await supabase
        .from('gyms')
        .update({ subscription_status: 'active' })
        .eq('id', gymId)

      return { 
        success: true, 
        message: `Successfully billed Rs ${this.MONTHLY_CHARGE_PER_MEMBER} × ${subscriptionData.paidMembers} = ₹${billingAmount} for ${subscriptionData.paidMembers} paid members` 
      }
    } catch (error) {
      console.error('Error processing monthly billing:', error)
      return { success: false, message: 'Failed to process billing' }
    }
  }

  /**
   * Recharge wallet
   */
  static async rechargeWallet(gymId: string, amountInr: number, razorpayPaymentId?: string): Promise<{ success: boolean; message: string; newBalance?: number }> {
    try {
      // Record transaction first
      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          gym_id: gymId,
          transaction_type: 'recharge',
          amount_inr: amountInr,
          razorpay_payment_id: razorpayPaymentId,
          description: 'Wallet recharge via Razorpay'
        })

      if (transactionError) {
        console.error('Error recording transaction:', transactionError)
        return { success: false, message: 'Failed to record transaction. Please contact support.' }
      }

      // Calculate new balance from all transactions
      const { data: transactions, error: fetchError } = await supabase
        .from('wallet_transactions')
        .select('amount_inr, transaction_type')
        .eq('gym_id', gymId)

      if (fetchError) {
        console.error('Error fetching transactions:', fetchError)
        return { success: false, message: 'Failed to calculate new balance' }
      }

      const newBalance = (transactions || []).reduce((total, tx) => {
        const amount = Number(tx.amount_inr || 0)
        // Recharge transactions add to balance, all other types (deduction, monthly_billing) subtract
        if (tx.transaction_type === 'recharge') {
          return total + Math.abs(amount) // Ensure positive for recharges
        } else {
          return total - Math.abs(amount) // Ensure negative for deductions/billing
        }
      }, 0)

      // Update wallet record for billing date tracking (no longer storing balance here)
      const { error: walletError } = await supabase
        .from('gym_wallets')
        .upsert(
          { gym_id: gymId, updated_at: new Date().toISOString() },
          { onConflict: 'gym_id' }
        )

      if (walletError) {
        console.error('Error updating wallet balance:', walletError)
        // Rollback transaction if wallet update fails
        await supabase
          .from('wallet_transactions')
          .delete()
          .eq('gym_id', gymId)
          .eq('transaction_type', 'recharge')
          .eq('amount_inr', amountInr)
          .eq('razorpay_payment_id', razorpayPaymentId)
        
        return { success: false, message: 'Payment successful but failed to update wallet. Please refresh the page.' }
      }

      // If gym was suspended, reactivate it if balance is sufficient
      const subscriptionData = await this.calculateSubscriptionData(gymId)
      if (subscriptionData.paidMembers * this.MONTHLY_CHARGE_PER_MEMBER <= newBalance) {
        await supabase
          .from('gyms')
          .update({ subscription_status: 'active' })
          .eq('id', gymId)
      }

      return { success: true, newBalance, message: 'Wallet recharged successfully' }
    } catch (error) {
      console.error('Unexpected error in rechargeWallet:', error)
      return { success: false, message: 'An unexpected error occurred. Please try again.' }
    }
  }

  /**
   * Handle automatic wallet deduction when paid members are unhidden
   */
  static async deductForUnhiddenMembers(gymId: string, membersToUnhide: number): Promise<{ success: boolean; message: string; newBalance?: number }> {
    try {
      const deductionAmount = membersToUnhide * this.MONTHLY_CHARGE_PER_MEMBER
      
      // Get current wallet balance
      const subscriptionData = await this.calculateSubscriptionData(gymId)
      
      if (subscriptionData.walletBalance < deductionAmount) {
        return {
          success: false,
          message: `Insufficient balance. Required: ₹${deductionAmount}, Available: ₹${subscriptionData.walletBalance}`
        }
      }
      
      const balanceBefore = subscriptionData.walletBalance
      const balanceAfter = balanceBefore - deductionAmount
      
      // Create deduction transaction
      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          gym_id: gymId,
          transaction_type: 'deduction',
          amount_inr: -deductionAmount, // Negative for deduction
          balance_before_inr: balanceBefore,
          balance_after_inr: balanceAfter,
          description: `Automatic deduction for unhiding ${membersToUnhide} paid member${membersToUnhide > 1 ? 's' : ''}`,
          created_at: new Date().toISOString()
        })
      
      if (transactionError) {
        console.error('Error creating deduction transaction:', transactionError)
        return {
          success: false,
          message: 'Failed to process wallet deduction. Please try again.'
        }
      }
      
      return {
        success: true,
        message: `Successfully deducted ₹${deductionAmount} for ${membersToUnhide} unhidden member${membersToUnhide > 1 ? 's' : ''}`,
        newBalance: balanceAfter
      }
    } catch (error) {
      console.error('Error processing automatic deduction:', error)
      return {
        success: false,
        message: 'An unexpected error occurred during wallet deduction'
      }
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
