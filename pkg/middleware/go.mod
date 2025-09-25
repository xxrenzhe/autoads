module github.com/xxrenzhe/autoads/pkg/middleware

go 1.22

require (
	github.com/xxrenzhe/autoads/pkg/auth v0.0.1
	github.com/xxrenzhe/autoads/pkg/errors v0.0.1
	github.com/xxrenzhe/autoads/pkg/logger v0.0.1
)

require (
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.19 // indirect
	github.com/rs/zerolog v1.33.0 // indirect
	golang.org/x/sys v0.12.0 // indirect
)

replace github.com/xxrenzhe/autoads/pkg/auth => ../auth

replace github.com/xxrenzhe/autoads/pkg/errors => ../errors

replace github.com/xxrenzhe/autoads/pkg/logger => ../logger
