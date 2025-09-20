package builtin

import (
	"errors"
	"strings"

	"gofly-admin-v3/utils/tools/gconv"
	"gofly-admin-v3/utils/tools/gutil"
)

// RuleRequiredUnless implements `required-unless` rule:
// Required unless all given field and its value are not equal.
//
// Format:  required-unless:field,value,...
// Example: required-unless:id,1,age,18
type RuleRequiredUnless struct{}

func init() {
	Register(RuleRequiredUnless{})
}

func (r RuleRequiredUnless) Name() string {
	return "required_unless"
}

func (r RuleRequiredUnless) Message() string {
	return MassageDate[LocaleType].Get("builtin_" + r.Name()).String()
	// return "The {field} field is required"
}

func (r RuleRequiredUnless) Run(in RunInput) error {
	var (
		required   = true
		array      = strings.Split(in.RulePattern, ",")
		foundValue interface{}
	)
	// It supports multiple field and value pairs.
	if len(array)%2 == 0 {
		for i := 0; i < len(array); {
			tk := array[i]
			tv := array[i+1]
			_, foundValue = gutil.MapPossibleItemByKey(in.Data.Map(), tk)
			if in.Option.CaseInsensitive {
				required = !strings.EqualFold(tv, gconv.String(foundValue))
			} else {
				required = strings.Compare(tv, gconv.String(foundValue)) != 0
			}
			if !required {
				break
			}
			i += 2
		}
	}

	if required && isRequiredEmpty(in.Value.Val()) {
		return errors.New(in.Message)
	}
	return nil
}
