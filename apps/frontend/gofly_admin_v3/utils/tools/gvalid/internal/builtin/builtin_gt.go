package builtin

import (
	"errors"
	"strconv"

	"gofly-admin-v3/utils/tools/gconv"
	"gofly-admin-v3/utils/tools/gstr"
	"gofly-admin-v3/utils/tools/gutil"
)

// RuleGT implements `gt` rule:
// Greater than `field`.
// It supports both integer and float.
//
// Format: gt:field
type RuleGT struct{}

func init() {
	Register(RuleGT{})
}

func (r RuleGT) Name() string {
	return "gt"
}

func (r RuleGT) Message() string {
	return MassageDate[LocaleType].Get("builtin_" + r.Name()).String()
	// return "The {field} value `{value}` must be greater than field {field1} value `{value1}`"
}

func (r RuleGT) Run(in RunInput) error {
	var (
		fieldName, fieldValue = gutil.MapPossibleItemByKey(in.Data.Map(), in.RulePattern)
		fieldValueN, err1     = strconv.ParseFloat(gconv.String(fieldValue), 10)
		valueN, err2          = strconv.ParseFloat(in.Value.String(), 10)
	)

	if valueN <= fieldValueN || err1 != nil || err2 != nil {
		return errors.New(gstr.ReplaceByMap(in.Message, map[string]string{
			"{field1}": fieldName,
			"{value1}": gconv.String(fieldValue),
		}))
	}
	return nil
}
