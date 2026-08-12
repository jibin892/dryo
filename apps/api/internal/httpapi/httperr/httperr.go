// Package httperr writes consistent JSON error bodies. It lives in its own
// package so both the auth middleware and HTTP handlers can use it without an
// import cycle.
package httperr

import (
	"encoding/json"
	"net/http"
)

// Write emits {"error": "..."} with the given status code.
func Write(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
