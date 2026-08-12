// Package notify sends push notifications via the OneSignal REST API.
package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"
)

const endpoint = "https://api.onesignal.com/notifications"

// OneSignal pushes notifications to all subscribed users of the app.
type OneSignal struct {
	appID  string
	apiKey string
	client *http.Client
}

func New(appID, apiKey string) *OneSignal {
	return &OneSignal{appID: appID, apiKey: apiKey, client: &http.Client{Timeout: 10 * time.Second}}
}

// Enabled reports whether a REST API key is configured.
func (o *OneSignal) Enabled() bool { return o != nil && o.apiKey != "" && o.appID != "" }

// Push sends a notification to every subscribed user. It is fire-and-forget:
// failures are logged, never surfaced to the caller, and never block a request.
func (o *OneSignal) Push(heading, content string) {
	if !o.Enabled() {
		return
	}
	go func() {
		body, _ := json.Marshal(map[string]any{
			"app_id":            o.appID,
			"target_channel":    "push",
			"included_segments": []string{"Subscribed Users"},
			"headings":          map[string]string{"en": heading},
			"contents":          map[string]string{"en": content},
		})

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Key "+o.apiKey)

		resp, err := o.client.Do(req)
		if err != nil {
			log.Printf("onesignal push failed: %v", err)
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 300 {
			log.Printf("onesignal push status %d", resp.StatusCode)
		}
	}()
}
