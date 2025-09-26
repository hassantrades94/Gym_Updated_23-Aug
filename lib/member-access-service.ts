import { supabase } from './supabase'
import { SubscriptionService } from './subscription-service'

export interface MemberAccessResult {
  hasAccess: boolean
  reason?: string
  memberType: 'free' | 'paid'
  memberPosition: number
}

export class MemberAccessService {
  private static readonly FREE_MEMBER_LIMIT = 5

  /**
   * Subscribe to real-time access changes for a member
   * @param userId - The member's user ID
   * @param gymId - The gym ID
   * @param onAccessChange - Callback when access status changes
   * @returns Subscription object
   */
  static subscribeToAccessChanges(
    userId: string,
    gymId: string,
    onAccessChange: (accessResult: MemberAccessResult) => void
  ) {
    // Subscribe to wallet transactions that might affect member access
    const walletSubscription = supabase
      .channel(`member_access_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallet_transactions',
          filter: `gym_id=eq.${gymId}`
        },
        async () => {
          // Check access when wallet balance changes
          const accessResult = await this.checkMemberAccess(userId, gymId)
          onAccessChange(accessResult)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'memberships',
          filter: `gym_id=eq.${gymId}`
        },
        async () => {
          // Check access when memberships change (affects member positions)
          const accessResult = await this.checkMemberAccess(userId, gymId)
          onAccessChange(accessResult)
        }
      )
      .subscribe()

    return walletSubscription
  }

  /**
   * Check if a member should have dashboard access
   * @param userId - The member's user ID
   * @param gymId - The gym ID
   * @returns Promise<MemberAccessResult>
   */
  static async checkMemberAccess(userId: string, gymId: string): Promise<MemberAccessResult> {
    try {
      // Get member's position in the gym (by join date)
      const { data: membershipData } = await supabase
        .from('memberships')
        .select('id, start_date, user_id')
        .eq('gym_id', gymId)
        .order('start_date', { ascending: true })

      if (!membershipData) {
        return {
          hasAccess: false,
          reason: 'Member not found in this gym',
          memberType: 'paid',
          memberPosition: -1
        }
      }

      // Find member's position (0-indexed)
      const memberIndex = membershipData.findIndex(m => m.user_id === userId)
      if (memberIndex === -1) {
        return {
          hasAccess: false,
          reason: 'Member not found in this gym',
          memberType: 'paid',
          memberPosition: -1
        }
      }

      const memberPosition = memberIndex + 1 // 1-indexed for display
      const isFree = memberIndex < this.FREE_MEMBER_LIMIT

      // Free members always have access
      if (isFree) {
        return {
          hasAccess: true,
          memberType: 'free',
          memberPosition
        }
      }

      // For paid members, check wallet balance
      const subscriptionData = await SubscriptionService.calculateSubscriptionData(gymId)
      const requiredBalance = (memberIndex - this.FREE_MEMBER_LIMIT + 1) * 10 // Rs 10 per paid member
      
      if (subscriptionData.walletBalance >= requiredBalance) {
        return {
          hasAccess: true,
          memberType: 'paid',
          memberPosition
        }
      }

      return {
        hasAccess: false,
        reason: `Insufficient wallet balance. Required: ₹${requiredBalance}, Available: ₹${subscriptionData.walletBalance}`,
        memberType: 'paid',
        memberPosition
      }

    } catch (error) {
      console.error('Error checking member access:', error)
      return {
        hasAccess: false,
        reason: 'Error checking access permissions',
        memberType: 'paid',
        memberPosition: -1
      }
    }
  }

  /**
   * Get gym owner contact info for payment issues
   */
  static async getGymOwnerContact(gymId: string): Promise<{ name: string; phone?: string } | null> {
    try {
      const { data: gymData } = await supabase
        .from('gyms')
        .select(`
          gym_name,
          owner_id,
          users!gyms_owner_id_fkey ( full_name, phone_number )
        `)
        .eq('id', gymId)
        .single()

      if (gymData?.users) {
        return {
          name: (gymData.users as any).full_name || gymData.gym_name,
          phone: (gymData.users as any).phone_number
        }
      }
      return null
    } catch (error) {
      console.error('Error getting gym owner contact:', error)
      return null
    }
  }
}