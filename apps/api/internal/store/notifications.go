package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// Notification is a house-feed entry (JSON `at` matches the web contract).
type Notification struct {
	ID        string     `json:"id"     db:"id"`
	Title     string     `json:"title"  db:"title"`
	Body      string     `json:"body"   db:"body"`
	Tone      string     `json:"tone"   db:"tone"`
	CreatedAt time.Time  `json:"at"     db:"created_at"`
	ReadAt    *time.Time `json:"readAt" db:"read_at"`
}

const notifCols = `id, title, body, tone, created_at, read_at`

func (s *Store) AddNotification(ctx context.Context, title, body, tone string) error {
	if tone == "" {
		tone = "neutral"
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO notifications (id, title, body, tone) VALUES ($1,$2,$3,$4)`,
		newID("ntf"), title, body, tone)
	return err
}

func (s *Store) ListNotifications(ctx context.Context, limit int) ([]Notification, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `SELECT `+notifCols+` FROM notifications ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[Notification])
}

func (s *Store) MarkNotificationsRead(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `UPDATE notifications SET read_at=now() WHERE read_at IS NULL`)
	return err
}
