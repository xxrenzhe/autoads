package domain

import (
	"testing"
	"time"
)

func TestNewUser(t *testing.T) {
	id := "user-123"
	email := "test@example.com"
	name := "Test User"

	user := NewUser(id, email, name)

	if user.ID != id {
		t.Errorf("Expected ID to be %s, but got %s", id, user.ID)
	}
	if user.Email != email {
		t.Errorf("Expected Email to be %s, but got %s", email, user.Email)
	}
	if user.Name != name {
		t.Errorf("Expected Name to be %s, but got %s", name, user.Name)
	}
	if user.Role != "USER" {
		t.Errorf("Expected Role to be 'USER', but got %s", user.Role)
	}
	if time.Since(user.CreatedAt) > time.Second {
		t.Errorf("Expected CreatedAt to be recent, but it's %s", user.CreatedAt)
	}
	if user.LastLogin != nil {
		t.Errorf("Expected LastLogin to be nil initially, but it's not")
	}
}

func TestIsAdmin(t *testing.T) {
	user := &User{Role: "USER"}
	if user.IsAdmin() {
		t.Errorf("Expected IsAdmin to be false for role 'USER'")
	}

	adminUser := &User{Role: "ADMIN"}
	if !adminUser.IsAdmin() {
		t.Errorf("Expected IsAdmin to be true for role 'ADMIN'")
	}
}

func TestUpdateLastLogin(t *testing.T) {
	user := &User{}
	user.UpdateLastLogin()

	if user.LastLogin == nil {
		t.Fatal("Expected LastLogin to be updated, but it's still nil")
	}
	if time.Since(*user.LastLogin) > time.Second {
		t.Errorf("Expected LastLogin to be recent, but it's %s", *user.LastLogin)
	}
}
