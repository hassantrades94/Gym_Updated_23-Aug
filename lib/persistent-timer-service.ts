interface TimerState {
  isActive: boolean;
  startTime: number | null;
  elapsedTime: number;
  userId: string | null;
  gymId: string | null;
  sessionId: string;
  lastUpdate: number;
}

interface TimerCallbacks {
  onTimerUpdate?: (elapsedTime: number, formattedTime: string) => void;
  onTimerComplete?: () => void;
  onTimerStart?: () => void;
  onTimerStop?: () => void;
}

class PersistentTimerService {
  private timerState: TimerState = {
    isActive: false,
    startTime: null,
    elapsedTime: 0,
    userId: null,
    gymId: null,
    sessionId: '',
    lastUpdate: Date.now()
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
      return false; // Timer already active
    }

    const now = Date.now();
    this.timerState = {
      isActive: true,
      startTime: now,
      elapsedTime: 0,
      userId,
      gymId,
      sessionId: this.generateSessionId(),
      lastUpdate: now
    };

    this.saveTimerState();
    this.startTimerInterval();
    this.callbacks.onTimerStart?.();
    
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

  private completeTimer(): void {
    this.clearTimerInterval();
    this.callbacks.onTimerComplete?.();
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
            
            // Update elapsed time based on interruption duration
            if (this.timerState.isActive && this.timerState.startTime) {
              const now = Date.now();
              this.timerState.elapsedTime = now - this.timerState.startTime;
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
      typeof state.sessionId === 'string'
    );
  }

  private resetTimerState(): void {
    this.timerState = {
      isActive: false,
      startTime: null,
      elapsedTime: 0,
      userId: null,
      gymId: null,
      sessionId: '',
      lastUpdate: Date.now()
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

  getFormattedRemainingTime(): string {
    return this.formatTime(this.getRemainingTime());
  }

  getTimerState(): TimerState {
    return { ...this.timerState };
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