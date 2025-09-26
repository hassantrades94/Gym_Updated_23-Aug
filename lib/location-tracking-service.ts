interface LocationData {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
}

interface LocationHistoryEntry {
  location: LocationData;
  isWithinRadius: boolean;
  distance: number;
}

interface TrackingState {
  isWithinRadius: boolean;
  entryTime: number | null;
  continuousPresenceTime: number;
  lastPosition: LocationData | null;
  checkInTriggered: boolean;
  locationHistory: LocationHistoryEntry[];
  validationStatus: {
    withinRadius: boolean;
    hasRequiredPresence: boolean;
    canCheckIn: boolean;
  };
}

// Import the persistent timer service
import { persistentTimerService } from './persistent-timer-service';

class LocationTrackingService {
  private trackingState: TrackingState = {
    isWithinRadius: false,
    entryTime: null,
    continuousPresenceTime: 0,
    lastPosition: null,
    checkInTriggered: false,
    locationHistory: [],
    validationStatus: {
      withinRadius: false,
      hasRequiredPresence: false,
      canCheckIn: false,
    },
  };

  private gymLocation: { lat: number; lng: number } | null = null;
  private watchId: number | null = null;
  private trackingInterval: NodeJS.Timeout | null = null;
  private validationInterval: NodeJS.Timeout | null = null;
  private onLocationUpdate?: (data: {
    distance: number;
    isWithinRadius: boolean;
    continuousTime: number;
    canAutoCheckIn: boolean;
    canManualCheckIn: boolean;
    validationStatus: {
      withinRadius: boolean;
      hasRequiredPresence: boolean;
      canCheckIn: boolean;
    };
    currentPosition: LocationData;
    lastPosition: LocationData;
  }) => void;
  private onAutoCheckIn?: () => void;

  private readonly GEOFENCE_RADIUS = 25; // meters - updated from 15 to 25
  private readonly REQUIRED_PRESENCE_TIME = 20 * 60 * 1000; // 20 minutes in milliseconds
  private readonly TRACKING_INTERVAL = 3000; // 3 seconds for more precise tracking
  private readonly VALIDATION_INTERVAL = 1000; // 1 second for real-time validation
  private readonly HISTORY_RETENTION_TIME = 30 * 60 * 1000; // 30 minutes
  private readonly MIN_ACCURACY = 50; // meters - minimum GPS accuracy required

  setGymLocation(location: { lat: number; lng: number }) {
    this.gymLocation = location;
  }

  setCallbacks(callbacks: {
    onLocationUpdate?: (data: {
      distance: number;
      isWithinRadius: boolean;
      continuousTime: number;
      canAutoCheckIn: boolean;
      canManualCheckIn: boolean;
      validationStatus: {
        withinRadius: boolean;
        hasRequiredPresence: boolean;
        canCheckIn: boolean;
      };
      currentPosition: LocationData;
      lastPosition: LocationData;
    }) => void;
    onAutoCheckIn?: () => void;
  }) {
    this.onLocationUpdate = callbacks.onLocationUpdate;
    this.onAutoCheckIn = callbacks.onAutoCheckIn;
  }

