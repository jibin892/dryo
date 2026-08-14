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
	o.send(heading, content, map[string]any{"included_segments": []string{"Subscribed Users"}})
}

// PushToExternal sends only to the given users, identified by external id (the
// app sets this to the Firebase uid on sign-in). Used to buzz everyone except
// the person who performed an action.
func (o *OneSignal) PushToExternal(externalIDs []string, heading, content string) {
	if len(externalIDs) == 0 {
		return
	}
	o.send(heading, content, map[string]any{
		"include_aliases": map[string][]string{"external_id": externalIDs},
	})
}

// send posts a notification with the given targeting fields merged in.
// Fire-and-forget: failures are logged, never surfaced, never block a request.
func (o *OneSignal) send(heading, content string, target map[string]any) {
	if !o.Enabled() {
		return
	}
	payload := map[string]any{
		"app_id":         o.appID,
		"target_channel": "push",
		"headings":       map[string]string{"en": heading},
		"contents":       map[string]string{"en": content},
	}
	for k, v := range target {
		payload[k] = v
	}
	go func() {
		body, _ := json.Marshal(payload)
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
