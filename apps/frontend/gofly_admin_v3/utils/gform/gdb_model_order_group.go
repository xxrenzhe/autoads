package gform

import (
	"strings"

	"gofly-admin-v3/utils/tools/gconv"

	"gofly-admin-v3/utils/tools/gstr"
)

// Order sets the "ORDER BY" statement for the model.
//
// Example:
// Order("id desc")
// Order("id", "desc")
// Order("id desc,name asc")
// Order("id desc", "name asc")
// Order("id desc").Order("name asc")
// Order(gform.Raw("field(id, 3,1,2)")).
func (m *Model) Order(orderBy ...interface{}) *Model {
	if len(orderBy) == 0 {
		return m
	}
	var (
		core  = m.db.GetCore()
		model = m.getModel()
	)
	for _, v := range orderBy {
		if model.orderBy != "" {
			model.orderBy += ","
		}
		switch v.(type) {
		case Raw, *Raw:
			model.orderBy += gconv.String(v)
		default:
			orderByStr := gconv.String(v)
			if gstr.Contains(orderByStr, " ") {
				model.orderBy += core.QuoteString(orderByStr)
			} else {
				if gstr.Equal(orderByStr, "ASC") || gstr.Equal(orderByStr, "DESC") {
					model.orderBy = gstr.TrimRight(model.orderBy, ",")
					model.orderBy += " " + orderByStr
				} else {
					model.orderBy += core.QuoteWord(orderByStr)
				}
			}
		}
	}
	return model
}

// OrderAsc sets the "ORDER BY xxx ASC" statement for the model.
func (m *Model) OrderAsc(column string) *Model {
	if len(column) == 0 {
		return m
	}
	return m.Order(column + " ASC")
}

// OrderDesc sets the "ORDER BY xxx DESC" statement for the model.
func (m *Model) OrderDesc(column string) *Model {
	if len(column) == 0 {
		return m
	}
	return m.Order(column + " DESC")
}

// OrderRandom sets the "ORDER BY RANDOM()" statement for the model.
func (m *Model) OrderRandom() *Model {
	model := m.getModel()
	model.orderBy = m.db.OrderRandomFunction()
	return model
}

// Group sets the "GROUP BY" statement for the model.
func (m *Model) Group(groupBy ...string) *Model {
	if len(groupBy) == 0 {
		return m
	}
	var (
		core  = m.db.GetCore()
		model = m.getModel()
	)

	if model.groupBy != "" {
		model.groupBy += ","
	}
	model.groupBy += core.QuoteString(strings.Join(groupBy, ","))
	return model
}
