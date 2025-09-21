package domain

import (
	"errors"
	"time"
)

// User represents a user in the system.
type User struct {
	ID           string     `json:"id"`
	Email        string     `json:"email"`
	Name         string     `json:"name,omitempty"`
	Role         string     `json:"role"`
	CreatedAt    time.Time  `json:"createdAt"`
	LastLogin    *time.Time `json:"lastLogin,omitempty"`
	LastCheckIn  *time.time `json:"lastCheckIn,omitempty"` // New field for daily check-in
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

// CheckIn marks the user as checked in for the day.
// It returns an error if the user has already checked in today.
func (u *User) CheckIn() error {
	now := time.Now()
	if u.LastCheckIn != nil {
		// Compare only the date part (Year, Month, Day)
		lastCheckInDate := u.LastCheckIn.Truncate(24 * time.Hour)
		currentDate := now.Truncate(24 * time.Hour)
		if lastCheckInDate.Equal(currentDate) {
			return errors.New("already checked in today")
		}
	}
	u.LastCheckIn = &now
	return nil
}
