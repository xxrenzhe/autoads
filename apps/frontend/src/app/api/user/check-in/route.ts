
import { NextRequest, NextResponse } from "next/server";
import { requireIdempotencyKey } from "@/lib/utils/idempotency";
import { auth } from "@/lib/auth/v5-config";
import { Logger } from "@/lib/core/Logger";
import { checkNewAccountLimits } from "@/lib/security/anti-cheat-middleware";
import { publishEvent } from "@/lib/events/publish";
import { getStreakCount, updateCheckInStatus } from "@/lib/services/check-in-service";
import { startOfDay, endOfDay, subDays, format } from "date-fns";
import { prisma } from "@/lib/db";

const logger = new Logger("USER-CHECK-IN-ROUTE");

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
  if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    // Minimal status response for GET
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * Perform daily check-in (Event-Driven Refactor)
 */
export async function POST(request: NextRequest) {
  try {
    const idempotencyKey = requireIdempotencyKey(request as any);
    const session = await auth();

    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = session;

    const limitCheck = await checkNewAccountLimits(userId, "check-in");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { success: false, error: limitCheck.reason || "Account restricted" },
        { status: 403 }
      );
    }
    
    // The service reads from Firestore to make a quick, real-time decision.
    const { streak, canCheckIn } = await getStreakCount(userId);

    if (!canCheckIn) {
      return NextResponse.json(
        { error: "Already checked in today" },
        { status: 400 }
      );
    }
    
    const nextStreak = streak + 1;

    // Publish an event. This is the core responsibility.
    await publishEvent("UserCheckedIn", {
      userId,
      streak: nextStreak,
      idempotencyKey,
    });

    // After publishing, update the fast-access status in Firestore to prevent race conditions.
    await updateCheckInStatus(userId, nextStreak);

    logger.info(`"UserCheckedIn" event published for user: ${userId}`, {
      userId,
      streak: nextStreak,
    });
    
    // Respond immediately. The reward is handled by a separate service.
    return NextResponse.json({
      success: true,
      message: "Check-in recorded. Your reward is being processed.",
      streak: nextStreak,
    });

  } catch (error) {
    const status = (error as any)?.status || 500;
    logger.error("Failed to publish check-in event:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        success: false,
        error: status === 400 ? "Missing Idempotency-Key header" : "Failed to process check-in",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status }
    );
  }
}
