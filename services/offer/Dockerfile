FROM golang:1.25 as builder
WORKDIR /workspace
ENV GO111MODULE=on
# Ignore go.work to prevent missing modules error in container
ENV GOWORK=off
# Copy minimal workspace to avoid pulling frontend/node assets
COPY go.work ./go.work
COPY pkg ./pkg
COPY services/offer ./services/offer
WORKDIR /workspace/services/offer
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /offer-service .

FROM gcr.io/distroless/base-debian12
WORKDIR /
COPY --from=builder /offer-service /offer-service
EXPOSE 8080
ENTRYPOINT ["/offer-service"]
