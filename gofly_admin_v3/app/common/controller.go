package business

/**
* @title common是公共功能
* 引入控制器-文件夹名称的路径
* 请把您使用包用 _ "gofly-admin-v3/app/common/XX"导入您编写的包 自动生成路由
* 不是使用则注释掉
* 路由规则：包路径“common/api+文件名（如果是index则忽略index这一层）+方法名(首字母转小写	_ "gofly-admin-v3/app/common/api"
* 即：http://xx.com/common/api/getList
* 如果文件夹内没有对应package的go文件请把控制器类删除
 */
import (
	_ "gofly-admin-v3/app/common/api"
	_ "gofly-admin-v3/app/common/attupfile"
	_ "gofly-admin-v3/app/common/basetool"
	_ "gofly-admin-v3/app/common/ffmpegtool"
	_ "gofly-admin-v3/app/common/install"

	_ "gofly-admin-v3/app/common/table"
	_ "gofly-admin-v3/app/common/upload"
	_ "gofly-admin-v3/app/common/uploadfile"
)
