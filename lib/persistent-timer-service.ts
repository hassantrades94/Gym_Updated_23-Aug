import { toast } from 'sonner';
import { rewardCalculationService, type RewardCalculationResult } from './reward-calculation-service';

interface TimerState {
  isActive: boolean;
  startTime: number | null;
  elapsedTime: number;
  userId: string | null;
  gymId: string | null;
  sessionId: string;
  lastUpdate: number;
  lastStartDate: string | null; // Track last start date (YYYY-MM-DD format)
  isWithinGeofence: boolean; // Track if user is within geofenced area
  geofenceEntryTime: number | null; // When user entered geofence
}

interface TimerCallbacks {
  onTimerUpdate?: (elapsedTime: number, formattedTime: string) => void;
  onTimerStart?: () => void;
  onTimerStop?: () => void;
  onTimerComplete?: (rewardResult?: RewardCalculationResult) => void;
}

class PersistentTimerService {
  private timerState: TimerState = {
    isActive: false,
    startTime: null,
    elapsedTime: 0,
    userId: null,
    gymId: null,
    sessionId: this.generateSessionId(),
    lastUpdate: Date.now(),
    lastStartDate: null,
    isWithinGeofence: false,
    geofenceEntryTime: null,
  };

  private timerInterval: NodeJS.Timeout | null = null;
  private callbacks: TimerCallbacks = {};
  private readonly STORAGE_KEY = 'flexio_timer_state';
  private readonly UPDATE_INTERVAL = 1000; // 1 second
  private readonly MAX_TIMER_DURATION = 20 * 60 * 1000; // 20 minutes

  constructor() {
    // Only run browser-specific code if we're in a browser environment
    if (typeof window !== 'undefined') {
      this.loadTimerState();
      this.setupVisibilityHandlers();
      this.setupStorageListener();
      
      // Resume timer if it was active
      if (this.timerState.isActive) {
        this.resumeTimer();
      }
    }
  }

  setCallbacks(callbacks: TimerCallbacks) {
    this.callbacks = callbacks;
  }

  startTimer(userId: string, gymId: string): boolean {
    if (this.timerState.isActive) {
      console.log('Timer is already active');
      return false;
    }

    // Check if timer was already started today (daily restriction)
    const today = new Date().toISOString().split('T')[0];
    if (this.timerState.lastStartDate === today) {
      console.log('Timer already started today. Only one timer per calendar day is allowed.');
      return false;
    }

    const now = Date.now();
    this.timerState = {
      isActive: true,
      startTime: now,
      elapsedTime: 0,
      userId,
      gymId,
      sessionId: this.generateSessionId(),
      lastUpdate: now,
      lastStartDate: today,
      isWithinGeofence: this.timerState.isWithinGeofence,
      geofenceEntryTime: this.timerState.geofenceEntryTime,
    };

    this.saveTimerState();
    this.startTimerInterval();
    console.log('Timer started for user:', userId, 'at gym:', gymId);
    return true;
  }

  stopTimer(): void {
    if (!this.timerState.isActive) return;

    this.timerState.isActive = false;
    this.timerState.startTime = null;
    this.timerState.elapsedTime = 0;
    
    this.clearTimerInterval();
    this.saveTimerState();
    this.callbacks.onTimerStop?.();
  }

  // Update geofence status and handle timer logic
  updateGeofenceStatus(isWithinGeofence: boolean, entryTime?: number): void {
    const wasWithinGeofence = this.timerState.isWithinGeofence;
    this.timerState.isWithinGeofence = isWithinGeofence;
    
    if (isWithinGeofence && !wasWithinGeofence) {
      // User entered geofence
      this.timerState.geofenceEntryTime = entryTime || Date.now();
    } else if (!isWithinGeofence && wasWithinGeofence) {
      // User left geofence - reset timer only if active
      this.timerState.geofenceEntryTime = null;
      if (this.timerState.isActive) {
        console.log('Timer stopped - user exited geofenced area');
        this.stopTimer();
      }
    }
    
    this.saveTimerState();
  }

