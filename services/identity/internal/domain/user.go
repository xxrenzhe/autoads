package domain

import (
	"time"
)

// User represents a user in the system.
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name,omitempty"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
	LastLogin *time.Time `json:"lastLogin,omitempty"`
}

// NewUser creates a new user with default values.
func NewUser(id, email, name string) *User {
	return &User{
		ID:        id,
		Email:     email,
		Name:      name,
		Role:      "USER",
		CreatedAt: time.Now(),
	}
}

// IsAdmin checks if the user has the ADMIN role.
func (u *User) IsAdmin() bool {
	return u.Role == "ADMIN"
}

// UpdateLastLogin updates the user's last login timestamp.
func (u *User) UpdateLastLogin() {
	now := time.Now()
	u.LastLogin = &now
}
