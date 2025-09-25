module github.com/xxrenzhe/autoads/services/batchopen

go 1.25.1

require (
	github.com/go-redis/redis/v8 v8.11.5
	github.com/google/uuid v1.6.0
	github.com/joho/godotenv v1.5.1
	github.com/lib/pq v1.10.9
	github.com/xxrenzhe/autoads/pkg/auth v0.0.1
	github.com/xxrenzhe/autoads/pkg/eventbus v0.0.0-20250921095352-ef8078c06b83
	github.com/xxrenzhe/autoads/pkg/logger v0.0.0-20250921095352-ef8078c06b83
)

require (
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/rs/zerolog v1.34.0 // indirect
	golang.org/x/sys v0.36.0 // indirect
)

replace github.com/xxrenzhe/autoads/pkg/auth => ../../pkg/auth
