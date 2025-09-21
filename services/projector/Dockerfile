# services/projector/Dockerfile
FROM golang:1.21-alpine

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o /projector-service ./cmd/server

CMD ["/projector-service"]
