// github.com/xxrenzhe/autoads/services/siterank/internal/events/handler.go
package events

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/google/uuid"
)

// WorkflowStepStartedPayload defines the incoming event structure.
type WorkflowStepStartedPayload struct {
	WorkflowProgressID string                 `json:"workflowProgressId"`
	UserID             string                 `json:"userId"`
	Step               int                    `json:"step"`
	Context            map[string]interface{} `json:"context"`
}

// SiterankAnalysisCompletedPayload defines the outgoing event structure.
type SiterankAnalysisCompletedPayload struct {
	AnalysisID  string  `json:"analysisId"`
	UserID      string  `json:"userId"`
	OfferID     string  `json:"offerId"`
	Score       float64 `json:"score"`
}

// simulateSiterankAnalysis mocks a call to an external service like SimilarWeb.
func simulateSiterankAnalysis(url string) (float64, map[string]interface{}) {
	log.Printf("Simulating siterank analysis for URL: %s", url)
	time.Sleep(2 * time.Second) // Simulate network latency
	
	// Generate a random score between 0 and 100.
	score := rand.Float64() * 100
	
	result := map[string]interface{}{
		"globalRank": rand.Intn(1000000),
		"country":    "United States",
		"traffic":    fmt.Sprintf("%dK", rand.Intn(500)+10),
		"score":      score,
	}
	log.Printf("Analysis complete. Score: %.2f", score)
	return score, result
}

// HandleWorkflowStepStarted processes the event to perform a siterank analysis.
func HandleWorkflowStepStarted(ctx context.Context, db *sql.DB, publisher *Publisher, payload []byte) error {
	var data WorkflowStepStartedPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	// This handler is only interested in Step 1 of the workflow.
	if data.Step != 1 {
		return nil // Not an error, just skipping.
	}

	offerID, ok := data.Context["offerId"].(string)
	if !ok || offerID == "" {
		return fmt.Errorf("offerId not found or invalid in workflow context")
	}
	url, ok := data.Context["originalUrl"].(string)
	if !ok || url == "" {
		return fmt.Errorf("originalUrl not found or invalid in workflow context")
	}

	log.Printf("Starting siterank analysis for offerID: %s", offerID)

	score, result := simulateSiterankAnalysis(url)
	resultJSON, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("failed to marshal analysis result: %w", err)
	}

	analysisID := uuid.New().String()
	
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()
	
	// Insert the analysis result into the SiterankAnalysis read model.
	_, err = tx.ExecContext(ctx, `
        INSERT INTO "SiterankAnalysis"
        (id, "userId", "offerId", status, result, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, 'completed', $4, NOW(), NOW())
		ON CONFLICT ("offerId") DO UPDATE SET
		status = 'completed', result = $4, "updatedAt" = NOW()
    `, analysisID, data.UserID, offerID, resultJSON)
	if err != nil {
		return fmt.Errorf("failed to insert siterank analysis: %w", err)
	}

	// Publish an event to notify that the analysis is complete.
	completedPayload := SiterankAnalysisCompletedPayload{
		AnalysisID: analysisID,
		UserID:     data.UserID,
		OfferID:    offerID,
		Score:      score,
	}

	if err := publisher.Publish(ctx, "SiterankAnalysisCompleted", completedPayload); err != nil {
		return fmt.Errorf("failed to publish completion event: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	
	log.Printf("Successfully completed siterank analysis for offerID: %s", offerID)
	return nil
}
