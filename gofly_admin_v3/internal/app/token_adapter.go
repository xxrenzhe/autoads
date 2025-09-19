package app

import (
    internaluser "gofly-admin-v3/internal/user"
)

// tokenAdapter adapts internal/user.TokenService to interfaces expected by
// checkin and invitation modules (AddTokens with 4 args + GetBalance).
type tokenAdapter struct{ svc *internaluser.TokenService }

func (a tokenAdapter) AddTokens(userID string, amount int, tokenType, description string) error {
    return a.svc.AddTokens(userID, amount, tokenType, description, "")
}

func (a tokenAdapter) GetBalance(userID string) (int, error) { return a.svc.GetTokenBalance(userID) }

