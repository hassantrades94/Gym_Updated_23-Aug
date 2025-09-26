import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface StreakRewardSettings {
  day1: number;
  day2: number;
  day3: number;
  day4: number;
  day5: number;
  day6Plus: number;
  sundayAutoStreak: boolean;
  unifiedMode?: boolean;
  unifiedValue?: number;
}

interface RewardCalculationResult {
  coinsEarned: number;
  streakDay: number;
  bonusMultiplier: number;
  description: string;
}

class RewardCalculationService {
  private defaultSettings: StreakRewardSettings = {
    day1: 100,
    day2: 150,
    day3: 200,
    day4: 250,
    day5: 300,
    day6Plus: 350,
    sundayAutoStreak: true
  };

  /**
   * Calculate coins to award based on current streak
   * @param currentStreak - The user's current consecutive day streak
   * @param gymSettings - Optional gym-specific reward settings
   * @returns RewardCalculationResult with coins and details
   */
  calculateTimerCompletionReward(
    currentStreak: number, 
    gymSettings?: Partial<StreakRewardSettings>
  ): RewardCalculationResult {
    const settings = { ...this.defaultSettings, ...gymSettings };
    
    let coinsEarned: number;
    let streakDay = currentStreak;
    let bonusMultiplier = 1;
    let description: string;

    // Check if unified mode is enabled
    if (settings.unifiedMode && settings.unifiedValue) {
      coinsEarned = settings.unifiedValue;
      description = `Daily workout reward (${streakDay}-day streak)`;
      bonusMultiplier = Math.min(1 + (streakDay - 1) * 0.1, 3); // Progressive multiplier up to 3x
    } else {
      // Traditional streak-based rewards
      if (streakDay === 1) {
        coinsEarned = settings.day1;
        description = "First day streak reward";
      } else if (streakDay === 2) {
        coinsEarned = settings.day2;
        description = "2-day streak bonus";
        bonusMultiplier = 1.5;
      } else if (streakDay === 3) {
        coinsEarned = settings.day3;
        description = "3-day streak bonus";
        bonusMultiplier = 2;
      } else if (streakDay === 4) {
        coinsEarned = settings.day4;
        description = "4-day streak bonus";
        bonusMultiplier = 2.5;
      } else if (streakDay === 5) {
        coinsEarned = settings.day5;
        description = "5-day streak bonus";
        bonusMultiplier = 3;
      } else {
        coinsEarned = settings.day6Plus;
        description = `${streakDay}-day streak champion bonus`;
        bonusMultiplier = 3.5;
      }
    }

    return {
      coinsEarned,
      streakDay,
      bonusMultiplier,
      description
    };
  }

  /**
   * Get gym-specific reward settings from database or use defaults
   * @param gymId - The gym ID to fetch settings for
   * @returns Promise<StreakRewardSettings>
   */
  async getGymRewardSettings(gymId: string): Promise<StreakRewardSettings> {
    try {
      const { data, error } = await supabase
        .from('gym_settings')
        .select('setting_data')
        .eq('gym_id', gymId)
        .eq('setting_type', 'streak_rewards')
        .single();

      if (error) {
        console.warn('No gym-specific streak settings found, using defaults:', error.message);
        return this.defaultSettings;
      }

      if (data?.setting_data) {
        // Merge database settings with defaults to ensure all properties exist
        const dbSettings = data.setting_data as Partial<StreakRewardSettings>;
        return {
          ...this.defaultSettings,
          ...dbSettings
        };
      }

      return this.defaultSettings;
    } catch (error) {
      console.error('Failed to fetch gym reward settings:', error);
      return this.defaultSettings;
    }
  }

  /**
   * Calculate if Sunday should maintain streak
   * @param lastCheckInDate - Date of last check-in
   * @param currentDate - Current date
   * @param sundayAutoStreak - Whether Sunday auto-continues streaks
   * @returns boolean indicating if streak should continue
   */
  shouldMaintainStreakOverSunday(
    lastCheckInDate: Date, 
    currentDate: Date, 
    sundayAutoStreak: boolean = true
  ): boolean {
    if (!sundayAutoStreak) return false;
    
    const daysDiff = Math.floor(
      (currentDate.getTime() - lastCheckInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // If it's been exactly 1 day and today is Monday, check if yesterday was Sunday
    if (daysDiff === 1 && currentDate.getDay() === 1) {
      return lastCheckInDate.getDay() === 6; // Saturday to Monday (skipping Sunday)
    }
    
    // If it's been 2 days and today is Monday, check if last check-in was Saturday
    if (daysDiff === 2 && currentDate.getDay() === 1) {
      return lastCheckInDate.getDay() === 6; // Saturday to Monday (skipping Sunday)
    }
    
    return false;
  }

  /**
   * Format reward description for display
   * @param result - RewardCalculationResult
   * @returns Formatted string for UI display
   */
  formatRewardDescription(result: RewardCalculationResult): string {
    return `🎉 Timer Complete! Earned ${result.coinsEarned} coins (${result.description})`;
  }

  /**
   * Get preview of next day's reward
   * @param currentStreak - Current streak count
   * @param gymSettings - Optional gym settings
   * @returns Next day's potential reward
   */
  getNextDayRewardPreview(
    currentStreak: number, 
    gymSettings?: Partial<StreakRewardSettings>
  ): RewardCalculationResult {
    return this.calculateTimerCompletionReward(currentStreak + 1, gymSettings);
  }
}

export const rewardCalculationService = new RewardCalculationService();
export type { StreakRewardSettings, RewardCalculationResult };