.PHONY: help install web web-build api api-build tidy migrate psql db-up

help:
	@echo "Dryo monorepo — common tasks"
	@echo "  make install     Install web deps (npm workspaces)"
	@echo "  make web         Run the React PWA (Vite dev server)"
	@echo "  make web-build   Production build of the web app"
	@echo "  make api         Run the Go API (reads apps/api/.env)"
	@echo "  make api-build   Compile the Go API to bin/dryo-api"
	@echo "  make tidy        go mod tidy for the API"
	@echo "  make migrate     Apply SQL migrations with psql ($$DATABASE_URL)"
	@echo "  make psql        Open a psql shell against $$DATABASE_URL"

install:
	npm install

web:
	npm run web

web-build:
	npm run web:build

api:
	npm run api

api-build:
	npm run api:build

tidy:
	npm run api:tidy

# Applies every migration in order. Requires DATABASE_URL in your shell,
# e.g.  export DATABASE_URL=postgres://user:pass@localhost:5432/dryo
migrate:
	@for f in apps/api/migrations/*.up.sql; do \
		echo "applying $$f"; \
		psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f $$f; \
	done

psql:
	psql "$$DATABASE_URL"
