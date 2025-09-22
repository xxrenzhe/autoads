// github.com/xxrenzhe/autoads/services/offer/internal/events/handler.go
package events

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
)

// SiterankAnalysisCompletedPayload defines the incoming event structure.
type SiterankAnalysisCompletedPayload struct {
	OfferID string  `json:"offerId"`
	Score   float64 `json:"score"`
}

// HandleSiterankAnalysisCompleted updates the offer status after analysis.
func HandleSiterankAnalysisCompleted(ctx context.Context, db *sql.DB, payload []byte) error {
	var data SiterankAnalysisCompletedPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	log.Printf("Processing SiterankAnalysisCompleted event for offerID: %s", data.OfferID)

	// Update the Offer's status and score in the read model.
	// This completes the 'Evaluate' phase of the offer's lifecycle.
	_, err := db.ExecContext(ctx, `
        UPDATE "Offer"
        SET status = 'optimizing', "siterankScore" = $1
        WHERE id = $2
    `, data.Score, data.OfferID)

	if err != nil {
		return fmt.Errorf("failed to update offer status: %w", err)
	}
	
	log.Printf("Successfully updated offer %s to 'optimizing' with score %.2f", data.OfferID, data.Score)
	return nil
}