  // Check if timer should be preserved during page refresh
  shouldPreserveTimer(): boolean {
    return this.timerState.isWithinGeofence && this.timerState.isActive;
  }

  pauseTimer(): void {
    if (!this.timerState.isActive) return;
    
    this.updateElapsedTime();
    this.clearTimerInterval();
    this.saveTimerState();
  }

  resumeTimer(): void {
    if (!this.timerState.isActive) return;
    
    // Recalculate elapsed time in case of interruption
    this.updateElapsedTime();
    
    // Check if timer should have completed during interruption
    if (this.timerState.elapsedTime >= this.MAX_TIMER_DURATION) {
      this.completeTimer();
      return;
    }
    
    this.startTimerInterval();
  }

  private startTimerInterval(): void {
    this.clearTimerInterval();
    
    this.timerInterval = setInterval(() => {
      this.updateElapsedTime();
      
      const formattedTime = this.formatTime(this.timerState.elapsedTime);
      this.callbacks.onTimerUpdate?.(this.timerState.elapsedTime, formattedTime);
      
      // Check if timer should complete
      if (this.timerState.elapsedTime >= this.MAX_TIMER_DURATION) {
        this.completeTimer();
      }
      
      this.saveTimerState();
    }, this.UPDATE_INTERVAL);
  }

