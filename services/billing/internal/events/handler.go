
// services/billing/internal/events/handler.go
package events

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log" // Using standard log for simplicity in this module
)

// UserCheckedInPayload defines the expected structure for "UserCheckedIn" event data.
type UserCheckedInPayload struct {
	UserID         string `json:"userId"`
	Streak         int    `json:"streak"`
	IdempotencyKey string `json:"idempotencyKey"`
}

// OnboardingStepCompletedPayload defines the structure for its event.
type OnboardingStepCompletedPayload struct {
	UserID       string `json:"userId"`
	StepID       string `json:"stepId"`
	RewardTokens int    `json:"rewardTokens"`
}


// getRewardTokens calculates the token reward based on the streak.
// This logic is ported from the original Next.js route.
func getRewardTokens(streak int) int {
	if streak == 1 {
		return 10
	}
	if streak == 2 {
		return 20
	}
	if streak == 3 {
		return 40
	}
	return 80 // 4+ days
}

// HandleUserCheckedIn processes the UserCheckedIn event to grant token rewards.
func HandleUserCheckedIn(ctx context.Context, db *sql.DB, payload []byte) error {
	var data UserCheckedInPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		return fmt.Errorf("failed to unmarshal UserCheckedIn payload: %w", err)
	}

	log.Printf("Processing UserCheckedIn event for userID: %s, streak: %d", data.UserID, data.Streak)

	rewardTokens := getRewardTokens(data.Streak)

	// Begin a new database transaction.
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback() // Rollback is a no-op if the transaction is committed.

	// 1. Get current token balance.
	var balanceBefore int64
	err = tx.QueryRowContext(ctx, `SELECT balance FROM "UserToken" WHERE "userId" = $1 FOR UPDATE`, data.UserID).Scan(&balanceBefore)
	if err != nil {
		if err == sql.ErrNoRows {
			// If the user has no token record, assume balance is 0.
			balanceBefore = 0
		} else {
			return fmt.Errorf("failed to query user token balance: %w", err)
		}
	}

	balanceAfter := balanceBefore + int64(rewardTokens)

	// 2. Create the CheckIn record.
	_, err = tx.ExecContext(ctx,
		`INSERT INTO "CheckIn" (id, "userId", date, tokens, streak) VALUES (DEFAULT, $1, NOW(), $2, $3)`,
		data.UserID, rewardTokens, data.Streak,
	)
	if err != nil {
		// We can ignore unique constraint violation errors for idempotency.
		// A more robust solution would check the idempotency key against a separate table.
		if !isUniqueViolation(err) {
			return fmt.Errorf("failed to create checkin record: %w", err)
		}
	}

	// 3. Upsert the UserToken balance.
	_, err = tx.ExecContext(ctx, `
        INSERT INTO "UserToken" ("userId", balance, "updatedAt")
        VALUES ($1, $2, NOW())
        ON CONFLICT ("userId") DO UPDATE SET
        balance = "UserToken".balance + $2,
        "updatedAt" = NOW()
    `, data.UserID, rewardTokens)
	if err != nil {
		return fmt.Errorf("failed to upsert user token balance: %w", err)
	}

	// 4. Create a TokenTransaction record.
	_, err = tx.ExecContext(ctx, `
        INSERT INTO "TokenTransaction"
        (id, "userId", type, amount, "balanceBefore", "balanceAfter", source, description, metadata, "createdAt")
        VALUES (DEFAULT, $1, 'ACTIVITY', $2, $3, $4, 'daily_check_in', $5, $6, NOW())
    `, data.UserID, rewardTokens, balanceBefore, balanceAfter,
		fmt.Sprintf("Daily check-in reward (Day %d)", data.Streak),
		fmt.Sprintf(`{"streak":%d,"idempotencyKey":"%s"}`, data.Streak, data.IdempotencyKey),
	)
	if err != nil {
		return fmt.Errorf("failed to create token transaction: %w", err)
	}

	// Commit the transaction.
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("Successfully processed check-in for userID: %s. Awarded %d tokens.", data.UserID, rewardTokens)
	return nil
}

// HandleOnboardingStepCompleted processes the event to grant rewards for completing a step.
func HandleOnboardingStepCompleted(ctx context.Context, db *sql.DB, payload []byte) error {
	var data OnboardingStepCompletedPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		return fmt.Errorf("failed to unmarshal OnboardingStepCompleted payload: %w", err)
	}

	log.Printf("Processing OnboardingStepCompleted event for userID: %s, step: %s", data.UserID, data.StepID)

	rewardTokens := data.RewardTokens
	if rewardTokens <= 0 {
		log.Printf("No reward for step %s. Skipping.", data.StepID)
		return nil // Not an error, just no action needed.
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// 1. Mark the step as completed for the user in the read model.
	// This makes the operation idempotent.
	_, err = tx.ExecContext(ctx, `
        INSERT INTO "UserChecklistProgress" (id, "userId", "stepId", "isCompleted", "completedAt")
        VALUES (DEFAULT, $1, $2, TRUE, NOW())
        ON CONFLICT ("userId", "stepId") DO NOTHING
    `, data.UserID, data.StepID)
	if err != nil {
		return fmt.Errorf("failed to mark onboarding step as completed: %w", err)
	}

	// 2. Get current token balance.
	var balanceBefore int64
	err = tx.QueryRowContext(ctx, `SELECT balance FROM "UserToken" WHERE "userId" = $1 FOR UPDATE`, data.UserID).Scan(&balanceBefore)
	if err != nil {
		if err == sql.ErrNoRows {
			balanceBefore = 0
		} else {
			return fmt.Errorf("failed to query user token balance: %w", err)
		}
	}

	// 3. Upsert the UserToken balance.
	_, err = tx.ExecContext(ctx, `
        INSERT INTO "UserToken" ("userId", balance, "updatedAt")
        VALUES ($1, $2, NOW())
        ON CONFLICT ("userId") DO UPDATE SET
        balance = "UserToken".balance + $2,
        "updatedAt" = NOW()
    `, data.UserID, rewardTokens)
	if err != nil {
		return fmt.Errorf("failed to upsert user token balance: %w", err)
	}

	// 4. Create a TokenTransaction record.
	_, err = tx.ExecContext(ctx, `
        INSERT INTO "TokenTransaction"
        (id, "userId", type, amount, "balanceBefore", "balanceAfter", source, description, metadata, "createdAt")
        VALUES (DEFAULT, $1, 'ACTIVITY', $2, $3, $4, 'onboarding_reward', $5, $6, NOW())
    `, data.UserID, rewardTokens, balanceBefore, balanceBefore+int64(rewardTokens),
		fmt.Sprintf("Onboarding reward for step: %s", data.StepID),
		fmt.Sprintf(`{"stepId":"%s"}`, data.StepID),
	)
	if err != nil {
		return fmt.Errorf("failed to create token transaction for onboarding: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("Successfully processed onboarding step for userID: %s. Awarded %d tokens.", data.UserID, rewardTokens)
	return nil
}


// isUniqueViolation checks if an error is a PostgreSQL unique violation error.
func isUniqueViolation(err error) bool {
	// This is a simplified check. In a real application, you'd use the driver-specific error code.
	// For pq, the code is '23505'.
	return err != nil && len(err.Error()) > 18 && err.Error()[12:17] == "23505"
}
