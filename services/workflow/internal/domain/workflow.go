package domain

import (
	"encoding/json"
	"time"
)

// WorkflowInstance represents a running instance of a workflow template.
type WorkflowInstance struct {
	ID         string          `json:"id"`
	UserID     string          `json:"userId"`
	TemplateID string          `json:"templateId"`
	Status     string          `json:"status"` // "in_progress", "completed", "failed"
	CurrentStep int             `json:"currentStep"`
	Context    json.RawMessage `json:"context,omitempty"`
	CreatedAt  time.Time       `json:"createdAt"`
	UpdatedAt  time.Time       `json:"updatedAt"`
}

// NewWorkflowInstance creates a new workflow instance from a template.
func NewWorkflowInstance(id, userID, templateID string, initialContext json.RawMessage) *WorkflowInstance {
	now := time.Now()
	return &WorkflowInstance{
		ID:          id,
		UserID:      userID,
		TemplateID:  templateID,
		Status:      "in_progress",
		CurrentStep: 1,
		Context:     initialContext,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// AdvanceStep moves the workflow to the next step.
func (wi *WorkflowInstance) AdvanceStep(newContext json.RawMessage) {
	wi.CurrentStep++
	wi.Context = newContext
	wi.UpdatedAt = time.Now()
}

// Complete marks the workflow as completed.
func (wi *WorkflowInstance) Complete() {
	wi.Status = "completed"
	wi.UpdatedAt = time.Now()
}

// Fail marks the workflow as failed.
func (wi *WorkflowInstance) Fail() {
	wi.Status = "failed"
	wi.UpdatedAt = time.Now()
}
