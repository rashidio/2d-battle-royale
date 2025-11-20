package main

import (
	"sync"

	"github.com/gorilla/websocket"
)

const (
	TICK_RATE                 = 20
	BROADCAST_RATE            = 20
	CHUNK_SIZE                = 500.0
	ZONE_INITIAL_SIZE         = 3200
	ZONE_SHRINK_RATE          = 0.5
	ZONE_RESET_INTERVAL       = 100
	COORD_EPSILON             = 0.01
	ANGLE_EPSILON             = 0.0001
	CLIENT_POS_TOLERANCE      = 15.0
	AOI_RADIUS                = 2000.0
	AOI_RADIUS_SQ             = AOI_RADIUS * AOI_RADIUS
	PLAYER_UPDATE_DISTANCE    = 3000.0
	PLAYER_UPDATE_DISTANCE_SQ = PLAYER_UPDATE_DISTANCE * PLAYER_UPDATE_DISTANCE
	SPATIAL_GRID_CELL_SIZE    = 500.0
	PLAYER_RADIUS             = 8.0
	BULLET_HIT_RADIUS         = 15.0
	PICKUP_RADIUS             = 20.0
)

type Player struct {
	ID        string  `json:"id"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Angle     float64 `json:"angle"`
	Health    int     `json:"health"`
	Alive     bool    `json:"alive"`
	Velocity  float64 `json:"velocity"`
	Ammo      int     `json:"ammo"`
	Weapon    string  `json:"weapon"`
	Score     int     `json:"score"`
	Kills     int     `json:"kills"`
	LastShoot int64   `json:"-"`
}

type Bullet struct {
	ID       string  `json:"id"`
	PlayerID string  `json:"playerId"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Angle    float64 `json:"angle"`
	Speed    float64 `json:"speed"`
	Active   bool    `json:"active"`
	Weapon   string  `json:"weapon"`
}

type AmmoPickup struct {
	ID     string  `json:"id"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Amount int     `json:"amount"`
	Active bool    `json:"active"`
}

type WeaponPickup struct {
	ID     string  `json:"id"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Weapon string  `json:"weapon"`
	Active bool    `json:"active"`
}

type HealthPickup struct {
	ID     string  `json:"id"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Amount int     `json:"amount"`
	Active bool    `json:"active"`
}

type Building struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

type Tree struct {
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Size float64 `json:"size"`
	Type string  `json:"type"`
}

type GameState struct {
	Players       map[string]*Player       `json:"players"`
	Bullets       map[string]*Bullet       `json:"bullets"`
	AmmoPickups   map[string]*AmmoPickup   `json:"ammoPickups"`
	WeaponPickups map[string]*WeaponPickup `json:"weaponPickups"`
	HealthPickups map[string]*HealthPickup `json:"healthPickups"`
	Buildings     []Building               `json:"buildings"`
	Trees         []Tree                   `json:"trees"`
	ZoneCenter    float64                  `json:"zoneCenter"`
	ZoneRadius    float64                  `json:"zoneRadius"`
	GameTime      int                      `json:"gameTime"`
	Phase         string                   `json:"phase"`
	Winner        string                   `json:"winner,omitempty"`
}

type DynamicState struct {
	Players       map[string]*Player       `json:"players"`
	Bullets       map[string]*Bullet       `json:"bullets"`
	AmmoPickups   map[string]*AmmoPickup   `json:"ammoPickups"`
	WeaponPickups map[string]*WeaponPickup `json:"weaponPickups"`
	HealthPickups map[string]*HealthPickup `json:"healthPickups"`
	Buildings     []Building               `json:"buildings"`
	Trees         []Tree                   `json:"trees"`
	ZoneCenter    float64                  `json:"zoneCenter"`
	ZoneRadius    float64                  `json:"zoneRadius"`
	GameTime      int                      `json:"gameTime"`
	Phase         string                   `json:"phase"`
	Winner        string                   `json:"winner,omitempty"`
}

type clientConn struct {
	conn        *websocket.Conn
	player      *Player
	writeMu     sync.Mutex
	knownChunks map[string]bool
	lastState   *DynamicState
	lastStateMu sync.RWMutex
}

type WorldChunk struct {
	ChunkX    int        `json:"chunkX"`
	ChunkY    int        `json:"chunkY"`
	Buildings []Building `json:"buildings"`
	Trees     []Tree     `json:"trees"`
}

type StateDiff struct {
	Type           string                   `json:"type"`
	Tick           int                      `json:"tick"`
	Players        map[string]*Player       `json:"players,omitempty"`
	Bullets        map[string]*Bullet       `json:"bullets,omitempty"`
	AmmoPickups    map[string]*AmmoPickup   `json:"ammoPickups,omitempty"`
	WeaponPickups  map[string]*WeaponPickup `json:"weaponPickups,omitempty"`
	HealthPickups  map[string]*HealthPickup `json:"healthPickups,omitempty"`
	RemovedPlayers []string                 `json:"removedPlayers,omitempty"`
	RemovedBullets []string                 `json:"removedBullets,omitempty"`
	RemovedAmmo    []string                 `json:"removedAmmo,omitempty"`
	RemovedWeapons []string                 `json:"removedWeapons,omitempty"`
	RemovedHealth  []string                 `json:"removedHealth,omitempty"`
	ZoneCenter     float64                  `json:"zoneCenter,omitempty"`
	ZoneRadius     float64                  `json:"zoneRadius,omitempty"`
	GameTime       int                      `json:"gameTime,omitempty"`
	Phase          string                   `json:"phase,omitempty"`
	Winner         string                   `json:"winner,omitempty"`
}

type BotState struct {
	TargetX       float64
	TargetY       float64
	LastDirChange int
	MoveAngle     float64
}

type QueuedInput struct {
	PlayerID string
	MoveX    float64
	MoveY    float64
	Angle    float64
	Tick     int
	ClientX  float64
	ClientY  float64
}

type GameServer struct {
	clients           map[*websocket.Conn]*clientConn
	gameState         *GameState
	mu                sync.RWMutex
	upgrader          websocket.Upgrader
	nextBulletID      int
	nextAmmoID        int
	nextHealthID      int
	sessions          map[string]*Player
	sessionMu         sync.RWMutex
	botStates         map[string]*BotState
	generatedChunks   map[string]bool
	chunkData         map[string]*WorldChunk
	chunkDataMu       sync.RWMutex
	pendingChunks     []struct{ X, Y float64 }
	inputQueue        map[string][]QueuedInput
	inputQueueMu      sync.Mutex
	currentTick       int
	zoneDamageAccum   map[string]float64
	zoneDamageAccumMu sync.Mutex
	buildingGrid      *SpatialGrid
	treeGrid          *SpatialGrid
}

type InputMessage struct {
	Type    string  `json:"type"`
	MoveX   float64 `json:"moveX,omitempty"`
	MoveY   float64 `json:"moveY,omitempty"`
	Angle   float64 `json:"angle,omitempty"`
	Shoot   bool    `json:"shoot,omitempty"`
	Time    float64 `json:"time,omitempty"`
	ClientX float64 `json:"clientX,omitempty"`
	ClientY float64 `json:"clientY,omitempty"`
}