  private clearTimerInterval(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private updateElapsedTime(): void {
    if (!this.timerState.isActive || !this.timerState.startTime) return;
    
    const now = Date.now();
    this.timerState.elapsedTime = now - this.timerState.startTime;
    this.timerState.lastUpdate = now;
  }

  private async completeTimer(): Promise<void> {
    this.clearTimerInterval();
    
    // Calculate and award coins based on streak
    let rewardResult: RewardCalculationResult | undefined;
    
    if (this.timerState.userId && this.timerState.gymId) {
      try {
        // Get current user streak (this would normally come from database)
        const currentStreak = await this.getCurrentUserStreak(this.timerState.userId);
        
        // Get gym-specific reward settings
        const gymSettings = await rewardCalculationService.getGymRewardSettings(this.timerState.gymId);
        
        // Calculate reward based on streak and gym settings
        rewardResult = rewardCalculationService.calculateTimerCompletionReward(currentStreak, gymSettings);
        
        // Award coins to user (this would normally update database)
        await this.awardCoinsToUser(this.timerState.userId, rewardResult.coinsEarned, rewardResult.description);
        
        // Show success message with formatted reward description
        toast.success(rewardCalculationService.formatRewardDescription(rewardResult));
      } catch (error) {
        console.error('Failed to calculate or award timer completion reward:', error);
        toast.error('Timer completed but failed to award coins. Please contact support.');
      }
    }
    
    this.callbacks.onTimerComplete?.(rewardResult);
    this.stopTimer();
  }

  private saveTimerState(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.timerState));
      }
    } catch (error) {
      console.error('Failed to save timer state:', error);
    }
  }

  private loadTimerState(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
          const parsedState = JSON.parse(saved);
          
          // Validate and restore state
          if (this.isValidTimerState(parsedState)) {
            this.timerState = parsedState;
            
            // Enhanced timer restoration logic
            if (this.timerState.isActive && this.timerState.startTime) {
              const now = Date.now();
              const totalElapsed = now - this.timerState.startTime;
              
              // Check if timer should be preserved (within geofence)
              if (this.shouldPreserveTimer()) {
                // Restore timer with accumulated elapsed time
                this.timerState.elapsedTime = totalElapsed;
                
                // Check if timer has exceeded maximum duration
                if (totalElapsed >= this.MAX_TIMER_DURATION) {
                  // Timer completed while away, trigger completion
                  this.completeTimer();
                } else {
                  console.log('Timer restored from page refresh - remaining within geofence');
                }
              } else {
                // User not within geofence, reset timer
                console.log('Timer reset - user not within geofenced area');
                this.resetTimerState();
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load timer state:', error);
      this.resetTimerState();
    }
  }

  private isValidTimerState(state: any): boolean {
    return (
      typeof state === 'object' &&
      typeof state.isActive === 'boolean' &&
      (state.startTime === null || typeof state.startTime === 'number') &&
      typeof state.elapsedTime === 'number' &&
      typeof state.sessionId === 'string' &&
      typeof state.isWithinGeofence === 'boolean' &&
      (state.geofenceEntryTime === null || typeof state.geofenceEntryTime === 'number')
    );
  }

  private resetTimerState(): void {
    this.timerState = {
      isActive: false,
      startTime: null,
      elapsedTime: 0,
      userId: null,
      gymId: null,
      sessionId: this.generateSessionId(),
      lastUpdate: Date.now(),
      lastStartDate: null,
      isWithinGeofence: false,
      geofenceEntryTime: null,
    };
    this.saveTimerState();
  }

  private setupVisibilityHandlers(): void {
    // Only setup handlers if we're in a browser environment
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      // Handle page visibility changes
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.pauseTimer();
        } else {
          this.resumeTimer();
        }
      });

      // Handle page unload
      window.addEventListener('beforeunload', () => {
        this.pauseTimer();
      });

      // Handle page focus/blur
      window.addEventListener('focus', () => {
        this.resumeTimer();
      });

      window.addEventListener('blur', () => {
        this.pauseTimer();
      });
    }
  }

  private setupStorageListener(): void {
    // Only setup storage listener if we're in a browser environment
    if (typeof window !== 'undefined') {
      // Listen for storage changes from other tabs
      window.addEventListener('storage', (event) => {
        if (event.key === this.STORAGE_KEY && event.newValue) {
          try {
            const newState = JSON.parse(event.newValue);
            if (this.isValidTimerState(newState)) {
              this.timerState = newState;
              
              if (this.timerState.isActive) {
                this.resumeTimer();
              } else {
                this.clearTimerInterval();
              }
            }
          } catch (error) {
            console.error('Failed to sync timer state from storage:', error);
          }
        }
      });
    }
  }

  private generateSessionId(): string {
    return `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatTime(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Public getters
  isTimerActive(): boolean {
    return this.timerState.isActive;
  }

  getElapsedTime(): number {
    return this.timerState.elapsedTime;
  }

  getFormattedTime(): string {
    return this.formatTime(this.timerState.elapsedTime);
  }

  getRemainingTime(): number {
    return Math.max(0, this.MAX_TIMER_DURATION - this.timerState.elapsedTime);
  }

  canStartTimerToday(): boolean {
    const today = new Date().toISOString().split('T')[0];
    return this.timerState.lastStartDate !== today && !this.timerState.isActive;
  }

  getFormattedRemainingTime(): string {
    return this.formatTime(this.getRemainingTime());
  }

  getTimerState(): TimerState {
    return { ...this.timerState };
  }

  // Helper methods for reward system integration
  private async getCurrentUserStreak(userId: string): Promise<number> {
    // This would normally fetch from your database
    // For now, return a mock value
    return 1;
  }

  private async awardCoinsToUser(userId: string, coins: number, description: string): Promise<void> {
    // This would normally update your database
    console.log(`Awarding ${coins} coins to user ${userId}: ${description}`);
  }

  // Cleanup method
  destroy(): void {
    this.clearTimerInterval();
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', () => {});
      window.removeEventListener('beforeunload', () => {});
      window.removeEventListener('focus', () => {});
      window.removeEventListener('blur', () => {});
      window.removeEventListener('storage', () => {});
    }
  }
}

export const persistentTimerService = new PersistentTimerService();
export default PersistentTimerService;