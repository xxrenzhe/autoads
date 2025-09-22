package projectors

import (
	"context"
	"log"
	"github.com/xxrenzhe/autoads/services/workflow/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

// WorkflowProjector handles events related to workflows
// and projects them into the read model.
type WorkflowProjector struct {
	db *pgxpool.Pool
}

// NewWorkflowProjector creates a new WorkflowProjector.
func NewWorkflowProjector(db *pgxpool.Pool) *WorkflowProjector {
	return &WorkflowProjector{db: db}
}

// HandleWorkflowStarted projects the WorkflowStartedEvent into the database.
func (p *WorkflowProjector) HandleWorkflowStarted(ctx context.Context, event domain.WorkflowStartedEvent) error {
	log.Printf("PROJECTOR: Handling WorkflowStartedEvent for workflow ID %s", event.WorkflowID)

	_, err := p.db.Exec(ctx,
		`INSERT INTO "UserWorkflowProgress" (id, "userId", "templateId", status, "currentStep", "createdAt") 
		 VALUES ($1, $2, $3, $4, $5, $6) 
		 ON CONFLICT (id) DO NOTHING`,
		event.WorkflowID, event.UserID, event.TemplateID, event.Status, event.CurrentStep, event.StartedAt)

	if err != nil {
		log.Printf("ERROR: Failed to project WorkflowStartedEvent for workflow ID %s: %v", event.WorkflowID, err)
		return err
	}

	log.Printf("PROJECTOR: Successfully projected WorkflowStartedEvent for workflow ID %s", event.WorkflowID)
	return nil
}
