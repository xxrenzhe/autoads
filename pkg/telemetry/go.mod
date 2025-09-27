module github.com/xxrenzhe/autoads/pkg/telemetry

go 1.22

require (
    github.com/prometheus/client_golang v1.19.1
    go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0
    go.opentelemetry.io/otel v1.36.0
    go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.36.0
    go.opentelemetry.io/otel/sdk v1.36.0
)
