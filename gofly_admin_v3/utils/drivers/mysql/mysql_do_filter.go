package mysql

import (
	"context"

	"gofly-admin-v3/utils/gform"
)

// DoFilter handles the sql before posts it to database.
func (d *Driver) DoFilter(
	ctx context.Context, link gform.Link, sql string, args []interface{},
) (newSql string, newArgs []interface{}, err error) {
	return d.Core.DoFilter(ctx, link, sql, args)
}
