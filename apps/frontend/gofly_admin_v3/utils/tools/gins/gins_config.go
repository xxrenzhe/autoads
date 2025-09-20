package gins

import (
	"gofly-admin-v3/utils/tools/gcfg"
)

const (
	frameCoreComponentNameViewer     = "gf.core.component.viewer"
	frameCoreComponentNameDatabase   = "gf.core.component.database"
	frameCoreComponentNameHttpClient = "gf.core.component.httpclient"
	frameCoreComponentNameLogger     = "gf.core.component.logger"
	frameCoreComponentNameRedis      = "gf.core.component.redis"
	frameCoreComponentNameServer     = "gf.core.component.server"
)

// Config returns an instance of View with default settings.
// The parameter `name` is the name for the instance.
func Config(name ...string) *gcfg.Config {
	return gcfg.Instance(name...)
}
