package builtin

import (
	"errors"
	"strings"

	"gofly-admin-v3/utils/tools/empty"
	"gofly-admin-v3/utils/tools/gutil"
)

// RuleRequiredWithout implements `required-without` rule:
// Required if any of given fields are empty.
//
// Format:  required-without:field1,field2,...
// Example: required-without:id,name
type RuleRequiredWithout struct{}

func init() {
	Register(RuleRequiredWithout{})
}

func (r RuleRequiredWithout) Name() string {
	return "required_without"
}

func (r RuleRequiredWithout) Message() string {
	return MassageDate[LocaleType].Get("builtin_" + r.Name()).String()
	// return "The {field} field is required"
}

func (r RuleRequiredWithout) Run(in RunInput) error {
	var (
		required   = false
		array      = strings.Split(in.RulePattern, ",")
		foundValue interface{}
	)
	for i := 0; i < len(array); i++ {
		_, foundValue = gutil.MapPossibleItemByKey(in.Data.Map(), array[i])
		if empty.IsEmpty(foundValue) {
			required = true
			break
		}
	}

	if required && isRequiredEmpty(in.Value.Val()) {
		return errors.New(in.Message)
	}
	return nil
}
