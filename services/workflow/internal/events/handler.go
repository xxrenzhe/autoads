
// github.com/xxrenzhe/autoads/services/workflow/internal/events/handler.go
package events

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	"github.com/google/uuid"
)

// OfferCreatedPayload defines the structure for the "OfferCreated" event.
type OfferCreatedPayload struct {
	ID          string `json:"id"`
	UserID      string `json:"userId"`
	Name        string `json:"name"`
	OriginalURL string `json:"originalUrl"`
}

// WorkflowStepStartedPayload defines the event for starting a workflow step.
type WorkflowStepStartedPayload struct {
	WorkflowProgressID string                 `json:"workflowProgressId"`
	UserID             string                 `json:"userId"`
	Step               int                    `json:"step"`
	Context            map[string]interface{} `json:"context"`
}


// HandleOfferCreated starts a new workflow and publishes an event to trigger the first step.
func HandleOfferCreated(ctx context.Context, db *sql.DB, publisher *Publisher, payload []byte) error {
	var data OfferCreatedPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		return fmt.Errorf("failed to unmarshal OfferCreated payload: %w", err)
	}

	log.Printf("Processing OfferCreated event for offerID: %s, userID: %s", data.ID, data.UserID)

	const workflowTemplateID = "clx123abc456def789ghi" // Example static ID
	const startingStep = 1

	workflowContext := map[string]interface{}{
		"offerId":     data.ID,
		"originalUrl": data.OriginalURL,
	}
	contextJSON, err := json.Marshal(workflowContext)
	if err != nil {
		return fmt.Errorf("failed to marshal workflow context: %w", err)
	}

	workflowProgressID := uuid.New().String()

	// Using a transaction to ensure we only publish if the workflow is created.
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `
        INSERT INTO "UserWorkflowProgress"
        (id, "userId", "templateId", "currentStep", status, context)
        VALUES ($1, $2, $3, $4, 'in_progress', $5)
    `, workflowProgressID, data.UserID, workflowTemplateID, startingStep, contextJSON)

	if err != nil {
		return fmt.Errorf("failed to create workflow progress record: %w", err)
	}

	// Now, publish the event to trigger the first step.
	stepStartedPayload := WorkflowStepStartedPayload{
		WorkflowProgressID: workflowProgressID,
		UserID:             data.UserID,
		Step:               startingStep,
		Context:            workflowContext,
	}

	if err := publisher.Publish(ctx, "WorkflowStepStarted", stepStartedPayload); err != nil {
		return fmt.Errorf("failed to publish WorkflowStepStarted event: %w", err)
	}
	
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("Successfully started workflow and published Step 1 trigger for offerID: %s", data.ID)
	return nil
}
