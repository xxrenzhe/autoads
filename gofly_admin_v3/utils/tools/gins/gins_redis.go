package gins

import (
	"context"
	"fmt"

	"gofly-admin-v3/utils/tools/gcode"
	"gofly-admin-v3/utils/tools/gerror"

	"gofly-admin-v3/utils/tools/consts"
	"gofly-admin-v3/utils/tools/instance"
	"gofly-admin-v3/utils/tools/intlog"

	"gofly-admin-v3/utils/tools/gconv"
	"gofly-admin-v3/utils/tools/gutil"

	"gofly-admin-v3/utils/tools/gredis"
)

// Redis returns an instance of redis client with specified configuration group name.
// Note that it panics if any error occurs duration instance creating.
func Redis(name ...string) *gredis.Redis {
    var (
        err   error
        ctx   = context.Background()
        group = gredis.DefaultGroupName
    )
	if len(name) > 0 && name[0] != "" {
		group = name[0]
	}
	instanceKey := fmt.Sprintf("%s.%s", frameCoreComponentNameRedis, group)
	result := instance.GetOrSetFuncLock(instanceKey, func() interface{} {
		// If already configured, it returns the redis instance.
		if _, ok := gredis.GetConfig(group); ok {
			return gredis.Instance(group)
		}
        if Config().Available(ctx) {
            var (
                configMap   map[string]interface{}
                redisConfig *gredis.Config
                redisClient *gredis.Redis
            )
            if configMap, err = Config().Data(ctx); err != nil {
                intlog.Errorf(ctx, `retrieve config data map failed: %+v`, err)
            }
            if _, v := gutil.MapPossibleItemByKey(configMap, consts.ConfigNodeNameRedis); v != nil {
                configMap = gconv.Map(v)
            }
            if len(configMap) > 0 {
                if v, ok := configMap[group]; ok {
                    if redisConfig, err = gredis.ConfigFromMap(gconv.Map(v)); err != nil {
                        panic(err)
                    }
                } else {
                    intlog.Printf(ctx, `missing configuration for redis group "%s"`, group)
                }
            } else {
                intlog.Print(ctx, `missing configuration for redis: "redis" node not found`)
            }
            if redisClient, err = gredis.New(redisConfig); err != nil {
                panic(err)
            }
            return redisClient
        }
        panic(gerror.NewCode(
            gcode.CodeMissingConfiguration,
            `no configuration found for creating redis client`,
        ))
        return nil
    })
    if result != nil {
        return result.(*gredis.Redis)
    }
    return nil
}
