# ---- build ----
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/dryo-api ./cmd/server

# ---- run ----
FROM alpine:3.20
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 app
USER app
COPY --from=build /out/dryo-api /dryo-api
# Render injects $PORT; the app reads it (defaults to 8080 locally).
EXPOSE 8080
ENTRYPOINT ["/dryo-api"]
