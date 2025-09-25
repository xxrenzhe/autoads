package projectors

import (
	"context"
	"database/sql"
	"log"
	"github.com/xxrenzhe/autoads/services/offer/internal/domain"
)

// OfferProjector handles events related to Offers and updates the read model.
type OfferProjector struct {
	db *sql.DB
}

// NewOfferProjector creates a new OfferProjector.
func NewOfferProjector(db *sql.DB) *OfferProjector {
	return &OfferProjector{db: db}
}

// HandleOfferCreated projects the OfferCreatedEvent into the database.
func (p *OfferProjector) HandleOfferCreated(ctx context.Context, event domain.OfferCreatedEvent) error {
	log.Printf("PROJECTOR: Handling OfferCreatedEvent for offer ID %s", event.OfferID)

    query := `
        INSERT INTO "Offer" (id, userid, name, originalurl, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING`

	_, err := p.db.ExecContext(ctx, query, event.OfferID, event.UserID, event.Name, event.OriginalUrl, event.Status, event.CreatedAt)
	if err != nil {
		log.Printf("ERROR: Failed to project OfferCreatedEvent for offer ID %s: %v", event.OfferID, err)
		return err
	}

	log.Printf("PROJECTOR: Successfully projected OfferCreatedEvent for offer ID %s", event.OfferID)
	return nil
}
