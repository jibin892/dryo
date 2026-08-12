package config

import (
	"os"
	"strconv"
	"strings"
)

// Config holds all runtime configuration, sourced from environment variables.
type Config struct {
	Port              string
	DatabaseURL       string
	DBMaxConns        int32
	RunMigrations     bool
	SeedOnMigrate     bool
	FirebaseProjectID string
	GoogleCredentials string
	AuthDisabled      bool
	CORSOrigins       []string
	OneSignalAppID    string
	OneSignalKey      string
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getbool(key string, def bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return def
	}
	return b
}

// Load reads configuration from the process environment.
func Load() Config {
	maxConns, _ := strconv.Atoi(getenv("DB_MAX_CONNS", "10"))

	var origins []string
	for _, o := range strings.Split(getenv("CORS_ORIGINS", "http://localhost:5173"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			origins = append(origins, o)
		}
	}

	return Config{
		Port:              getenv("PORT", "8080"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		DBMaxConns:        int32(maxConns),
		RunMigrations:     getbool("RUN_MIGRATIONS", true),
		SeedOnMigrate:     getbool("SEED_ON_MIGRATE", true),
		FirebaseProjectID: os.Getenv("FIREBASE_PROJECT_ID"),
		GoogleCredentials: os.Getenv("GOOGLE_APPLICATION_CREDENTIALS"),
		AuthDisabled:      getbool("AUTH_DISABLED", false),
		CORSOrigins:       origins,
		OneSignalAppID:    getenv("ONESIGNAL_APP_ID", "d0b787e4-6ae5-4869-ad83-9086b501040f"),
		OneSignalKey:      os.Getenv("ONESIGNAL_REST_API_KEY"),
	}
}
