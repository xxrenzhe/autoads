module github.com/autoads-dev/autoads-saas/services/identity

go 1.24.7

require (
	github.com/go-redis/redis/v8 v8.11.5
	github.com/golang-jwt/jwt/v4 v4.5.2
	github.com/google/uuid v1.6.0
	github.com/lib/pq v1.10.9
	github.com/xxrenzhe/autoads/pkg/config v0.0.0-00010101000000-000000000000
	github.com/xxrenzhe/autoads/pkg/logger v0.0.0-00010101000000-000000000000
	github.com/xxrenzhe/autoads/pkg/middleware v0.0.0-00010101000000-000000000000
	golang.org/x/crypto v0.42.0
)

require (
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/kr/text v0.2.0 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/rs/zerolog v1.34.0 // indirect
	golang.org/x/sys v0.36.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace github.com/xxrenzhe/autoads/pkg/middleware => ../../pkg/middleware

replace github.com/xxrenzhe/autoads/pkg/config => ../../pkg/config

replace github.com/xxrenzhe/autoads/pkg/logger => ../../pkg/logger

replace github.com/xxrenzhe/autoads/pkg/eventbus => ../../pkg/eventbus
