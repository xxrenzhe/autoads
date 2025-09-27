module github.com/xxrenzhe/autoads/services/projector

go 1.25.1

replace github.com/xxrenzhe/autoads/pkg/errors => ../../pkg/errors
replace github.com/xxrenzhe/autoads/pkg/events => ../../pkg/events

require (
    github.com/go-chi/chi/v5 v5.2.3
    github.com/lib/pq v1.10.9
    cloud.google.com/go/firestore v1.18.0
    github.com/xxrenzhe/autoads/pkg/errors v0.0.1
    github.com/xxrenzhe/autoads/pkg/events v0.0.0-00010101000000-000000000000
)

