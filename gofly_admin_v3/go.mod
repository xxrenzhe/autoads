module gofly-admin-v3

go 1.23.0

require (
	github.com/360EntSecGroup-Skylar/excelize v1.4.1
	github.com/BurntSushi/toml v1.5.0
	github.com/PuerkitoBio/goquery v1.10.3
	github.com/chromedp/cdproto v0.0.0-20240127002248-bd7a66284627
	github.com/chromedp/chromedp v0.9.4
	github.com/clbanning/mxj/v2 v2.7.0 // indirect
	github.com/didip/tollbooth v4.0.2+incompatible // indirect
	github.com/disintegration/imaging v1.6.2
	github.com/emirpasic/gods v1.18.1 // indirect
	github.com/fatih/color v1.18.0 // indirect
	github.com/fsnotify/fsnotify v1.9.0
	github.com/gin-contrib/cors v1.5.0 // indirect
	github.com/gin-gonic/gin v1.10.1
	github.com/go-redis/redis/v8 v8.11.5
	github.com/go-sql-driver/mysql v1.9.3 // indirect
	github.com/golang-jwt/jwt/v5 v5.3.0
	github.com/google/uuid v1.6.0
	github.com/magiconair/properties v1.8.10 // indirect
	github.com/mojocn/base64Captcha v1.3.6 // indirect
	github.com/prometheus/client_golang v1.19.1
	github.com/redis/go-redis/v9 v9.14.0
	github.com/robfig/cron/v3 v3.0.1
	github.com/spf13/viper v1.21.0
	github.com/u2takey/ffmpeg-go v0.5.0
	go.opentelemetry.io/otel v1.37.0 // indirect
	go.opentelemetry.io/otel/sdk v1.37.0 // indirect
	go.opentelemetry.io/otel/trace v1.37.0 // indirect
	gofly-admin-v3/utils/drivers v0.0.0

	// Local packages
	gofly-admin-v3/utils/gf v0.0.0
	gofly-admin-v3/utils/gform v0.0.0
	gofly-admin-v3/utils/gtime v0.0.0
	gofly-admin-v3/utils/gvalid v0.0.0
	gofly-admin-v3/utils/router v0.0.0
	gofly-admin-v3/utils/tools v0.0.0
	golang.org/x/crypto v0.37.0
	golang.org/x/oauth2 v0.16.0
	golang.org/x/text v0.28.0 // indirect
	gopkg.in/gomail.v2 v2.0.0-20160411212932-81ebce5c23df // indirect
	gopkg.in/yaml.v2 v2.4.0
	gopkg.in/yaml.v3 v3.0.1 // indirect
	gorm.io/driver/mysql v1.6.0
	gorm.io/gorm v1.30.5
)

replace gofly-admin-v3/utils/gf => ./utils/gf

replace gofly-admin-v3/utils/gform => ./utils/gform

replace gofly-admin-v3/utils/tools => ./utils/tools

replace gofly-admin-v3/utils/drivers => ./utils/drivers

replace gofly-admin-v3/utils/router => ./utils/router

replace gofly-admin-v3/utils/gtime => ./utils/gtime

replace gofly-admin-v3/utils/gvalid => ./utils/gvalid

require (
	github.com/golang/freetype v0.0.0-20170609003504-e2365dfdc4a0
	github.com/gorilla/websocket v1.5.3
	github.com/stretchr/testify v1.11.1
	golang.org/x/image v0.13.0
	golang.org/x/net v0.39.0
	golang.org/x/time v0.5.0
	gorm.io/driver/sqlite v1.6.0
)

require (
	cloud.google.com/go/compute v1.23.3 // indirect
	cloud.google.com/go/compute/metadata v0.2.3 // indirect
	filippo.io/edwards25519 v1.1.0 // indirect
	github.com/andybalholm/cascadia v1.3.3 // indirect
	github.com/aws/aws-sdk-go v1.38.20 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/bytedance/sonic v1.11.6 // indirect
	github.com/bytedance/sonic/loader v0.1.1 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/chromedp/sysutil v1.0.0 // indirect
	github.com/cloudwego/base64x v0.1.4 // indirect
	github.com/cloudwego/iasm v0.2.0 // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/gabriel-vasile/mimetype v1.4.3 // indirect
	github.com/gin-contrib/sse v0.1.0 // indirect
	github.com/go-logr/logr v1.4.3 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/go-playground/validator/v10 v10.20.0 // indirect
	github.com/go-viper/mapstructure/v2 v2.4.0 // indirect
	github.com/gobwas/httphead v0.1.0 // indirect
	github.com/gobwas/pool v0.2.1 // indirect
	github.com/gobwas/ws v1.3.2 // indirect
	github.com/goccy/go-json v0.10.2 // indirect
	github.com/golang/protobuf v1.5.3 // indirect
	github.com/jinzhu/inflection v1.0.0 // indirect
	github.com/jinzhu/now v1.1.5 // indirect
	github.com/jmespath/go-jmespath v0.4.0 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/json-iterator/go v1.1.12 // indirect
	github.com/klauspost/cpuid/v2 v2.2.7 // indirect
	github.com/leodido/go-urn v1.4.0 // indirect
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mattn/go-sqlite3 v1.14.22 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.2 // indirect
	github.com/mohae/deepcopy v0.0.0-20170929034955-c48cc78d4826 // indirect
	github.com/patrickmn/go-cache v2.1.0+incompatible // indirect
	github.com/pelletier/go-toml/v2 v2.2.4 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/prometheus/client_model v0.5.0 // indirect
	github.com/prometheus/common v0.48.0 // indirect
	github.com/prometheus/procfs v0.12.0 // indirect
	github.com/sagikazarmark/locafero v0.11.0 // indirect
	github.com/sourcegraph/conc v0.3.1-0.20240121214520-5f936abd7ae8 // indirect
	github.com/spf13/afero v1.15.0 // indirect
	github.com/spf13/cast v1.10.0 // indirect
	github.com/spf13/pflag v1.0.10 // indirect
	github.com/stretchr/objx v0.5.2 // indirect
	github.com/subosito/gotenv v1.6.0 // indirect
	github.com/twitchyliquid64/golang-asm v0.15.1 // indirect
	github.com/u2takey/go-utils v0.3.1 // indirect
	github.com/ugorji/go/codec v1.2.12 // indirect
	go.opentelemetry.io/auto/sdk v1.1.0 // indirect
	go.opentelemetry.io/otel/metric v1.37.0 // indirect
	go.yaml.in/yaml/v3 v3.0.4 // indirect
	golang.org/x/arch v0.8.0 // indirect
	golang.org/x/sys v0.33.0 // indirect
	google.golang.org/appengine v1.6.7 // indirect
	google.golang.org/protobuf v1.34.1 // indirect
	gopkg.in/alexcesaro/quotedprintable.v3 v3.0.0-20150716171945-2caba252f4dc // indirect
	gorm.io/datatypes v1.2.6 // indirect
)
