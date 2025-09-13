package router

import (
	//一定要导入这个Controller包，用来注册需要访问的方法
	//这里路由-由构架是添加-开发者仅在指定工程目录下controller.go文件添加宝即可
	"context"
	"fmt"
	"gofly-admin-v3/app"
	"net/http"
	_ "net/http/pprof"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"

	"strings"
	"time"

	//工具
	"gofly-admin-v3/utils/gf"
	"gofly-admin-v3/utils/router/routeuse"
	"gofly-admin-v3/utils/tools/gcfg"
	"gofly-admin-v3/utils/tools/gconv"
	"gofly-admin-v3/utils/tools/gctx"
	"gofly-admin-v3/utils/tools/gfile"

	"gofly-admin-v3/internal/metrics"
	"gofly-admin-v3/internal/upload"
	"gofly-admin-v3/internal/docs"
    "gofly-admin-v3/internal/middleware"
    "gofly-admin-v3/internal/config"
    "gofly-admin-v3/internal/cache"
    "gofly-admin-v3/internal/admin"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
    redisv8 "github.com/go-redis/redis/v8"
)

var (
	ctx         = gctx.New()
	appConf, _  = gcfg.Instance().Get(ctx, "app")
	appConf_arr = gconv.Map(appConf)
)

// 优雅重启/停止服务器
func RunServer() {
	//1设置cpu个数
	cpu_num := gconv.Int(appConf_arr["cpunum"])
	if cpu_num > 0 {
		mycpu := runtime.NumCPU()
		if cpu_num > mycpu { //如果配置cpu核数大于当前计算机核数，则等当前计算机核数
			cpu_num = mycpu
		}
		runtime.GOMAXPROCS(cpu_num)
	}
	//2加载gin路由
	path, _ := os.Getwd()
	R := InitRouter(path)
	runEnv_str := gconv.String(appConf_arr["runEnv"])
	//把路由推保存文件中
	routerfilePath := "runtime/app/routers.txt"
	routerfileFullPath := filepath.Join(path, routerfilePath)
	routes := ""
	for _, route := range R.Routes() {
		if !strings.Contains(route.Path, "filename") && route.Path != "/" && !strings.Contains(route.Path, "/*filepath") {
			routes = routes + fmt.Sprintf("%v:%v\n", route.Method, route.Path)
		}
	}
	gfile.PutBytes(routerfileFullPath, []byte(routes))
	srv := &http.Server{
		Addr:              ":" + gconv.String(appConf_arr["port"]),
		Handler:           R,
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1MB
	}
	//启动服务
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			gf.Log().Error(ctx, fmt.Sprintf("listen serve err: %s\n", err))
		}
	}()
	if runEnv_str == "debug" {
		// 启动pprof服务
		if gf.Bool(appConf_arr["runpprof"]) {
			R.GET("/debug/pprof/*any", gin.WrapH(http.DefaultServeMux))
			go func() {
				if err := http.ListenAndServe(":8081", nil); err != nil {
					gf.Log().Error(ctx, fmt.Sprintf("pprof server failed: %v", err))
				}
			}()
			fmt.Printf("%c[1;40;33m%s%c[0m\n", 0x1B, "已开启pprof性能分析工具-浏览器访问：​​http://127.0.0.1:8081/debug/pprof/ ​进行查看​", 0x1B)
		}
		fmt.Printf("%c[1;40;32m%s%c[0m\n", 0x1B, "如果还没有安装-请在浏览器访问：​​http://127.0.0.1:"+gconv.String(appConf_arr["port"])+"/common/install/index ​进行​安装​", 0x1B)
		fmt.Println("Listening and serving HTTP on :" + gconv.String(appConf_arr["port"]))
	}
	// 等待中断信号以优雅地关闭服务器（设置 5 秒的超时时间）
	quit := make(chan os.Signal)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	gf.Log().Info(ctx, "Shutdown Server ...")
	routeuse.CloseCache() //同时关闭缓存对象，让GC回收资源
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		gf.Log().Error(ctx, fmt.Sprintf("服务器关闭： %s\n", err))
	}
	// catching ctx.Done(). timeout of 5 seconds.
	select {
	case <-ctx.Done():
		gf.Log().Info(ctx, "timeout of 5 seconds.")
	}
	gf.Log().Info(ctx, "Server exiting/服务已经优雅退出，port:"+gconv.String(appConf_arr["port"]))
}

