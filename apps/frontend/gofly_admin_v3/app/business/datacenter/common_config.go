package datacenter

import (
	"gofly-admin-v3/utils/gf"
	"gofly-admin-v3/utils/tools/gcfg"
	"gofly-admin-v3/utils/tools/gconv"
	"gofly-admin-v3/utils/tools/gctx"
	"os"
	"path/filepath"
)

type Common_config struct{}

func init() {
	fpath := Common_config{}
	gf.Register(&fpath, fpath)
}

// 获取配置-动态配置config.yarn
func (api *Common_config) GetConfig(c *gf.GinCtx) {
	ctx := gctx.New()
	appConf, _ := gcfg.Instance().Get(ctx, "app")
	appConf_arr := gconv.Map(appConf)
	showfilesize := false
	vue_viewsfiles_path_admin := filepath.Join(gconv.String(appConf_arr["vueobjroot"]), gconv.String(appConf_arr["adminDirName"]))
	if _, err := os.Stat(vue_viewsfiles_path_admin); err == nil {
		//判断是否为超级权限
		role_id, _ := gf.Model("business_auth_role_access").Where("uid", c.GetInt64("userID")).Array("role_id")
		super_role, _ := gf.Model("business_auth_role").WhereIn("id", role_id).Where("rules", "*").Value("id")
		if super_role != nil {
			showfilesize = true
		}
	}
	fileSize, _ := gf.Model("business_account").Where("id", c.GetInt64("userID")).Value("fileSize")
	gf.Success().SetMsg("获取配置").SetData(gf.Map{"showfilesize": showfilesize, "fileSize": fileSize, "vueobjroot": appConf_arr["vueobjroot"], "mainurl": appConf_arr["mainurl"]}).Regin(c)
}

// 保存系统配置
func (api *Common_config) SaveConfig(c *gf.GinCtx) {
	param, _ := gf.RequestParam(c)
	path, _ := os.Getwd()
	upAppconf := gf.Map{
		"vueobjroot": param["vueobjroot"],
		"mainurl":    param["mainurl"],
	}
	cferr := gf.UpConfFieldData(path, upAppconf, "  ")
	if cferr != nil {
		gf.Failed().SetMsg("修改前端路径失败").SetData(cferr.Error()).Regin(c)
		return
	}
	if gf.Bool(param["showfilesize"]) {
		gf.Model("business_account").Where("id", c.GetInt64("userID")).Update(gf.Map{"fileSize": param["fileSize"]})
	}
	gf.Success().SetMsg("保存系统配置成功").Regin(c)
}
