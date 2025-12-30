# Multi-stage build
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.25-alpine AS backend-builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/ ./cmd/
COPY --from=frontend-builder /app/frontend/../web/dist ./web/dist

# Accept build args for version info
ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown
ARG GIT_TAG=

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-X main.GitCommit=${GIT_COMMIT} -X main.BuildDate=${BUILD_DATE} -X main.GitTag=${GIT_TAG}" \
    -o /app/server ./cmd/server

FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app

COPY --from=backend-builder /app/server /app/server
COPY --from=backend-builder /app/web/dist /app/web/dist

RUN mkdir -p /app/web/uploads

ENV PORT=8080
EXPOSE 8080

CMD ["/app/server"]