// 路由初始化
func InitRouter(path string) *gin.Engine {
	//初始化路由
	R := gin.Default()
	//控制台日志级别
	gin.SetMode(gconv.String(appConf_arr["runEnv"])) //ReleaseMode 为方便调试，Gin 框架在运行的时候默认是debug模式，在控制台默认会打印出很多调试日志，上线的时候我们需要关闭debug模式，改为release模式。
	R.SetTrustedProxies([]string{"127.0.0.1"})       // 设置受信任代理,如果不设置默认信任所有代理，不安全
	//根域名下获取static静态文件
	R.GET("/:filename", func(c *gin.Context) {
		filename := c.Param("filename")
		if filename == "" || strings.Contains(filename, "../") || strings.Contains(filename, "./") {
			c.JSON(404, gin.H{"code": 404, "message": "文件不存在或者禁止访问"})
			return
		}
		filePath := filepath.Join(path, "/resource/static/", filename)
		if _, err := os.Stat(filePath); err == nil {
			c.File(filePath)
			c.Abort()
			return
		} else {
			c.JSON(404, gin.H{"code": 404, "message": "文件不存在"})
		}
	})
	//静态资源处理-在static目录部署vue项目用的
	staticAssets := filepath.Join(path, "resource/static/assets")
	if _, err := os.Stat(staticAssets); err == nil {
		R.Static("/assets", "./resource/static/assets")
	}
	staticStatic := filepath.Join(path, "resource/static/static")
	if _, err := os.Stat(staticStatic); err == nil {
		R.Static("/static", "./resource/static/static")
	}

	// 上传文件访问
	R.GET("/uploads/*filepath", upload.ServeFile)

	// 简易Swagger JSON（默认示例，可替换为自动收集）
	R.GET("/docs/swagger.json", func(c *gin.Context) {
		// 基于当前Gin路由动态生成简易Swagger
		spec := docs.GetDefaultSwaggerSpec(c.Request.Host)
		paths := make(map[string]interface{})
		for _, r := range R.Routes() {
			if strings.Contains(r.Path, "/*filepath") || r.Path == "/" {
				continue
			}
			method := strings.ToLower(r.Method)
			// 简单的200响应定义
			op := map[string]interface{}{
				"summary":     r.Handler,
				"operationId": r.Handler,
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "OK",
					},
				},
			}
			// 合并到路径
			if pv, ok := paths[r.Path]; ok {
				pm := pv.(map[string]interface{})
				pm[method] = op
			} else {
				paths[r.Path] = map[string]interface{}{method: op}
			}
		}
		spec.Paths = paths
		data, err := spec.ToJSON()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Data(http.StatusOK, "application/json; charset=utf-8", data)
	})
	//注册网页资源访问目录，如admin后台、business后台、手机h5页面
	webStatic := appConf_arr["webStatic"]
	if webStatic != "" {
		webStatic_arr := strings.Split(gconv.String(webStatic), ",")
		for _, val := range webStatic_arr {
			file_path := filepath.Join(path, "/resource/", val)
			if _, err := os.Stat(file_path); err != nil {
				if !os.IsExist(err) {
					os.MkdirAll(file_path, os.ModePerm)
				}
			}
			R.Static("/"+val, "./resource/"+val)
		}
	}
	//在debug环境下注册安装页面
	if gconv.String(appConf_arr["runEnv"]) == "debug" {
		R.LoadHTMLFiles("./devsource/developer/install/install.html", "./devsource/developer/install/isinstall.html")
	}
	// 为 multipart forms 设置较低的内存限制 (默认是 32 MiB)
	R.MaxMultipartMemory = 8 << 20 // 8 MiB
	//0.跨域访问-注意跨域要放在gin.Default下
	var allowurl_arr []string = []string{"*"}
	allowurl_str := gconv.String(appConf_arr["allowurl"])
	if allowurl_str != "" {
		allowurl_arr = strings.Split(allowurl_str, `,`)
	}
	R.Use(cors.New(cors.Config{
		AllowOrigins:     allowurl_arr,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))
    // Prometheus HTTP请求指标
    R.Use(metrics.GetMetrics().HTTPMiddleware())

    //1.对错误处理
    R.Use(routeuse.Recover)
    //2.限流rate-limit 中间件（统一使用内部中间件）
    // 构建限流配置（按RPM转RPS）
    var rlConfig = middleware.DefaultRateLimitConfig
    // 尝试从内部配置读取（首选）
    cm := config.GetConfigManager()
    if cm != nil && cm.GetConfig() != nil {
        rc := cm.GetRateLimitConfig()
        if rc.RequestsPerMinute > 0 { rlConfig.GlobalRPS = float64(rc.RequestsPerMinute) / 60.0 }
        if rc.Burst > 0 { rlConfig.GlobalBurst = rc.Burst }
        // 用户、IP、API 默认与全局相同
        rlConfig.UserRPS, rlConfig.UserBurst = rlConfig.GlobalRPS, rlConfig.GlobalBurst
        rlConfig.IPRPS, rlConfig.IPBurst = rlConfig.GlobalRPS, rlConfig.GlobalBurst
        rlConfig.APIRPS, rlConfig.APIBurst = rlConfig.GlobalRPS, rlConfig.GlobalBurst
        // Redis 开关与窗口
        rconf := cm.GetRedisConfig()
        rlConfig.UseRedis = rconf.Enable
        rlConfig.Window = time.Minute
    } else {
        // 兼容旧 gcfg 配置
        if v, err := gcfg.Instance().Get(ctx, "rate_limit"); err == nil {
            arr := gconv.Map(v)
            rpm := gconv.Int(arr["requests_per_minute"]) // per-minute
            burst := gconv.Int(arr["burst"])              // burst capacity
            if rpm > 0 { rlConfig.GlobalRPS = float64(rpm) / 60.0 }
            if burst > 0 { rlConfig.GlobalBurst = burst }
            rlConfig.UserRPS, rlConfig.UserBurst = rlConfig.GlobalRPS, rlConfig.GlobalBurst
            rlConfig.IPRPS, rlConfig.IPBurst = rlConfig.GlobalRPS, rlConfig.GlobalBurst
            rlConfig.APIRPS, rlConfig.APIBurst = rlConfig.GlobalRPS, rlConfig.GlobalBurst
        }
        if rv, err := gcfg.Instance().Get(ctx, "redis"); err == nil {
            rarr := gconv.Map(rv)
            rlConfig.UseRedis = gconv.Bool(rarr["enable"])
        }
        rlConfig.Window = time.Minute
    }
    rlConfig.Window = time.Minute
    // 可选：初始化 redis 客户端（如果启用）
    var redisClient *redisv8.Client
    if rlConfig.UseRedis {
        // 优先从内部配置获取 Redis 信息
        if cm != nil && cm.GetConfig() != nil {
            r := cm.GetRedisConfig()
            redisClient = redisv8.NewClient(&redisv8.Options{
                Addr:     fmt.Sprintf("%s:%d", r.Host, r.Port),
                Password: r.Password,
                DB:       r.DB,
                PoolSize: r.PoolSize,
            })
        } else {
            rv, _ := gcfg.Instance().Get(ctx, "redis")
            rarr := gconv.Map(rv)
            redisClient = redisv8.NewClient(&redisv8.Options{
                Addr:     fmt.Sprintf("%v:%v", rarr["host"], rarr["port"]),
                Password: gconv.String(rarr["password"]),
                DB:       gconv.Int(rarr["db"]),
                PoolSize: gconv.Int(rarr["pool_size"]),
            })
        }
    }
    rl := middleware.NewRateLimitMiddleware(rlConfig, redisClient)
    // 套餐级 API 限流（从配置加载）
    buildPlanRates := func() map[string]middleware.PlanRateConfig {
        rates := map[string]middleware.PlanRateConfig{}
        if cm != nil && cm.GetConfig() != nil {
            for name, pr := range cm.GetRateLimitConfig().Plans {
                rps := pr.RPS
                if rps == 0 && pr.RPM > 0 { rps = float64(pr.RPM)/60.0 }
                if rps <= 0 { continue }
                rates[name] = middleware.PlanRateConfig{RPS: rps, Burst: pr.Burst}
            }
        }
        if len(rates) == 0 {
            // fallback 默认配置
            rates["FREE"] = middleware.PlanRateConfig{RPS: 1, Burst: 10}
            rates["PRO"] = middleware.PlanRateConfig{RPS: 10, Burst: 100}
            rates["MAX"] = middleware.PlanRateConfig{RPS: 50, Burst: 300}
        }
        return rates
    }
    rl.SetPlanRates(buildPlanRates(), redisClient)
    // DB 动态限额下发：存在 rate_limit_configs 表时每分钟刷新一次
    go func() {
        ticker := time.NewTicker(60 * time.Second)
        defer ticker.Stop()
        for range ticker.C {
            // 检查表是否存在
            if _, err := gf.DB().Query(ctx, "SELECT 1 FROM rate_limit_configs LIMIT 1"); err != nil {
                continue
            }
            rows, err := gf.DB().Query(ctx, `SELECT plan, feature, per_minute, per_hour FROM rate_limit_configs WHERE is_active=1`)
            if err != nil || rows.IsEmpty() { continue }
            rates := map[string]middleware.PlanRateConfig{}
            for _, rec := range rows {
                plan := rec["plan"].String()
                feature := strings.ToUpper(rec["feature"].String())
                if feature != "API" { continue }
                pm := rec["per_minute"].Int()
                rps := float64(pm) / 60.0
                if rps <= 0 { continue }
                rates[plan] = middleware.PlanRateConfig{RPS: rps, Burst: pm}
            }
            if len(rates) > 0 {
                rl.SetPlanRates(rates, redisClient)
            }
        }
    }()

    // 事件驱动：订阅 Redis 通道触发限额刷新（比轮询更及时）
    if rlConfig.UseRedis && redisClient != nil {
        go func() {
            pubsub := redisClient.Subscribe(ctx, "ratelimit:plans:update")
            ch := pubsub.Channel()
            for range ch {
                rows, err := gf.DB().Query(ctx, `SELECT plan, feature, per_minute, per_hour FROM rate_limit_configs WHERE is_active=1`)
                if err != nil || rows.IsEmpty() { continue }
                rates := map[string]middleware.PlanRateConfig{}
                for _, rec := range rows {
                    if strings.ToUpper(rec["feature"].String()) != "API" { continue }
                    pm := rec["per_minute"].Int()
                    rps := float64(pm)/60.0
                    if rps <= 0 { continue }
                    rates[rec["plan"].String()] = middleware.PlanRateConfig{RPS: rps, Burst: pm}
                }
                if len(rates) > 0 {
                    rl.SetPlanRates(rates, redisClient)
                }
            }
        }()
    }
    R.Use(rl.GlobalRateLimit())
    R.Use(rl.IPRateLimit())
    R.Use(rl.PlanAPIRateLimit(resolveUserPlan))

    // 监听配置热更新，动态刷新套餐限额
    if cm != nil && cm.GetConfig() != nil {
        cm.AddCallback(func(cfg *config.Config) {
            rates := map[string]middleware.PlanRateConfig{}
            for name, pr := range cfg.RateLimit.Plans {
                rps := pr.RPS
                if rps == 0 && pr.RPM > 0 { rps = float64(pr.RPM)/60.0 }
                if rps <= 0 { continue }
                rates[name] = middleware.PlanRateConfig{RPS: rps, Burst: pr.Burst}
            }
            if len(rates) > 0 {
                rl.SetPlanRates(rates, redisClient)
            }
        })
    }
	//3.判断接口是否合法
	R.Use(routeuse.ValidityAPi())
	//4.验证token
	R.Use(routeuse.JwtVerify)
    R.Use(Logger())
    // 管理员JWT保护
    R.Use(admin.AdminJWT())

	// 指标与健康检查路由
	metrics.SetupMetrics(R)
	//5.没有注册的路由
	R.NoRoute(func(c *gin.Context) {
		pathURL := c.Request.URL.Path
		method := c.Request.Method
		if method == "GET" && pathURL == "/" { //部署同服务器域名下的网站
			indexfilePath := filepath.Join(path, "resource/static/index.html")
			if _, err := os.Stat(indexfilePath); err == nil {
				data, err := os.ReadFile(indexfilePath)
				if err != nil {
					c.AbortWithError(http.StatusInternalServerError, err)
					return
				}
				c.Data(http.StatusOK, "text/html; charset=utf-8", data)
			} else {
				c.Redirect(http.StatusMovedPermanently, fmt.Sprintf("%v/", appConf_arr["rootview"]))
			}
			c.Abort()
			return
		}
		//找不到路由
		c.JSON(http.StatusOK, gin.H{"code": 404, "message": "您" + method + "请求地址：" + pathURL + "不存在！"})
	})
	Bind(R)
	return R
}