  startTracking(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.gymLocation) {
        reject(new Error('Gym location not set'));
        return;
      }

      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      // Start continuous location watching with high accuracy
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const currentLocation: LocationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: Date.now(),
            accuracy: position.coords.accuracy,
          };

          // Only process location if accuracy is acceptable
          if (!currentLocation.accuracy || currentLocation.accuracy <= this.MIN_ACCURACY) {
            this.updateLocation(currentLocation);
          }
          resolve();
        },
        (error) => {
          console.error('Geolocation error:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 2000, // Accept cached location up to 2 seconds
        }
      );

      // Start tracking interval for continuous monitoring
      this.trackingInterval = setInterval(() => {
        this.checkContinuousPresence();
        this.cleanupLocationHistory();
      }, this.TRACKING_INTERVAL);

      // Start validation interval for real-time status updates
      this.validationInterval = setInterval(() => {
        this.validateCheckInRequirements();
      }, this.VALIDATION_INTERVAL);
    });
  }

  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }

    this.resetTrackingState();
  }

  private updateLocation(location: LocationData) {
    if (!this.gymLocation) return;

    const distance = this.calculateDistance(
      location.lat,
      location.lng,
      this.gymLocation.lat,
      this.gymLocation.lng
    );

    const isWithinRadius = distance <= this.GEOFENCE_RADIUS;
    const currentTime = Date.now();

    // Add to location history
    this.trackingState.locationHistory.push({
      location,
      isWithinRadius,
      distance,
    });

    // Check if user entered or left the geofence
    if (isWithinRadius && !this.trackingState.isWithinRadius) {
      // User entered the geofence - start timer automatically if allowed
      this.trackingState.isWithinRadius = true;
      this.trackingState.entryTime = currentTime;
      this.trackingState.checkInTriggered = false;
      
      // Update geofence status in timer service
      persistentTimerService.updateGeofenceStatus(true, currentTime);
      
      // Get user data for timer and check if timer can be started today
      const userData = localStorage.getItem('flexio_user');
      if (userData && persistentTimerService.canStartTimerToday()) {
        const user = JSON.parse(userData);
        const membershipData = localStorage.getItem('flexio_membership');
        if (membershipData) {
          const membership = JSON.parse(membershipData);
          const timerStarted = persistentTimerService.startTimer(user.id, membership.gym_id);
          if (timerStarted) {
            console.log('20-minute countdown timer started automatically');
          }
        }
      } else if (userData && !persistentTimerService.canStartTimerToday()) {
        console.log('Timer already used today - daily limit reached');
      }
      
      console.log('User entered geofence at:', new Date(currentTime));
    } else if (!isWithinRadius && this.trackingState.isWithinRadius) {
      // User left the geofence - update geofence status (timer will be stopped automatically)
      this.trackingState.isWithinRadius = false;
      this.trackingState.entryTime = null;
      this.trackingState.continuousPresenceTime = 0;
      this.trackingState.checkInTriggered = false;
      
      // Update geofence status in timer service (this will stop the timer)
      persistentTimerService.updateGeofenceStatus(false);
      
      console.log('User left geofence at:', new Date(currentTime));
    }

    // Update continuous presence time
    if (isWithinRadius && this.trackingState.entryTime) {
      this.trackingState.continuousPresenceTime = currentTime - this.trackingState.entryTime;
    } else {
      this.trackingState.continuousPresenceTime = 0;
    }

    this.trackingState.lastPosition = location;
    this.validateCheckInRequirements();

    // Trigger callback with updated data
    if (this.onLocationUpdate) {
      this.onLocationUpdate({
        distance,
        isWithinRadius,
        continuousTime: this.trackingState.continuousPresenceTime,
        canAutoCheckIn: this.canTriggerAutoCheckIn(),
        canManualCheckIn: this.canManualCheckIn(),
        validationStatus: this.trackingState.validationStatus,
        currentPosition: location,
        lastPosition: this.trackingState.lastPosition || location,
      });
    }
  }

  private validateCheckInRequirements() {
    const currentTime = Date.now();
    const isCurrentlyWithinRadius = this.trackingState.isWithinRadius;
    const hasRequiredPresence = this.trackingState.continuousPresenceTime >= this.REQUIRED_PRESENCE_TIME;
    
    // Validate using location history for additional verification
    const recentHistory = this.trackingState.locationHistory.filter(
      entry => currentTime - entry.location.timestamp <= this.REQUIRED_PRESENCE_TIME
    );
    
    // Check if user has been consistently within radius for the required time
    const consistentPresence = this.validateConsistentPresence(recentHistory);
    
    this.trackingState.validationStatus = {
      withinRadius: isCurrentlyWithinRadius,
      hasRequiredPresence: hasRequiredPresence && consistentPresence,
      canCheckIn: isCurrentlyWithinRadius && hasRequiredPresence && consistentPresence,
    };
  
    // Notify callback with current status
    if (this.onLocationUpdate && this.trackingState.lastPosition) {
      const distance = this.gymLocation ? this.calculateDistance(
        this.trackingState.lastPosition.lat,
        this.trackingState.lastPosition.lng,
        this.gymLocation.lat,
        this.gymLocation.lng
      ) : 0;
  
      this.onLocationUpdate({
        distance,
        isWithinRadius: isCurrentlyWithinRadius,
        continuousTime: this.trackingState.continuousPresenceTime,
        canAutoCheckIn: this.canTriggerAutoCheckIn(),
        canManualCheckIn: this.trackingState.validationStatus.canCheckIn,
        validationStatus: this.trackingState.validationStatus,
        currentPosition: this.trackingState.lastPosition,
        lastPosition: this.trackingState.lastPosition,
      });
    }
  }

  private validateConsistentPresence(historyEntries: LocationHistoryEntry[]): boolean {
    if (historyEntries.length === 0) return false;
    
    // Sort by timestamp
    const sortedHistory = historyEntries.sort((a, b) => a.location.timestamp - b.location.timestamp);
    
    // Check for any significant gaps or exits from the geofence
    let consecutiveTime = 0;
    let lastTimestamp = sortedHistory[0].location.timestamp;
    
    for (const entry of sortedHistory) {
      if (!entry.isWithinRadius) {
        // If user was outside radius, reset consecutive time
        consecutiveTime = 0;
        lastTimestamp = entry.location.timestamp;
        continue;
      }
      
      // Check for gaps in tracking (more than 2 minutes without data)
      const gap = entry.location.timestamp - lastTimestamp;
      if (gap > 2 * 60 * 1000) {
        consecutiveTime = 0;
      } else {
        consecutiveTime += gap;
      }
      
      lastTimestamp = entry.location.timestamp;
    }
    
    return consecutiveTime >= this.REQUIRED_PRESENCE_TIME;
  }

  private checkContinuousPresence() {
    if (!this.trackingState.isWithinRadius || this.trackingState.checkInTriggered) {
      return;
    }

    const hasRequiredPresence = this.trackingState.continuousPresenceTime >= this.REQUIRED_PRESENCE_TIME;
    const canCheckIn = this.trackingState.validationStatus.canCheckIn;

    if (hasRequiredPresence && canCheckIn && this.onAutoCheckIn) {
      this.trackingState.checkInTriggered = true;
      console.log('Triggering auto check-in after 20 minutes of continuous presence');
      this.onAutoCheckIn();
    }
  }

  private canTriggerAutoCheckIn(): boolean {
    return (
      this.trackingState.isWithinRadius &&
      this.trackingState.continuousPresenceTime >= this.REQUIRED_PRESENCE_TIME &&
      this.trackingState.validationStatus.canCheckIn &&
      !this.trackingState.checkInTriggered
    );
  }

  private cleanupLocationHistory() {
    const currentTime = Date.now();
    this.trackingState.locationHistory = this.trackingState.locationHistory.filter(
      entry => currentTime - entry.location.timestamp <= this.HISTORY_RETENTION_TIME
    );
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // Convert to meters
  }

  private resetTrackingState() {
    this.trackingState = {
      isWithinRadius: false,
      entryTime: null,
      continuousPresenceTime: 0,
      lastPosition: this.trackingState.lastPosition,
      checkInTriggered: false,
      locationHistory: [], // Clear history on reset
      validationStatus: {
        withinRadius: false,
        hasRequiredPresence: false,
        canCheckIn: false,
      },
    };
  }

  // Public methods for validation and status
  canManualCheckIn(): boolean {
    return this.trackingState.validationStatus.canCheckIn;
  }

  getCurrentDistance(): number | null {
    if (!this.trackingState.lastPosition || !this.gymLocation) return null;
    return this.calculateDistance(
      this.trackingState.lastPosition.lat,
      this.trackingState.lastPosition.lng,
      this.gymLocation.lat,
      this.gymLocation.lng
    );
  }

  getTrackingState() {
    return { ...this.trackingState };
  }

  getValidationStatus() {
    return { ...this.trackingState.validationStatus };
  }

  getLocationHistory(): LocationHistoryEntry[] {
    return [...this.trackingState.locationHistory];
  }

  getRemainingTime(): number {
    const remaining = this.REQUIRED_PRESENCE_TIME - this.trackingState.continuousPresenceTime;
    return Math.max(0, remaining);
  }

  formatTime(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }

  // Reset check-in trigger (for manual check-ins)
  resetCheckInTrigger() {
    this.trackingState.checkInTriggered = false;
  }
}

export const locationTrackingService = new LocationTrackingService();
export default LocationTrackingService;