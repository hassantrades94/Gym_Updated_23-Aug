import { supabase } from './supabase'

export interface LeaderboardMember {
  rank: number
  name: string
  streak: number
  isCurrentUser: boolean
  userId: string
  monthlyCheckIns: number
}

export class LeaderboardService {
  /**
   * Fetch live leaderboard data for a specific gym
   */
  static async fetchGymLeaderboard(
    gymId: string, 
    currentUserId: string, 
    limit: number = 5
  ): Promise<LeaderboardMember[]> {
    try {
      const currentYear = new Date().getFullYear()
      const currentMonth = new Date().getMonth()
      const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString()
      const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1).toISOString()

      // Fetch check-ins for current month with user details
      const { data: leaderboardData, error } = await supabase
        .from("check_ins")
        .select(`
          user_id, 
          check_in_time,
          users!inner(full_name)
        `)
        .eq("gym_id", gymId)
        .gte("check_in_time", startOfMonth)
        .lt("check_in_time", startOfNextMonth)

      if (error) {
        console.error('Error fetching leaderboard data:', error)
        return []
      }

      // Count check-ins per user
      const counts: Record<string, { name: string; count: number }> = {}
      leaderboardData?.forEach((row: any) => {
        const uid = row.user_id
        const name = row.users.full_name
        counts[uid] = counts[uid] 
          ? { name, count: counts[uid].count + 1 } 
          : { name, count: 1 }
      })

      // Sort and format leaderboard
      const sorted = Object.entries(counts)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, limit)
        .map(([uid, data], index) => ({
          rank: index + 1,
          name: data.name,
          streak: data.count,
          monthlyCheckIns: data.count,
          isCurrentUser: uid === currentUserId,
          userId: uid
        }))

      return sorted
    } catch (error) {
      console.error('Error in fetchGymLeaderboard:', error)
      return []
    }
  }

  /**
   * Subscribe to real-time leaderboard updates
   */
  static subscribeToLeaderboardUpdates(
    gymId: string,
    onUpdate: (leaderboard: LeaderboardMember[]) => void,
    currentUserId: string
  ) {
    // Subscribe to check-ins table changes for this gym
    const subscription = supabase
      .channel('leaderboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'check_ins',
          filter: `gym_id=eq.${gymId}`
        },
        async () => {
          // Refetch leaderboard when check-ins change
          const updatedLeaderboard = await this.fetchGymLeaderboard(gymId, currentUserId)
          onUpdate(updatedLeaderboard)
        }
      )
      .subscribe()

    return subscription
  }

  /**
   * Get current user's rank in the leaderboard
   */
  static getCurrentUserRank(leaderboard: LeaderboardMember[]): number | null {
    const userEntry = leaderboard.find(member => member.isCurrentUser)
    return userEntry ? userEntry.rank : null
  }
}