// 绑定路由 m是方法GET POST等
// 绑定基本路由
func Bind(c *gin.Engine) {
	// 绑定自动生成的路由
	for _, route := range gf.Routes {
		if route.HttpMethod == "GET" {
			c.GET(route.Path, minHandler(route), gf.PathMatch(route.Path, route))
		}
		if route.HttpMethod == "POST" {
			c.POST(route.Path, minHandler(route), gf.PathMatch(route.Path, route))
		}
		if route.HttpMethod == "DELETE" {
			c.DELETE(route.Path, minHandler(route), gf.PathMatch(route.Path, route))
		}
		if route.HttpMethod == "PUT" {
			c.PUT(route.Path, minHandler(route), gf.PathMatch(route.Path, route))
		}
	}

	// 绑定手动注册的路由
	for _, route := range gf.GetManualRoutes() {
		switch route.Method {
		case "GET":
			c.GET(route.Path, route.Handler)
		case "POST":
			c.POST(route.Path, route.Handler)
		case "PUT":
			c.PUT(route.Path, route.Handler)
		case "DELETE":
			c.DELETE(route.Path, route.Handler)
		case "PATCH":
			c.PATCH(route.Path, route.Handler)
		case "OPTIONS":
			c.OPTIONS(route.Path, route.Handler)
		}
	}
}

