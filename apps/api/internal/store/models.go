package store

import "time"

// Roles and statuses (kept in sync with the web app's contracts).
const (
	RoleOwner    = "OWNER"
	RoleManager  = "MANAGER"
	RoleOperator = "OPERATOR"

	StatusActive   = "ACTIVE"
	StatusPending  = "PENDING"
	StatusDisabled = "DISABLED"

	InvitePending  = "PENDING"
	InviteAccepted = "ACCEPTED"
	InviteRevoked  = "REVOKED"
)

// CanManageMembers reports whether a role may invite/manage other members.
func CanManageMembers(role string) bool {
	return role == RoleOwner || role == RoleManager
}

type User struct {
	UID         string    `json:"uid"          db:"uid"`
	DisplayName string    `json:"displayName"  db:"display_name"`
	Phone       string    `json:"phone"        db:"phone"`
	Email       string    `json:"email"        db:"email"`
	Role        string    `json:"role"         db:"role"`
	HouseName   string    `json:"houseName"    db:"house_name"`
	Status      string    `json:"status"       db:"status"`
	InvitedBy   string    `json:"invitedBy"    db:"invited_by"`
	CreatedAt   time.Time `json:"createdAt"    db:"created_at"`
}

type Invitation struct {
	ID         string     `json:"id"         db:"id"`
	Email      string     `json:"email"      db:"email"`
	Phone      string     `json:"phone"      db:"phone"`
	Role       string     `json:"role"       db:"role"`
	Status     string     `json:"status"     db:"status"`
	InvitedBy  string     `json:"invitedBy"  db:"invited_by"`
	CreatedAt  time.Time  `json:"createdAt"  db:"created_at"`
	AcceptedAt *time.Time `json:"acceptedAt" db:"accepted_at"`
}

type Batch struct {
	ID              string    `json:"id"              db:"id"`
	LotCode         string    `json:"lotCode"         db:"lot_code"`
	FarmerName      string    `json:"farmerName"      db:"farmer_name"`
	Village         string    `json:"village"         db:"village"`
	GreenWeightKg   float64   `json:"greenWeightKg"   db:"green_weight_kg"`
	DriedWeightKg   *float64  `json:"driedWeightKg"   db:"dried_weight_kg"`
	ChamberID       *string   `json:"chamberId"       db:"chamber_id"`
	Stage           string    `json:"stage"           db:"stage"`
	StartedAt       time.Time `json:"startedAt"       db:"started_at"`
	TargetMoisture  float64   `json:"targetMoisture"  db:"target_moisture"`
	CurrentMoisture float64   `json:"currentMoisture" db:"current_moisture"`
	Grade           *string   `json:"grade"           db:"grade"`
	RatePerKg       float64   `json:"ratePerKg"       db:"rate_per_kg"`
	Note            *string   `json:"note"            db:"note"`
	Ownership       string    `json:"ownership"       db:"ownership"`
	FarmerID        *string   `json:"farmerId"        db:"farmer_id"`
	CuringRatePerKg float64   `json:"curingRatePerKg" db:"curing_rate_per_kg"`
	GradingCharge   float64   `json:"gradingCharge"   db:"grading_charge"`
}

type Chamber struct {
	ID           string   `json:"id"           db:"id"`
	Name         string   `json:"name"         db:"name"`
	Type         string   `json:"type"         db:"type"`
	Status       string   `json:"status"       db:"status"`
	TempC        float64  `json:"tempC"        db:"temp_c"`
	TargetTempC  float64  `json:"targetTempC"  db:"target_temp_c"`
	Humidity     float64  `json:"humidity"     db:"humidity"`
	LoadKg       float64  `json:"loadKg"       db:"load_kg"`
	CapacityKg   float64  `json:"capacityKg"   db:"capacity_kg"`
	BatchID      *string    `json:"batchId"      db:"batch_id"`
	ElapsedHours float64    `json:"elapsedHours" db:"elapsed_hours"`
	CycleHours   float64    `json:"cycleHours"   db:"cycle_hours"`
	StartedAt    *time.Time `json:"startedAt"    db:"started_at"`
}

type IntakeReceipt struct {
	ID          string    `json:"id"          db:"id"`
	FarmerName  string    `json:"farmerName"  db:"farmer_name"`
	Village     string    `json:"village"     db:"village"`
	WeightKg    float64   `json:"weightKg"    db:"weight_kg"`
	MoisturePct float64   `json:"moisturePct" db:"moisture_pct"`
	RatePerKg   float64   `json:"ratePerKg"   db:"rate_per_kg"`
	ReceivedAt  time.Time `json:"receivedAt"  db:"received_at"`
	Status      string    `json:"status"      db:"status"`
}

type InventoryLot struct {
	Grade       string  `json:"grade"       db:"grade"`
	BulkKg      float64 `json:"bulkKg"      db:"bulk_kg"`
	Bags        int     `json:"bags"        db:"bags"`
	Location    string  `json:"location"    db:"location"`
	AvgMoisture float64 `json:"avgMoisture" db:"avg_moisture"`
	CostPerKg   float64 `json:"costPerKg"   db:"cost_per_kg"`
}
