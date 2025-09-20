package gf

import (
	"gofly-admin-v3/utils/tools/empty"
	"gofly-admin-v3/utils/tools/gcache"
	"gofly-admin-v3/utils/tools/gmd5"
	"gofly-admin-v3/utils/tools/utils"
	"time"
)

var (
	cache = gcache.New()
)

// Md5 encryption
func Md5(str string) string {
	mdsecret, _ := gmd5.Encrypt(str)
	return mdsecret
}

// md5hex编码加密
func Md5Str(origin string) string {
	return gmd5.Md5StrHex(origin)
}

// Note that this function is not concurrent safe, be aware of the DATA RACE,
// which means you should call this function in your boot but not the runtime.
func SetDebug(enabled bool) {
	utils.SetDebugEnabled(enabled)
}

// 把验证码保存在本地，用GetVerifyCode获取key对应缓存
func SetVerifyCode(key, code string) (err error) {
	err = cache.Set(ctx, key, code, time.Second*60)
	return
}

// 获取本地保存的验证码，使用SetVerifyCode保存可以对应数据
func GetVerifyCode(key string) (code int, err error) {
	val, err := cache.Get(ctx, key)
	if err == nil {
		code = Int(val)
	}
	return
}

// IsNil checks whether given `value` is nil.
func IsNil(value interface{}, traceSource ...bool) bool {
	return empty.IsNil(value, traceSource...)
}

// IsEmpty checks whether given `value` empty.
// It returns true if `value` is in: 0, nil, false, "", len(slice/map/chan) == 0.
// Or else it returns true.
func IsEmpty(value interface{}, traceSource ...bool) bool {
	return empty.IsEmpty(value, traceSource...)
}
