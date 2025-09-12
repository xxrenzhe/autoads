package mysql

import (
	"database/sql"
	"fmt"
	"net/url"
	"strings"

	"gofly-admin-v3/utils/gform"
	"gofly-admin-v3/utils/tools/gcode"
	"gofly-admin-v3/utils/tools/gerror"
)

// Open creates and returns an underlying sql.DB object for mysql.
// Note that it converts time.Time argument to local timezone in default.
func (d *Driver) Open(config *gform.ConfigNode) (db *sql.DB, err error) {
	var (
		source               = configNodeToSource(config)
		underlyingDriverName = "mysql"
	)
	if db, err = sql.Open(underlyingDriverName, source); err != nil {
		err = gerror.WrapCodef(
			gcode.CodeDbOperationError, err,
			`sql.Open failed for driver "%s" by source "%s"`, underlyingDriverName, source,
		)
		return nil, err
	}
	return
}

// [username[:password]@][protocol[(address)]]/dbname[?param1=value1&...&paramN=valueN]
func configNodeToSource(config *gform.ConfigNode) string {
	var (
		source  string
		portStr string
	)
	if config.Hostport != "" {
		portStr = ":" + config.Hostport
	}
	source = fmt.Sprintf(
		"%s:%s@%s(%s%s)/%s?charset=%s",
		config.Username, config.Password, config.Protocol, config.Hostname, portStr, config.Dbname, config.Charset,
	)
	if config.Timezone != "" {
		if strings.Contains(config.Timezone, "/") {
			config.Timezone = url.QueryEscape(config.Timezone)
		}
		source = fmt.Sprintf("%s&loc=%s", source, config.Timezone)
	}
	//链接成功设置数据库mode
	if config.Sqlmode != "" {
		source = fmt.Sprintf("%s&sql_mode=%s", source, config.Sqlmode)
	}
	if config.Extra != "" {
		source = fmt.Sprintf("%s&%s", source, config.Extra)
	}
	return source
}
