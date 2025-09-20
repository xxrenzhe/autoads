package gf

import (
	"context"
	"errors"
	"gofly-admin-v3/utils/tools/gmeta"
	"gofly-admin-v3/utils/tools/guid"
	"gofly-admin-v3/utils/tools/gvar"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
)

type (
	GinCtx = gin.Context     //Gin Context
	GinObj = gin.H           //Gin data
	Var    = gvar.Var        // Var is a universal variable interface, like generics.
	Ctx    = context.Context // Ctx is alias of frequently-used type context.Context.
	Meta   = gmeta.Meta      // Meta is alias of frequently-used type gmeta.Meta.
)

type (
	Map        = map[string]interface{}      // Map is alias of frequently-used map type map[string]interface{}.
	MapAnyAny  = map[interface{}]interface{} // MapAnyAny is alias of frequently-used map type map[interface{}]interface{}.
	MapAnyStr  = map[interface{}]string      // MapAnyStr is alias of frequently-used map type map[interface{}]string.
	MapAnyInt  = map[interface{}]int         // MapAnyInt is alias of frequently-used map type map[interface{}]int.
	MapStrStr  = map[string]string           // MapStrStr is alias of frequently-used map type map[string]string.
	MapStrInt  = map[string]int              // MapStrInt is alias of frequently-used map type map[string]int.
	MapIntAny  = map[int]interface{}         // MapIntAny is alias of frequently-used map type map[int]interface{}.
	MapIntStr  = map[int]string              // MapIntStr is alias of frequently-used map type map[int]string.
	MapIntInt  = map[int]int                 // MapIntInt is alias of frequently-used map type map[int]int.
	MapAnyBool = map[interface{}]bool        // MapAnyBool is alias of frequently-used map type map[interface{}]bool.
	MapStrBool = map[string]bool             // MapStrBool is alias of frequently-used map type map[string]bool.
	MapIntBool = map[int]bool                // MapIntBool is alias of frequently-used map type map[int]bool.
)

type (
	List        = []Map        // List is alias of frequently-used slice type []Map.
	ListAnyAny  = []MapAnyAny  // ListAnyAny is alias of frequently-used slice type []MapAnyAny.
	ListAnyStr  = []MapAnyStr  // ListAnyStr is alias of frequently-used slice type []MapAnyStr.
	ListAnyInt  = []MapAnyInt  // ListAnyInt is alias of frequently-used slice type []MapAnyInt.
	ListStrStr  = []MapStrStr  // ListStrStr is alias of frequently-used slice type []MapStrStr.
	ListStrInt  = []MapStrInt  // ListStrInt is alias of frequently-used slice type []MapStrInt.
	ListIntAny  = []MapIntAny  // ListIntAny is alias of frequently-used slice type []MapIntAny.
	ListIntStr  = []MapIntStr  // ListIntStr is alias of frequently-used slice type []MapIntStr.
	ListIntInt  = []MapIntInt  // ListIntInt is alias of frequently-used slice type []MapIntInt.
	ListAnyBool = []MapAnyBool // ListAnyBool is alias of frequently-used slice type []MapAnyBool.
	ListStrBool = []MapStrBool // ListStrBool is alias of frequently-used slice type []MapStrBool.
	ListIntBool = []MapIntBool // ListIntBool is alias of frequently-used slice type []MapIntBool.
)

type (
	Slice    = []interface{} // Slice is alias of frequently-used slice type []interface{}.
	SliceStr = []string      // SliceStr is alias of frequently-used slice type []string.
	SliceInt = []int         // SliceInt is alias of frequently-used slice type []int.
)

// Error 创建错误
func Error(message string) error {
	return errors.New(message)
}

// UUID 生成UUID
func UUID() string {
	return guid.S()
}

// HandlerFunc Gin处理函数类型
type HandlerFunc = gin.HandlerFunc

var processStartTime = time.Now()

// GetUptime 返回进程运行时长
func GetUptime() time.Duration {
	return time.Since(processStartTime)
}

// GetGoroutineCount 返回当前 goroutine 数量
func GetGoroutineCount() int {
	return runtime.NumGoroutine()
}

// GetMemoryUsage 返回已分配内存字节数
func GetMemoryUsage() uint64 {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	return ms.Alloc
}
