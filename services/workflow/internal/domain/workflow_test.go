package domain

import (
	"encoding/json"
	"testing"
	"time"
)

func TestNewWorkflowInstance(t *testing.T) {
	id := "wf-instance-123"
	userID := "user-456"
	templateID := "template-789"
	context := json.RawMessage(`{"key": "value"}`)

	instance := NewWorkflowInstance(id, userID, templateID, context)

	if instance.ID != id {
		t.Errorf("Expected ID to be %s, but got %s", id, instance.ID)
	}
	if instance.UserID != userID {
		t.Errorf("Expected UserID to be %s, but got %s", userID, instance.UserID)
	}
	if instance.TemplateID != templateID {
		t.Errorf("Expected TemplateID to be %s, but got %s", templateID, instance.TemplateID)
	}
	if instance.Status != "in_progress" {
		t.Errorf("Expected Status to be 'in_progress', but got %s", instance.Status)
	}
	if instance.CurrentStep != 1 {
		t.Errorf("Expected CurrentStep to be 1, but got %d", instance.CurrentStep)
	}
	if string(instance.Context) != string(context) {
		t.Errorf("Expected Context to be %s, but got %s", context, instance.Context)
	}
	if time.Since(instance.CreatedAt) > time.Second {
		t.Errorf("Expected CreatedAt to be recent")
	}
}

func TestWorkflowInstance_AdvanceStep(t *testing.T) {
	instance := NewWorkflowInstance("id", "user", "template", nil)
	newContext := json.RawMessage(`{"newKey": "newValue"}`)
	time.Sleep(10 * time.Millisecond)
	instance.AdvanceStep(newContext)

	if instance.CurrentStep != 2 {
		t.Errorf("Expected CurrentStep to be 2, but got %d", instance.CurrentStep)
	}
	if string(instance.Context) != string(newContext) {
		t.Errorf("Expected Context to be updated to %s, but got %s", newContext, instance.Context)
	}
	if !instance.UpdatedAt.After(instance.CreatedAt) {
		t.Errorf("Expected UpdatedAt to be after CreatedAt")
	}
}

func TestWorkflowInstance_Complete(t *testing.T) {
	instance := NewWorkflowInstance("id", "user", "template", nil)
	time.Sleep(10 * time.Millisecond)
	instance.Complete()

	if instance.Status != "completed" {
		t.Errorf("Expected Status to be 'completed', but got %s", instance.Status)
	}
	if !instance.UpdatedAt.After(instance.CreatedAt) {
		t.Errorf("Expected UpdatedAt to be after CreatedAt")
	}
}

func TestWorkflowInstance_Fail(t *testing.T) {
	instance := NewWorkflowInstance("id", "user", "template", nil)
	time.Sleep(10 * time.Millisecond)
	instance.Fail()

	if instance.Status != "failed" {
		t.Errorf("Expected Status to be 'failed', but got %s", instance.Status)
	}
	if !instance.UpdatedAt.After(instance.CreatedAt) {
		t.Errorf("Expected UpdatedAt to be after CreatedAt")
	}
}
