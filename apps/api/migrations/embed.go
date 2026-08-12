package migrations

import "embed"

// FS holds the SQL migration files so the server can apply them on startup
// without depending on the working directory.
//
//go:embed *.sql
var FS embed.FS
