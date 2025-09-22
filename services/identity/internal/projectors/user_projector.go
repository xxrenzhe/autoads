package projectors

import (
	"context"
	"github.com/xxrenzhe/autoads/services/identity/internal/domain"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

// UserProjector handles events related to the User domain
// and projects them into the user read model.
type UserProjector struct {
	db *pgxpool.Pool
}

// NewUserProjector creates a new UserProjector.
func NewUserProjector(db *pgxpool.Pool) *UserProjector {
	return &UserProjector{db: db}
}

// HandleUserRegistered projects the UserRegisteredEvent into the database.
func (p *UserProjector) HandleUserRegistered(ctx context.Context, event domain.UserRegisteredEvent) error {
	log.Printf("PROJECTOR: Handling UserRegisteredEvent for user ID %s", event.UserID)

	// Insert user data into the read model.
	// This is an idempotent operation if the primary key (id) is set.
	// If the event is processed twice, the second insert will fail safely.
	_, err := p.db.Exec(ctx,
		`INSERT INTO "User" (id, email, name, role, "createdAt", "lastLoginAt") VALUES ($1, $2, $3, $4, $5, $5) ON CONFLICT (id) DO NOTHING`,
		event.UserID, event.Email, event.DisplayName, event.Role, event.RegisteredAt)

	if err != nil {
		log.Printf("ERROR: Failed to project UserRegisteredEvent for user ID %s: %v", event.UserID, err)
		return err
	}

	log.Printf("PROJECTOR: Successfully projected UserRegisteredEvent for user ID %s", event.UserID)
	return nil
}
