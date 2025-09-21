module autoads/batchopen

go 1.24.7

require (
	github.com/go-redis/redis/v8 v8.11.5
	github.com/google/uuid v1.6.0
	github.com/lib/pq v1.10.9
)

require (
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/fsnotify/fsnotify v1.9.0 // indirect
	github.com/joho/godotenv v1.5.1 // indirect
	golang.org/x/net v0.43.0 // indirect
	golang.org/x/sys v0.36.0 // indirect
	golang.org/x/text v0.29.0 // indirect
)

replace github.com/xxrenzhe/autoads/pkg/middleware => ../../pkg/middleware

replace github.com/xxrenzhe/autoads/pkg/config => ../../pkg/config

replace github.com/xxrenzhe/autoads/pkg/logger => ../../pkg/logger