// resolveUserPlan 解析用户当前套餐（仅用户↔套餐，不看角色）
func resolveUserPlan(c *gin.Context) string {
    userID := c.GetString("userID")
    if userID == "" {
        userID = c.GetString("user_id")
    }
    if userID == "" {
        return "FREE"
    }

    // 1) 短期缓存
    planKey := "user:plan:" + userID
    var cached string
    if err := cache.GetCache().Get(planKey, &cached); err == nil && cached != "" {
        return cached
    }

    // 2) 数据库：subscriptions + plans（若无表则回退）
    ctx := c.Request.Context()
    sql := `SELECT p.name AS plan_name, s.ended_at FROM subscriptions s
            JOIN plans p ON p.id = s.plan_id
            WHERE s.user_id = ? AND s.status = 'ACTIVE'
            ORDER BY s.updated_at DESC LIMIT 1`
    res, err := gf.DB().Query(ctx, sql, userID)
    if err == nil && !res.IsEmpty() {
        rec := res[0]
        plan := rec["plan_name"].String()
        endedAt := rec["ended_at"].String()
        if endedAt != "" {
            layouts := []string{time.RFC3339Nano, time.RFC3339, "2006-01-02 15:04:05"}
            for _, layout := range layouts {
                if t, e := time.Parse(layout, endedAt); e == nil {
                    if time.Now().After(t) { plan = "FREE" }
                    break
                }
            }
        }
        if plan == "" { plan = "FREE" }
        _ = cache.GetCache().Set(planKey, plan, 2*time.Minute)
        return plan
    }

    return "FREE"
}

// minHandler统一处理登录操作和独立模块处理路由拦截
func minHandler(rule gf.Route) gin.HandlerFunc {
	return func(c *gin.Context) {
		//先处理登录
		if gf.NeedLoginMatch(rule.Action, rule.NoNeedLogin) && c.GetBool("jwtempty") { //需要登录-且token无效
			gf.Failed().SetMsg(gf.LocaleMsg().SetLanguage(c.Request.Header.Get("locale")).Message("sys_login_invalid")).SetExdata(c.GetString("jwtmsg")).SetCode(401).Regin(c)
			c.Abort()
			return
		} else {
			c.Set("Action", rule.Action)
			c.Set("NoNeedAuths", rule.NoNeedAuths)
			app.RouterHandler(c)
		}
	}
}
