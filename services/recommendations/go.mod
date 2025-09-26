module github.com/xxrenzhe/autoads/services/recommendations

go 1.22

require (
    github.com/go-chi/chi/v5 v5.2.3
    github.com/lib/pq v1.10.9
)

replace github.com/xxrenzhe/autoads/pkg/telemetry => ../../pkg/telemetry
replace github.com/xxrenzhe/autoads/pkg/middleware => ../../pkg/middleware
replace github.com/xxrenzhe/autoads/pkg/errors => ../../pkg/errors
replace github.com/xxrenzhe/autoads/services/recommendations/internal/oapi => ./internal/oapi
