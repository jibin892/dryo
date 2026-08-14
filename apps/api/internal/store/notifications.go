package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// Notification is a team-feed entry (JSON `at` matches the web contract). ReadAt
// is per-viewer, resolved by the list query.
type Notification struct {
	ID        string     `json:"id"     db:"id"`
	Title     string     `json:"title"  db:"title"`
	Body      string     `json:"body"   db:"body"`
	Tone      string     `json:"tone"   db:"tone"`
	CreatedAt time.Time  `json:"at"     db:"created_at"`
	ReadAt    *time.Time `json:"readAt" db:"read_at"`
}

// AddNotification logs an activity entry attributed to actorUID (may be empty
// for system events). The actor themselves won't see it; everyone else will.
func (s *Store) AddNotification(ctx context.Context, actorUID, title, body, tone string) error {
	if tone == "" {
		tone = "neutral"
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO notifications (id, actor_uid, title, body, tone) VALUES ($1, NULLIF($2,''), $3, $4, $5)`,
		newID("ntf"), actorUID, title, body, tone)
	return err
}

// ListNotificationsFor returns the feed for a viewer: everyone else's activity,
// each with the viewer's own read timestamp.
func (s *Store) ListNotificationsFor(ctx context.Context, viewerUID string, limit int) ([]Notification, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `
		SELECT n.id, n.title, n.body, n.tone, n.created_at,
		       (SELECT r.read_at FROM notification_reads r WHERE r.notification_id = n.id AND r.uid = $1) AS read_at
		FROM notifications n
		WHERE n.actor_uid IS DISTINCT FROM $1
		ORDER BY n.created_at DESC
		LIMIT $2`, viewerUID, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[Notification])
}

// MarkNotificationsReadFor marks every entry currently visible to the viewer as
// read by that viewer (leaves other viewers' badges untouched).
func (s *Store) MarkNotificationsReadFor(ctx context.Context, viewerUID string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO notification_reads (notification_id, uid)
		SELECT n.id, $1 FROM notifications n
		WHERE n.actor_uid IS DISTINCT FROM $1
		ON CONFLICT (notification_id, uid) DO NOTHING`, viewerUID)
	return err
}
