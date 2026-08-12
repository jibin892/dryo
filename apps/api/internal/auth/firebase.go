package auth

import (
	"context"
	"log"
	"net/http"
	"strings"

	firebase "firebase.google.com/go/v4"
	fbauth "firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"

	"github.com/dryo/api/internal/httpapi/httperr"
)

// Claims is the trusted identity extracted from a verified Firebase ID token.
type Claims struct {
	UID    string
	Email  string
	Phone  string
	Name   string
	Google bool // signed in with google.com
}

// Verifier validates Firebase ID tokens. When disabled (dev only) it injects a
// fixed development identity so the API can be exercised with curl.
type Verifier struct {
	client   *fbauth.Client
	disabled bool
}

// NewVerifier initialises Firebase. With a service-account file it uses those
// credentials; otherwise it verifies tokens using only the project ID and
// Google's public keys (no secret key file required).
func NewVerifier(ctx context.Context, projectID, credsPath string, disabled bool) (*Verifier, error) {
	if disabled {
		log.Println("⚠️  AUTH_DISABLED=true — Firebase verification is OFF. Never use this in production.")
		return &Verifier{disabled: true}, nil
	}

	opts := []option.ClientOption{}
	if credsPath != "" {
		opts = append(opts, option.WithCredentialsFile(credsPath))
	} else {
		opts = append(opts, option.WithoutAuthentication())
	}

	app, err := firebase.NewApp(ctx, &firebase.Config{ProjectID: projectID}, opts...)
	if err != nil {
		return nil, err
	}
	client, err := app.Auth(ctx)
	if err != nil {
		return nil, err
	}
	return &Verifier{client: client}, nil
}

func (v *Verifier) verify(ctx context.Context, idToken string) (*Claims, error) {
	if v.disabled {
		return &Claims{UID: "dev-user", Name: "Dev User", Email: "dev@dryo.local", Google: true}, nil
	}
	// VerifyIDToken checks signature, expiry, issuer and audience against the
	// configured Firebase project. A revoked/forged token fails here.
	tok, err := v.client.VerifyIDToken(ctx, idToken)
	if err != nil {
		return nil, err
	}
	c := &Claims{UID: tok.UID}
	if s, ok := tok.Claims["email"].(string); ok {
		c.Email = s
	}
	if s, ok := tok.Claims["phone_number"].(string); ok {
		c.Phone = s
	}
	if s, ok := tok.Claims["name"].(string); ok {
		c.Name = s
	}
	c.Google = tok.Firebase.SignInProvider == "google.com"
	return c, nil
}

type ctxKey int

const claimsKey ctxKey = iota

// Middleware rejects any request without a valid `Authorization: Bearer <idToken>`
// header. On success the verified Claims are stored on the request context.
func (v *Verifier) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Dev bypass: inject a fixed identity without requiring a token.
		if v.disabled {
			claims, _ := v.verify(r.Context(), "")
			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}
		authz := r.Header.Get("Authorization")
		if !strings.HasPrefix(authz, "Bearer ") {
			httperr.Write(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		token := strings.TrimSpace(strings.TrimPrefix(authz, "Bearer "))
		if token == "" {
			httperr.Write(w, http.StatusUnauthorized, "empty bearer token")
			return
		}
		claims, err := v.verify(r.Context(), token)
		if err != nil {
			// Do not leak verifier internals to the client.
			httperr.Write(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}
		ctx := context.WithValue(r.Context(), claimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ClaimsFrom returns the verified identity attached by Middleware.
func ClaimsFrom(ctx context.Context) (*Claims, bool) {
	c, ok := ctx.Value(claimsKey).(*Claims)
	return c, ok
}
