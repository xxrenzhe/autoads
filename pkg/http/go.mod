module github.com/xxrenzhe/autoads/pkg/http

go 1.21

require (
    github.com/xxrenzhe/autoads/pkg/httpclient v0.0.0
    github.com/xxrenzhe/autoads/pkg/idempotency v0.0.0
)

replace github.com/xxrenzhe/autoads/pkg/httpclient => ../httpclient
replace github.com/xxrenzhe/autoads/pkg/idempotency => ../idempotency

