// Package mysql implements gform.Driver, which supports operations for database MySQL.
package mysql

import (
	_ "github.com/go-sql-driver/mysql"

	"gofly-admin-v3/utils/gform"
)

// Driver is the driver for mysql database.
type Driver struct {
	*gform.Core
}

const (
	quoteChar = "`"
)

func init() {
	var (
		err         error
		driverObj   = New()
		driverNames = []string{"mysql", "mariadb", "tidb"}
	)
	for _, driverName := range driverNames {
		if err = gform.Register(driverName, driverObj); err != nil {
			panic(err)
		}
	}
}

// New create and returns a driver that implements gform.Driver, which supports operations for MySQL.
func New() gform.Driver {
	return &Driver{}
}

// New creates and returns a database object for mysql.
// It implements the interface of gform.Driver for extra database driver installation.
func (d *Driver) New(core *gform.Core, node *gform.ConfigNode) (gform.DB, error) {
	return &Driver{
		Core: core,
	}, nil
}

// GetChars returns the security char for this type of database.
func (d *Driver) GetChars() (charLeft string, charRight string) {
	return quoteChar, quoteChar
}
