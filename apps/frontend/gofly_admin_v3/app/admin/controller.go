package admin

/**
* 引入控制器
* 请把您使用包用 _ "gofly-admin-v3/app/admin/XX"导入您编写的包 自动生成路由
* 不是使用则注释掉
 */
import (
	_ "gofly-admin-v3/app/admin/business"
	_ "gofly-admin-v3/app/admin/common"
	_ "gofly-admin-v3/app/admin/createcode"
	_ "gofly-admin-v3/app/admin/datacenter"
	_ "gofly-admin-v3/app/admin/gofly_panel"
	_ "gofly-admin-v3/app/admin/matter"
	_ "gofly-admin-v3/app/admin/system"
	_ "gofly-admin-v3/app/admin/user"
	"gofly-admin-v3/utils/gf"
)

// 路由中间件/路由钩子
func RouterHandler(c *gf.GinCtx, modelname string) {
	if gf.IsModelPath(c.FullPath(), modelname) { //在这里面处理拦截操作
		// 判断请求接口是否需要验证权限(RBAC的权限)
		if gf.NeedAuthMatch(c) {
			haseauth := gf.CheckAuth(c, modelname)
			if haseauth {
				c.Next()
			} else {
				gf.Failed().SetMsg(gf.LocaleMsg().SetLanguage(c.Request.Header.Get("locale")).Message("sys_auth_permission")).SetData(haseauth).Regin(c)
				c.Abort()
			}
		} else {
			c.Next()
		}
	}
}
