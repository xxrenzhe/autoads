// apps/frontend/src/lib/services/check-in-service.ts
import { firestore } from '@/lib/firebase/firebase-admin'; // Assuming admin SDK is initialized here
import { Logger } from '@/lib/core/Logger';
import { startOfDay, subDays, differenceInCalendarDays } from 'date-fns';

const logger = new Logger('CHECK-IN-SERVICE');

interface CheckInStatus {
  streak: number;
  canCheckIn: boolean;
}

/**
 * Calculates the user's current check-in streak and determines if they can check-in today.
 * This service should primarily use a fast, real-time data store like Firestore.
 *
 * @param userId - The ID of the user.
 * @returns An object containing the current streak and a boolean indicating if a new check-in is allowed.
 */
export async function getStreakCount(userId: string): Promise<CheckInStatus> {
  try {
    const userDocRef = firestore.collection('user_checkins').doc(userId);
    const userDoc = await userDocRef.get();

    const now = new Date();
    
    if (!userDoc.exists) {
      // No check-in history, so they can check-in for the first time.
      return { streak: 0, canCheckIn: true };
    }

    const data = userDoc.data();
    const lastCheckInString = data?.lastCheckIn; // Expecting ISO string e.g., "2023-10-27T10:00:00.000Z"
    
    if (!lastCheckInString) {
      return { streak: 0, canCheckIn: true };
    }
    
    const lastCheckInDate = new Date(lastCheckInString);

    // Check if the last check-in was today.
    if (differenceInCalendarDays(now, lastCheckInDate) === 0) {
      return { streak: data?.streak || 0, canCheckIn: false };
    }

    // Check if the last check-in was yesterday to continue the streak.
    if (differenceInCalendarDays(now, lastCheckInDate) === 1) {
      return { streak: data?.streak || 0, canCheckIn: true };
    }

    // If the gap is more than one day, the streak is broken.
    return { streak: 0, canCheckIn: true };

  } catch (error) {
    logger.error(`Failed to get streak count for user ${userId}:`, error);
    // Fail open: In case of error, assume the user can check in, but with a broken streak.
    // This prevents the system from blocking users due to a service failure.
    return { streak: 0, canCheckIn: true };
  }
}

/**
 * Updates the user's check-in status in Firestore.
 * This should be called after the 'UserCheckedIn' event is successfully published.
 *
 * @param userId - The ID of the user.
 * @param newStreak - The new streak count.
 */
export async function updateCheckInStatus(userId: string, newStreak: number): Promise<void> {
    try {
        const userDocRef = firestore.collection('user_checkins').doc(userId);
        await userDocRef.set({
            lastCheckIn: new Date().toISOString(),
            streak: newStreak,
        }, { merge: true }); // Use merge to avoid overwriting other fields if any
    } catch (error) {
        logger.error(`Failed to update Firestore check-in status for user ${userId}:`, error);
        // This is a critical error and might need alerting/monitoring.
        // If this fails, the user might be able to check-in multiple times.
    }
}
