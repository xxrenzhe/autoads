FROM golang:1.25 as builder
WORKDIR /src
COPY services/recommendations/go.mod services/recommendations/go.mod
RUN go mod download || true
COPY . .
WORKDIR /src/services/recommendations
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/recommendations

FROM gcr.io/distroless/base-debian12
WORKDIR /app
COPY --from=builder /out/recommendations /app/recommendations
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/recommendations"]
