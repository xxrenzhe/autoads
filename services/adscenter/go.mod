module autoads/adscenter

go 1.24.7

require (
	github.com/go-redis/redis/v8 v8.11.5
	github.com/lib/pq v1.10.9
	github.com/xxrenzhe/autoads/pkg/config v0.0.0-00010101000000-000000000000
	github.com/xxrenzhe/autoads/pkg/middleware v0.0.0-00010101000000-000000000000
)

require (
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/golang-jwt/jwt/v4 v4.5.2 // indirect
	github.com/kr/text v0.2.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace github.com/xxrenzhe/autoads/pkg/middleware => ../../pkg/middleware

replace github.com/xxrenzhe/autoads/pkg/config => ../../pkg/config

replace github.com/xxrenzhe/autoads/pkg/logger => ../../pkg/logger
