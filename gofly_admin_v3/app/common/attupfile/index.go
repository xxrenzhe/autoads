package attupfile

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"gofly-admin-v3/app/common/ffmpegtool"
	"gofly-admin-v3/utils/gf"
	"gofly-admin-v3/utils/tools/gconv"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type Index struct{}

func init() {
	fpath := Index{}
	gf.Register(&fpath, fpath)
}

// 上传到附件管理
func (api *Index) Upfile(c *gf.GinCtx) {
	user, exists := gf.GetUserInfo(c) //当前用户
	if !exists {
		gf.Failed().SetMsg("登录失效").Regin(c)
		return
	}
	//判断存储空间是否超出
	var usesize interface{}
	var fileSize interface{}
	usesize, _ = gf.Model("business_attachment").Where("business_id", user.BusinessID).Where("type", 0).Sum("filesize")
	fileSize, _ = gf.Model("business_account").Where("id", user.BusinessID).Value("fileSize")
	if usesize == nil {
		usesize = '0'
	}
	if gconv.Int(usesize) >= gconv.Int(fileSize) {
		gf.Failed().SetMsg("您的存储空间已满，请您先去购买存储空间！").Regin(c)
		return
	}
	// 单个文件
	pid := c.DefaultPostForm("pid", "")
	filetype := c.DefaultPostForm("filetype", "image") //文件类型
	file, err := c.FormFile("file")
	if err != nil {
		gf.Failed().SetMsg("获取数据失败，").SetData(err).Regin(c)
		return
	}
	nowTime := time.Now().Unix() //当前时间
	rooturl := gf.GetMainURL()
	//判断文件是否已经传过
	fileContent, _ := file.Open()
	var byteContainer []byte
	byteContainer = make([]byte, 1000000)
	fileContent.Read(byteContainer)
	m_d5 := md5.New()
	m_d5.Write(byteContainer)
	sha1_str := hex.EncodeToString(m_d5.Sum(nil))
	//查找该用户是否传过
	attachment, _ := gf.Model("business_attachment").Where("business_id", user.BusinessID).
		Where("sha1", sha1_str).Fields("id,pid,name,title,type,url,filesize,mimetype,cover_url").Find()
	if attachment != nil { //文件是否已经存在
		//更新到最前面
		maxId, _ := gf.Model("business_attachment").Where("business_id", user.BusinessID).Order("weigh desc").Value("id")
		if maxId != nil {
			gf.Model("business_attachment").Data(map[string]interface{}{"weigh": maxId.Int() + 1, "pid": pid}).Where("id", attachment["id"]).Update()
		}
		c.JSON(200, gin.H{
			"id":       attachment["id"],
			"uid":      sha1_str,
			"name":     attachment["name"],
			"status":   "done",
			"url":      fmt.Sprintf("%v%v", rooturl, attachment["url"]),
			"response": "上传成功",
			"time":     nowTime,
		})
	} else {
		file_path := fmt.Sprintf("%s%s%s", "resource/uploads/", time.Now().Format("20060102"), "/")
		//如果没有filepath文件目录就创建一个
		if _, err := os.Stat(file_path); err != nil {
			if !os.IsExist(err) {
				os.MkdirAll(file_path, os.ModePerm)
			}
		}
		//上传到的路径
		filename_arr := strings.Split(file.Filename, ".")
		//重新名片-lunix系统不支持中文
		name_str := gf.Md5Str(fmt.Sprintf("%v%s", nowTime, filename_arr[0]))   //组装文件保存名字
		file_Filename := fmt.Sprintf("%s%s%s", name_str, ".", filename_arr[1]) //文件加.后缀
		path := file_path + file_Filename
		// 上传文件到指定的目录
		err = c.SaveUploadedFile(file, path)
		if err != nil { //上传失败
			c.JSON(200, gin.H{
				"uid":      sha1_str,
				"name":     file.Filename,
				"status":   "error",
				"response": "上传失败",
				"time":     nowTime,
			})
		} else { //上传成功
			//保存数据
			dir, _ := filepath.Abs(filepath.Dir(os.Args[0]))
			var ftype int64 = 0
			var cover_url string = ""
			if filetype == "video" {
				ftype = 2
				videopath := fmt.Sprintf("./%s", path)
				pathroot := strings.Split(path, ".")
				imgpath := fmt.Sprintf("./%s", pathroot[0])
				fname, err := ffmpegtool.GetSnapshot(videopath, imgpath, 1)
				if err == nil {
					cover_url = fname
				}
			}
			Insertdata := map[string]interface{}{
				"account_id":  user.AccountID,
				"business_id": user.BusinessID,
				"type":        ftype,
				"pid":         pid,
				"sha1":        sha1_str,
				"title":       filename_arr[0],
				"name":        file.Filename,
				"url":         path,
				"cover_url":   cover_url, //视频封面
				"storage":     dir + "/" + path,
				"createtime":  nowTime,
				"filesize":    file.Size,
				"mimetype":    file.Header["Content-Type"][0],
			}
			//保存数据
			file_id, _ := gf.Model("business_attachment").Data(Insertdata).InsertAndGetId()
			//更新排序
			gf.Model("business_attachment").Data(map[string]interface{}{"weigh": file_id}).Where("id", file_id).Update()
			//返回数据
			c.JSON(200, gin.H{
				"id":       file_id,
				"uid":      sha1_str,
				"name":     file.Filename,
				"status":   "done",
				"url":      fmt.Sprintf("%v%v", rooturl, path),
				"response": "上传成功",
				"time":     nowTime,
			})
		}
	}
}
