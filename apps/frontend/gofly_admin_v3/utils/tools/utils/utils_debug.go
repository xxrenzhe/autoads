package utils

import (
	"gofly-admin-v3/utils/tools/command"
)

const (
	// Debug key for checking if in debug mode.
	commandEnvKeyForDebugKey = "gf.debug"
)

// isDebugEnabled marks whether gofly debug mode is enabled.
var isDebugEnabled = false

func init() {
	// Debugging configured.
	value := command.GetOptWithEnv(commandEnvKeyForDebugKey)
	if value == "" || value == "0" || value == "false" {
		isDebugEnabled = false
	} else {
		isDebugEnabled = true
	}
}

// IsDebugEnabled checks and returns whether debug mode is enabled.
// The debug mode is enabled when command argument "gf.debug" or environment "GF_DEBUG" is passed.
func IsDebugEnabled() bool {
	return isDebugEnabled
}

// SetDebugEnabled enables/disables the internal debug info.
func SetDebugEnabled(enabled bool) {
	isDebugEnabled = enabled
}
