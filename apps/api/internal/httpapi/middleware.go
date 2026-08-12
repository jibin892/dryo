package httpapi

import (
	"context"
	"net/http"

	"github.com/dryo/api/internal/auth"
	"github.com/dryo/api/internal/store"
)

type userCtxKey int

const userKey userCtxKey = iota

// securityHeaders applies conservative, app-wide response hardening.
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Cross-Origin-Resource-Policy", "same-site")
		h.Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
		if r.TLS != nil {
			h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
		}
		next.ServeHTTP(w, r)
	})
}

// requireActive provisions/loads the caller's account and blocks any user who is
// not ACTIVE. The loaded user is attached to the request context.
func (a *API) requireActive(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := auth.ClaimsFrom(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthenticated")
			return
		}
		u, err := a.store.GetUser(r.Context(), claims.UID)
		if err == store.ErrNotFound {
			// First contact on a non-/me route — provision, then re-check.
			u, err = a.store.ProvisionUser(r.Context(), claims.UID, claims.Email, claims.Phone, claims.Name, claims.Google)
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "account lookup failed")
			return
		}
		if u.Status != store.StatusActive {
			writeError(w, http.StatusForbidden, "account is not active — ask your curing house admin for an invitation")
			return
		}
		ctx := context.WithValue(r.Context(), userKey, &u)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// requireManage allows only Owner/Manager (member & invitation management).
func (a *API) requireManage(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := userFrom(r.Context())
		if !ok || !store.CanManageMembers(u.Role) {
			writeError(w, http.StatusForbidden, "requires manager or owner role")
			return
		}
		next.ServeHTTP(w, r.WithContext(r.Context()))
	})
}

func userFrom(ctx context.Context) (*store.User, bool) {
	u, ok := ctx.Value(userKey).(*store.User)
	return u, ok
}
