package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

func NewGameServer() *GameServer {
	gs := &GameServer{
		clients: make(map[*websocket.Conn]*clientConn),
		gameState: &GameState{
			Players:       make(map[string]*Player),
			Bullets:       make(map[string]*Bullet),
			AmmoPickups:   make(map[string]*AmmoPickup),
			WeaponPickups: make(map[string]*WeaponPickup),
			HealthPickups: make(map[string]*HealthPickup),
			Buildings:     []Building{},
			Trees:         []Tree{},
			ZoneCenter:    0,
			ZoneRadius:    ZONE_INITIAL_SIZE,
			GameTime:      0,
			Phase:         "lobby",
		},
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
		nextBulletID:    1,
		nextAmmoID:      1,
		nextHealthID:    1,
		sessions:        make(map[string]*Player),
		botStates:       make(map[string]*BotState),
		generatedChunks: make(map[string]bool),
		chunkData:       make(map[string]*WorldChunk),
		pendingChunks:   make([]struct{ X, Y float64 }, 0),
		inputQueue:      make(map[string][]QueuedInput),
		currentTick:     0,
		zoneDamageAccum: make(map[string]float64),
		// Initialize spatial grids for fast collision detection
		buildingGrid: NewSpatialGrid(SPATIAL_GRID_CELL_SIZE),
		treeGrid:     NewSpatialGrid(SPATIAL_GRID_CELL_SIZE),
	}

	rand.Seed(42)

	gs.generateChunk(0, 0)
	gs.generateChunk(-CHUNK_SIZE, 0)
	gs.generateChunk(CHUNK_SIZE, 0)
	gs.generateChunk(0, -CHUNK_SIZE)
	gs.generateChunk(0, CHUNK_SIZE)

	rand.Seed(time.Now().UnixNano())

	for i := 0; i < 120; i++ {
		ammoID := fmt.Sprintf("ammo_%d", gs.nextAmmoID)
		gs.nextAmmoID++
		x, y := gs.findValidPickupPosition(10, true)
		ammoPickup := &AmmoPickup{
			ID:     ammoID,
			X:      x,
			Y:      y,
			Amount: 75,
			Active: true,
		}
		gs.gameState.AmmoPickups[ammoID] = ammoPickup
	}

	weapons := []string{"pistol", "rifle", "machinegun", "shotgun"}
	for i := 0; i < 75; i++ {
		weaponID := fmt.Sprintf("weapon_%d", gs.nextAmmoID)
		gs.nextAmmoID++
		x, y := gs.findValidPickupPosition(10, true)
		weaponPickup := &WeaponPickup{
			ID:     weaponID,
			X:      x,
			Y:      y,
			Weapon: weapons[rand.Intn(len(weapons))],
			Active: true,
		}
		gs.gameState.WeaponPickups[weaponID] = weaponPickup
	}

	for i := 0; i < 40; i++ {
		healthID := fmt.Sprintf("health_%d", gs.nextHealthID)
		gs.nextHealthID++
		x, y := gs.findValidPickupPosition(12, true)
		healthPickup := &HealthPickup{
			ID:     healthID,
			X:      x,
			Y:      y,
			Amount: 75,
			Active: true,
		}
		gs.gameState.HealthPickups[healthID] = healthPickup
	}

	for i := 0; i < 5; i++ {
		enemyID := fmt.Sprintf("enemy_%d", i+1)
		enemy := &Player{
			ID:        enemyID,
			Angle:     0,
			Health:    1000,
			Alive:     true,
			Velocity:  16.67,
			Ammo:      100,
			Weapon:    "pistol",
			Score:     0,
			Kills:     0,
			LastShoot: 0,
		}

		var ok bool
		enemy.X, enemy.Y, ok = gs.findValidPosition(0, 0, PLAYER_RADIUS, 100, true)
		if !ok {
			log.Printf("Warning: Could not find valid spawn position for bot %s", enemyID)
		}

		gs.gameState.Players[enemyID] = enemy
		gs.botStates[enemyID] = &BotState{
			TargetX:       enemy.X,
			TargetY:       enemy.Y,
			LastDirChange: 0,
			MoveAngle:     rand.Float64() * 2 * math.Pi,
		}
	}

	return gs
}

func (gs *GameServer) handleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := gs.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	sessionID := r.URL.Query().Get("session")
	var player *Player
	var playerID string

	if sessionID != "" {
		gs.sessionMu.RLock()
		savedPlayer, exists := gs.sessions[sessionID]
		gs.sessionMu.RUnlock()

		if exists && savedPlayer != nil {
			playerID = savedPlayer.ID
			player = &Player{
				ID:        savedPlayer.ID,
				X:         savedPlayer.X,
				Y:         savedPlayer.Y,
				Angle:     savedPlayer.Angle,
				Health:    savedPlayer.Health,
				Alive:     savedPlayer.Alive,
				Velocity:  savedPlayer.Velocity,
				Ammo:      savedPlayer.Ammo,
				Weapon:    savedPlayer.Weapon,
				Score:     savedPlayer.Score,
				Kills:     savedPlayer.Kills,
				LastShoot: 0,
			}
			log.Printf("Restoring session %s for player %s at (%.2f, %.2f) with %d ammo",
				sessionID, playerID, player.X, player.Y, player.Ammo)
		}
	}

	if player == nil {
		playerID = generatePlayerID()
		spawnX := (rand.Float64() - 0.5) * 200
		spawnY := (rand.Float64() - 0.5) * 200
		spawnX, spawnY, ok := gs.findValidPosition(spawnX, spawnY, PLAYER_RADIUS, 100, false)
		if !ok {
			log.Printf("Warning: Could not find valid spawn position for player %s", playerID)
		}

		player = &Player{
			ID:        playerID,
			X:         spawnX,
			Y:         spawnY,
			Angle:     0,
			Health:    1000,
			Alive:     true,
			Velocity:  100.0,
			Ammo:      100,
			Weapon:    "pistol",
			Score:     0,
			Kills:     0,
			LastShoot: 0,
		}

		if sessionID == "" {
			sessionID = fmt.Sprintf("session_%d", time.Now().UnixNano())
		}
	}

	gs.sessionMu.Lock()
	gs.sessions[sessionID] = player
	gs.sessionMu.Unlock()

	gs.mu.Lock()
	for existingConn, existingClient := range gs.clients {
		if existingClient.player != nil && existingClient.player.ID == playerID {
			log.Printf("Player %s already connected, closing old connection", playerID)
			delete(gs.clients, existingConn)
			delete(gs.gameState.Players, playerID)
			existingConn.Close()
		}
	}

	clientConn := &clientConn{
		conn:        conn,
		player:      player,
		knownChunks: make(map[string]bool),
		lastState:   nil,
	}

	gs.clients[conn] = clientConn
	gs.gameState.Players[playerID] = player
	gs.mu.Unlock()

	log.Printf("Player %s connected at (%.2f, %.2f)", playerID, player.X, player.Y)

	go func() {
		time.Sleep(10 * time.Millisecond)

		gs.sendChunksToClient(clientConn, player.X, player.Y)

		initDiff := gs.createStateDiff(clientConn)
		initDiff.Type = "init"

		initMsg := map[string]interface{}{
			"type":      "init",
			"playerId":  playerID,
			"sessionId": sessionID,
			"state":     initDiff,
		}

		finalState, err := json.Marshal(initMsg)
		if err == nil {
			clientConn.writeMu.Lock()
			err = conn.WriteMessage(websocket.TextMessage, finalState)
			clientConn.writeMu.Unlock()
			if err != nil {
				log.Printf("Error sending initial state: %v", err)
			} else {
				log.Printf("Sent initial state to player %s", playerID)
			}
		}
	}()

	go gs.handleClient(conn, player)
}

func (gs *GameServer) savePlayerState(playerID string, player *Player) {
	gs.sessionMu.Lock()
	defer gs.sessionMu.Unlock()

	for _, savedPlayer := range gs.sessions {
		if savedPlayer != nil && savedPlayer.ID == playerID {
			savedPlayer.X = player.X
			savedPlayer.Y = player.Y
			savedPlayer.Angle = player.Angle
			savedPlayer.Health = player.Health
			savedPlayer.Alive = player.Alive
			savedPlayer.Ammo = player.Ammo
			savedPlayer.Weapon = player.Weapon
			savedPlayer.Score = player.Score
			savedPlayer.Kills = player.Kills
			break
		}
	}
}

func (gs *GameServer) handleClient(conn *websocket.Conn, player *Player) {
	defer func() {
		gs.disconnectClient(conn, player.ID)
		conn.Close()
	}()

	conn.SetReadDeadline(time.Now().Add(60 * time.Second))

	for {
		var msg InputMessage
		err := conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error for player %s: %v", player.ID, err)
			}
			return
		}

		conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		if msg.Type == "ping" {
			gs.mu.RLock()
			clientConn, exists := gs.clients[conn]
			gs.mu.RUnlock()
			if exists {
				pongMsg := map[string]interface{}{
					"type": "pong",
					"time": msg.Time,
				}
				clientConn.writeMu.Lock()
				conn.WriteJSON(pongMsg)
				clientConn.writeMu.Unlock()
			}
			continue
		}

		gs.mu.Lock()
		gamePlayer := gs.gameState.Players[player.ID]
		if gamePlayer == nil {
			gs.mu.Unlock()
			continue
		}

		if msg.Type == "respawn" {
			gamePlayer.Health = 1000
			gamePlayer.Alive = true
			gamePlayer.Ammo = 100
			gamePlayer.Weapon = "pistol"
			var ok bool
			gamePlayer.X, gamePlayer.Y, ok = gs.findValidPosition(0, 0, PLAYER_RADIUS, 100, true)
			if !ok {
				log.Printf("Warning: Could not find valid respawn position for player %s", gamePlayer.ID)
			}
			gamePlayer.Angle = 0
			gs.savePlayerState(gamePlayer.ID, gamePlayer)
			log.Printf("Player %s respawned at (%.2f, %.2f)", gamePlayer.ID, gamePlayer.X, gamePlayer.Y)
			gs.mu.Unlock()
		} else if msg.Type == "input" {
			if msg.Shoot {
				gamePlayer.Angle = roundFloat(msg.Angle, 4)
				gs.createBullet(gamePlayer)
				gs.savePlayerState(gamePlayer.ID, gamePlayer)
				gs.mu.Unlock()
			} else {
				if msg.Angle != 0 {
					gamePlayer.Angle = roundFloat(msg.Angle, 4)
				}
				gs.mu.Unlock()

				if msg.MoveX != 0 || msg.MoveY != 0 {
					gs.inputQueueMu.Lock()
					gs.inputQueue[player.ID] = append(gs.inputQueue[player.ID], QueuedInput{
						PlayerID: player.ID,
						MoveX:    msg.MoveX,
						MoveY:    msg.MoveY,
						Angle:    msg.Angle,
						Tick:     gs.currentTick + 1,
						ClientX:  msg.ClientX,
						ClientY:  msg.ClientY,
					})
					gs.inputQueueMu.Unlock()
				}
			}
		} else {
			gs.mu.Unlock()
		}
	}
}

func (gs *GameServer) processQueuedInputs(tick int) {
	gs.inputQueueMu.Lock()
	defer gs.inputQueueMu.Unlock()

	for playerID, inputs := range gs.inputQueue {
		if len(inputs) == 0 {
			continue
		}

		gs.mu.Lock()
		player := gs.gameState.Players[playerID]
		if player == nil {
			gs.mu.Unlock()
			delete(gs.inputQueue, playerID)
			continue
		}

		processed := 0
		for _, input := range inputs {
			if input.Tick > tick {
				break
			}

			if !validateInput(input.MoveX, input.MoveY, input.Angle) {
				processed++
				continue
			}

			if input.MoveX != 0 || input.MoveY != 0 {
				len := math.Sqrt(input.MoveX*input.MoveX + input.MoveY*input.MoveY)
				if len > 1.0 {
					input.MoveX /= len
					input.MoveY /= len
				}
				input.MoveX = roundFloat(input.MoveX, 2)
				input.MoveY = roundFloat(input.MoveY, 2)

				deltaTime := 1.0 / TICK_RATE
				moveSpeed := player.Velocity * deltaTime

				serverX := player.X + input.MoveX*moveSpeed
				serverY := player.Y + input.MoveY*moveSpeed

				useClientPos := false
				dx := input.ClientX - serverX
				dy := input.ClientY - serverY
				dist := math.Sqrt(dx*dx + dy*dy)

				if dist <= CLIENT_POS_TOLERANCE {
					clientXValid := true
					clientYValid := true

					gs.ensureChunksAroundPlayer(input.ClientX, input.ClientY)

					nearbyBuildingsRaw := gs.buildingGrid.GetNearby(input.ClientX, input.ClientY, 100)
					for _, entity := range nearbyBuildingsRaw {
						building := entity.(Building)
						if input.ClientX+PLAYER_RADIUS >= building.X && input.ClientX-PLAYER_RADIUS <= building.X+building.Width &&
							input.ClientY+PLAYER_RADIUS >= building.Y && input.ClientY-PLAYER_RADIUS <= building.Y+building.Height {
							clientXValid = false
							clientYValid = false
							break
						}
					}

					if clientXValid && clientYValid {
						nearbyTreesRaw := gs.treeGrid.GetNearby(input.ClientX, input.ClientY, 50)
						for _, entity := range nearbyTreesRaw {
							tree := entity.(Tree)
							dx := input.ClientX - tree.X
							dy := input.ClientY - tree.Y
							dist := math.Sqrt(dx*dx + dy*dy)
							if dist < tree.Size+PLAYER_RADIUS {
								clientXValid = false
								clientYValid = false
								break
							}
						}
					}

					if clientXValid && clientYValid {
						useClientPos = true
					}
				}

				newX := serverX
				newY := serverY
				if useClientPos {
					newX = roundFloat(input.ClientX, 2)
					newY = roundFloat(input.ClientY, 2)
				}

				canMoveX := true
				canMoveY := true

				gs.ensureChunksAroundPlayer(newX, player.Y)

				testX := newX
				testY := player.Y
				nearbyBuildingsX := gs.buildingGrid.GetNearby(testX, testY, 100)
				for _, entity := range nearbyBuildingsX {
					building := entity.(Building)
					if testX+PLAYER_RADIUS >= building.X && testX-PLAYER_RADIUS <= building.X+building.Width &&
						testY+PLAYER_RADIUS >= building.Y && testY-PLAYER_RADIUS <= building.Y+building.Height {
						canMoveX = false
						break
					}
				}

				if canMoveX {
					nearbyTreesX := gs.treeGrid.GetNearby(testX, testY, 50)
					for _, entity := range nearbyTreesX {
						tree := entity.(Tree)
						dx := testX - tree.X
						dy := testY - tree.Y
						dist := math.Sqrt(dx*dx + dy*dy)
						if dist < tree.Size+PLAYER_RADIUS {
							canMoveX = false
							break
						}
					}
				}

				if canMoveX {
					player.X = roundFloat(newX, 2)
				}

				gs.ensureChunksAroundPlayer(player.X, newY)

				testX = player.X
				testY = newY
				nearbyBuildingsY := gs.buildingGrid.GetNearby(testX, testY, 100)
				for _, entity := range nearbyBuildingsY {
					building := entity.(Building)
					if testX+PLAYER_RADIUS >= building.X && testX-PLAYER_RADIUS <= building.X+building.Width &&
						testY+PLAYER_RADIUS >= building.Y && testY-PLAYER_RADIUS <= building.Y+building.Height {
						canMoveY = false
						break
					}
				}

				if canMoveY {
					nearbyTreesY := gs.treeGrid.GetNearby(testX, testY, 50)
					for _, entity := range nearbyTreesY {
						tree := entity.(Tree)
						dx := testX - tree.X
						dy := testY - tree.Y
						dist := math.Sqrt(dx*dx + dy*dy)
						if dist < tree.Size+PLAYER_RADIUS {
							canMoveY = false
							break
						}
					}
				}

				if canMoveY {
					player.Y = roundFloat(newY, 2)
				}
			}

			if input.Angle != 0 {
				player.Angle = roundFloat(input.Angle, 4)
			}

			processed++
		}

		if processed > 0 {
			gs.inputQueue[playerID] = gs.inputQueue[playerID][processed:]
			gs.savePlayerState(playerID, player)
		}

		gs.mu.Unlock()
	}

	oldInputs := 0
	for playerID, inputs := range gs.inputQueue {
		if len(inputs) > 0 && inputs[0].Tick < tick-10 {
			oldInputs += len(inputs)
			delete(gs.inputQueue, playerID)
		}
	}
	if oldInputs > 0 {
		log.Printf("[INPUT QUEUE] Cleaned up %d old inputs", oldInputs)
	}
}

func (gs *GameServer) disconnectClient(conn *websocket.Conn, playerID string) {
	gs.mu.Lock()
	_, exists := gs.clients[conn]
	if !exists {
		gs.mu.Unlock()
		return
	}
	delete(gs.clients, conn)

	hasOtherConnection := false
	for otherConn, otherClient := range gs.clients {
		if otherConn != conn && otherClient.player != nil && otherClient.player.ID == playerID {
			hasOtherConnection = true
			break
		}
	}

	if !hasOtherConnection {
		delete(gs.gameState.Players, playerID)
	}
	gs.mu.Unlock()

	gs.inputQueueMu.Lock()
	if !hasOtherConnection {
		delete(gs.inputQueue, playerID)
	}
	gs.inputQueueMu.Unlock()

	log.Printf("Player %s disconnected", playerID)
}

func (gs *GameServer) updateGame(tick int) {
	gs.currentTick = tick
	gs.processQueuedInputs(tick)

	gs.mu.Lock()

	gs.processPendingChunks(3)

	gs.gameState.GameTime = tick

	for _, bullet := range gs.gameState.Bullets {
		if !bullet.Active {
			continue
		}

		bullet.X = roundFloat(bullet.X+math.Cos(bullet.Angle)*bullet.Speed, 2)
		bullet.Y = roundFloat(bullet.Y+math.Sin(bullet.Angle)*bullet.Speed, 2)

		if math.Abs(bullet.X) > 10000 || math.Abs(bullet.Y) > 10000 {
			bullet.Active = false
			continue
		}

		hitObstacle := false
		nearbyBuildings := gs.buildingGrid.GetNearby(bullet.X, bullet.Y, 100)
		for _, entity := range nearbyBuildings {
			building, ok := entity.(Building)
			if !ok {
				continue
			}
			if bullet.X >= building.X && bullet.X <= building.X+building.Width &&
				bullet.Y >= building.Y && bullet.Y <= building.Y+building.Height {
				bullet.Active = false
				hitObstacle = true
				break
			}
		}

		if !hitObstacle {
			nearbyTrees := gs.treeGrid.GetNearby(bullet.X, bullet.Y, 50)
			for _, entity := range nearbyTrees {
				tree, ok := entity.(Tree)
				if !ok {
					continue
				}
				dx := bullet.X - tree.X
				dy := bullet.Y - tree.Y
				dist := math.Sqrt(dx*dx + dy*dy)
				if dist < tree.Size {
					bullet.Active = false
					hitObstacle = true
					break
				}
			}
		}

		if hitObstacle {
			continue
		}

		for _, player := range gs.gameState.Players {
			if player.ID == bullet.PlayerID || !player.Alive {
				continue
			}

			dx := bullet.X - player.X
			dy := bullet.Y - player.Y
			dist := math.Sqrt(dx*dx + dy*dy)
			if dist < BULLET_HIT_RADIUS {
				player.Health -= 25
				bullet.Active = false
				if player.Health <= 0 {
					player.Health = 0
					player.Alive = false

					if bullet.PlayerID != "" {
						killer := gs.gameState.Players[bullet.PlayerID]
						if killer != nil {
							killer.Kills++
							killer.Score += 100
						}
					}
				}
				break
			}
		}
	}

	activeBullets := make(map[string]*Bullet)
	for id, bullet := range gs.gameState.Bullets {
		if bullet.Active {
			activeBullets[id] = bullet
		}
	}
	gs.gameState.Bullets = activeBullets

	for _, player := range gs.gameState.Players {
		if !player.Alive {
			continue
		}
		for _, ammo := range gs.gameState.AmmoPickups {
			if !ammo.Active {
				continue
			}
			dx := player.X - ammo.X
			dy := player.Y - ammo.Y
			dist := math.Sqrt(dx*dx + dy*dy)
			if dist < PICKUP_RADIUS {
				oldAmmo := player.Ammo
				player.Ammo += ammo.Amount
				player.Score += 10
				ammo.Active = false
				log.Printf("[PICKUP] Player %s collected ammo at (%.2f, %.2f), ammo: %d -> %d", player.ID, ammo.X, ammo.Y, oldAmmo, player.Ammo)
			}
		}

		for _, weapon := range gs.gameState.WeaponPickups {
			if !weapon.Active {
				continue
			}
			dx := player.X - weapon.X
			dy := player.Y - weapon.Y
			dist := math.Sqrt(dx*dx + dy*dy)
			if dist < PICKUP_RADIUS {
				oldWeapon := player.Weapon
				oldAmmo := player.Ammo
				player.Weapon = weapon.Weapon
				weaponObj := GetWeapon(weapon.Weapon)
				player.Ammo += weaponObj.GetInitialAmmo()
				player.Score += 5
				weapon.Active = false
				log.Printf("[PICKUP] Player %s collected weapon %s at (%.2f, %.2f), weapon: %s -> %s, ammo: %d -> %d", player.ID, weapon.Weapon, weapon.X, weapon.Y, oldWeapon, player.Weapon, oldAmmo, player.Ammo)
			}
		}

		for _, health := range gs.gameState.HealthPickups {
			if !health.Active {
				continue
			}
			dx := player.X - health.X
			dy := player.Y - health.Y
			dist := math.Sqrt(dx*dx + dy*dy)
			if dist < PICKUP_RADIUS {
				oldHealth := player.Health
				player.Health += health.Amount
				player.Score += 10
				health.Active = false
				log.Printf("[PICKUP] Player %s collected health at (%.2f, %.2f), health: %d -> %d", player.ID, health.X, health.Y, oldHealth, player.Health)
			}
		}
	}

	activeAmmo := make(map[string]*AmmoPickup)
	for id, ammo := range gs.gameState.AmmoPickups {
		if ammo.Active {
			activeAmmo[id] = ammo
		}
	}
	gs.gameState.AmmoPickups = activeAmmo

	activeWeapons := make(map[string]*WeaponPickup)
	for id, weapon := range gs.gameState.WeaponPickups {
		if weapon.Active {
			activeWeapons[id] = weapon
		}
	}
	gs.gameState.WeaponPickups = activeWeapons

	activeHealth := make(map[string]*HealthPickup)
	for id, health := range gs.gameState.HealthPickups {
		if health.Active {
			activeHealth[id] = health
		}
	}
	gs.gameState.HealthPickups = activeHealth

	if len(gs.gameState.AmmoPickups) < 60 {
		for i := len(gs.gameState.AmmoPickups); i < 60; i++ {
			ammoID := fmt.Sprintf("ammo_%d", gs.nextAmmoID)
			gs.nextAmmoID++
			x, y := gs.findValidPickupPosition(10, true)
			ammoPickup := &AmmoPickup{
				ID:     ammoID,
				X:      x,
				Y:      y,
				Amount: 75,
				Active: true,
			}
			gs.gameState.AmmoPickups[ammoID] = ammoPickup
		}
	}

	if len(gs.gameState.WeaponPickups) < 45 {
		weapons := []string{"pistol", "rifle", "machinegun", "shotgun"}
		for i := len(gs.gameState.WeaponPickups); i < 45; i++ {
			weaponID := fmt.Sprintf("weapon_%d", gs.nextAmmoID)
			gs.nextAmmoID++
			x, y := gs.findValidPickupPosition(10, true)
			weaponPickup := &WeaponPickup{
				ID:     weaponID,
				X:      x,
				Y:      y,
				Weapon: weapons[rand.Intn(len(weapons))],
				Active: true,
			}
			gs.gameState.WeaponPickups[weaponID] = weaponPickup
		}
	}

	if len(gs.gameState.HealthPickups) < 25 {
		for i := len(gs.gameState.HealthPickups); i < 25; i++ {
			healthID := fmt.Sprintf("health_%d", gs.nextHealthID)
			gs.nextHealthID++
			x, y := gs.findValidPickupPosition(12, true)
			healthPickup := &HealthPickup{
				ID:     healthID,
				X:      x,
				Y:      y,
				Amount: 75,
				Active: true,
			}
			gs.gameState.HealthPickups[healthID] = healthPickup
		}
	}

	if tick%ZONE_RESET_INTERVAL == 0 {
		if gs.gameState.ZoneRadius > 200 {
			gs.gameState.ZoneRadius -= ZONE_SHRINK_RATE * 10
		} else if gs.gameState.ZoneRadius <= 200 {
			gs.gameState.ZoneRadius = ZONE_INITIAL_SIZE
			avgX := 0.0
			avgY := 0.0
			count := 0
			for _, p := range gs.gameState.Players {
				if p.Alive && !strings.HasPrefix(p.ID, "enemy_") {
					avgX += p.X
					avgY += p.Y
					count++
				}
			}
			if count > 0 {
				avgX /= float64(count)
				avgY /= float64(count)
				gs.gameState.ZoneCenter = (avgX + avgY) / 2
			} else {
				gs.gameState.ZoneCenter = 0
			}

			for i := 0; i < 5; i++ {
				enemyID := fmt.Sprintf("enemy_%d", i+1)
				enemy := gs.gameState.Players[enemyID]

				if enemy == nil {
					enemy = &Player{
						ID:        enemyID,
						Angle:     0,
						Health:    1000,
						Alive:     true,
						Velocity:  16.67,
						Ammo:      100,
						Weapon:    "pistol",
						Score:     0,
						Kills:     0,
						LastShoot: 0,
					}
					gs.gameState.Players[enemyID] = enemy
				}

				enemy.Health = 1000
				enemy.Alive = true
				enemy.Ammo = 100
				enemy.Weapon = "pistol"
				enemy.Score = 0
				enemy.Kills = 0

				var ok bool
				enemy.X, enemy.Y, ok = gs.findValidPosition(0, 0, PLAYER_RADIUS, 100, true)
				if !ok {
					log.Printf("Warning: Could not find valid spawn position for bot %s on game reset", enemyID)
				}
				enemy.Angle = 0
				gs.botStates[enemyID] = &BotState{
					TargetX:       enemy.X,
					TargetY:       enemy.Y,
					LastDirChange: 0,
					MoveAngle:     rand.Float64() * 2 * math.Pi,
				}
			}

			for _, ammo := range gs.gameState.AmmoPickups {
				if !ammo.Active {
					ammo.Active = true
					x, y := gs.findValidPickupPosition(10, true)
					ammo.X = x
					ammo.Y = y
				}
			}

			for _, weapon := range gs.gameState.WeaponPickups {
				if !weapon.Active {
					weapon.Active = true
					x, y := gs.findValidPickupPosition(10, true)
					weapon.X = x
					weapon.Y = y
				}
			}

			for _, health := range gs.gameState.HealthPickups {
				if !health.Active {
					health.Active = true
					x, y := gs.findValidPickupPosition(12, true)
					health.X = x
					health.Y = y
				}
			}
		}
	}

	gs.updateBots(tick)

	aliveCount := 0
	zoneDamagePerTick := calculateZoneDamagePerTick(gs.gameState.ZoneRadius)

	for _, player := range gs.gameState.Players {
		if player.Alive {
			aliveCount++
			dx := player.X - gs.gameState.ZoneCenter
			dy := player.Y - gs.gameState.ZoneCenter
			distFromZone := math.Sqrt(dx*dx + dy*dy)
			if distFromZone > gs.gameState.ZoneRadius {
				gs.zoneDamageAccumMu.Lock()
				gs.zoneDamageAccum[player.ID] += zoneDamagePerTick
				accumulatedDamage := gs.zoneDamageAccum[player.ID]
				if accumulatedDamage >= 1.0 {
					damageToApply := int(accumulatedDamage)
					player.Health -= damageToApply
					gs.zoneDamageAccum[player.ID] = accumulatedDamage - float64(damageToApply)
				}
				gs.zoneDamageAccumMu.Unlock()

				if player.Health <= 0 {
					player.Health = 0
					player.Alive = false
					gs.zoneDamageAccumMu.Lock()
					delete(gs.zoneDamageAccum, player.ID)
					gs.zoneDamageAccumMu.Unlock()
				}
			} else {
				gs.zoneDamageAccumMu.Lock()
				delete(gs.zoneDamageAccum, player.ID)
				gs.zoneDamageAccumMu.Unlock()
			}
		}
	}

	if aliveCount <= 1 && gs.gameState.Phase == "playing" {
		gs.gameState.Phase = "finished"
		for _, p := range gs.gameState.Players {
			if p.Alive {
				gs.gameState.Winner = p.ID
				break
			}
		}
	}

	playersToSave := make([]*Player, 0)
	for _, player := range gs.gameState.Players {
		if player != nil {
			playersToSave = append(playersToSave, player)
		}
	}

	gs.mu.Unlock()

	for _, player := range playersToSave {
		gs.savePlayerState(player.ID, player)
	}
}

func (gs *GameServer) createDynamicState() *DynamicState {
	gs.mu.RLock()
	defer gs.mu.RUnlock()

	viewportRadius := 2000.0

	playerPositions := make([]struct{ X, Y float64 }, 0, len(gs.gameState.Players))
	for _, player := range gs.gameState.Players {
		if player.Alive {
			playerPositions = append(playerPositions, struct{ X, Y float64 }{player.X, player.Y})
		}
	}

	buildings := make([]Building, 0)
	trees := make([]Tree, 0)

	if len(playerPositions) > 0 {
		viewportRadiusSq := viewportRadius * viewportRadius
		for _, building := range gs.gameState.Buildings {
			buildingCenterX := building.X + building.Width/2
			buildingCenterY := building.Y + building.Height/2
			for _, pos := range playerPositions {
				dx := buildingCenterX - pos.X
				dy := buildingCenterY - pos.Y
				if dx*dx+dy*dy <= viewportRadiusSq {
					buildings = append(buildings, building)
					break
				}
			}
		}

		for _, tree := range gs.gameState.Trees {
			for _, pos := range playerPositions {
				dx := tree.X - pos.X
				dy := tree.Y - pos.Y
				if dx*dx+dy*dy <= viewportRadiusSq {
					trees = append(trees, tree)
					break
				}
			}
		}
	} else {
		buildings = make([]Building, len(gs.gameState.Buildings))
		copy(buildings, gs.gameState.Buildings)
		trees = make([]Tree, len(gs.gameState.Trees))
		copy(trees, gs.gameState.Trees)
	}

	dynamic := &DynamicState{
		Players:       make(map[string]*Player),
		Bullets:       make(map[string]*Bullet),
		AmmoPickups:   make(map[string]*AmmoPickup),
		WeaponPickups: make(map[string]*WeaponPickup),
		HealthPickups: make(map[string]*HealthPickup),
		Buildings:     buildings,
		Trees:         trees,
		ZoneCenter:    gs.gameState.ZoneCenter,
		ZoneRadius:    gs.gameState.ZoneRadius,
		GameTime:      gs.gameState.GameTime,
		Phase:         gs.gameState.Phase,
		Winner:        gs.gameState.Winner,
	}

	for id, player := range gs.gameState.Players {
		dynamic.Players[id] = &Player{
			ID:       player.ID,
			X:        player.X,
			Y:        player.Y,
			Angle:    player.Angle,
			Health:   player.Health,
			Alive:    player.Alive,
			Velocity: player.Velocity,
			Ammo:     player.Ammo,
			Weapon:   player.Weapon,
			Score:    player.Score,
			Kills:    player.Kills,
		}
	}

	for id, bullet := range gs.gameState.Bullets {
		if bullet.Active {
			dynamic.Bullets[id] = &Bullet{
				ID:       bullet.ID,
				PlayerID: bullet.PlayerID,
				X:        bullet.X,
				Y:        bullet.Y,
				Angle:    bullet.Angle,
				Speed:    bullet.Speed,
				Active:   bullet.Active,
				Weapon:   bullet.Weapon,
			}
		}
	}

	for id, ammo := range gs.gameState.AmmoPickups {
		if ammo.Active {
			dynamic.AmmoPickups[id] = &AmmoPickup{
				ID:     ammo.ID,
				X:      ammo.X,
				Y:      ammo.Y,
				Amount: ammo.Amount,
				Active: ammo.Active,
			}
		}
	}

	for id, weapon := range gs.gameState.WeaponPickups {
		if weapon.Active {
			dynamic.WeaponPickups[id] = &WeaponPickup{
				ID:     weapon.ID,
				X:      weapon.X,
				Y:      weapon.Y,
				Weapon: weapon.Weapon,
				Active: weapon.Active,
			}
		}
	}

	for id, health := range gs.gameState.HealthPickups {
		if health.Active {
			dynamic.HealthPickups[id] = &HealthPickup{
				ID:     health.ID,
				X:      health.X,
				Y:      health.Y,
				Amount: health.Amount,
				Active: health.Active,
			}
		}
	}

	return dynamic
}

func (gs *GameServer) sendChunksToClient(client *clientConn, playerX, playerY float64) {
	chunkRadius := 2
	centerChunkX := int(math.Floor(playerX / CHUNK_SIZE))
	centerChunkY := int(math.Floor(playerY / CHUNK_SIZE))

	chunksToSend := make([]*WorldChunk, 0)

	gs.chunkDataMu.RLock()
	client.writeMu.Lock()
	for dx := -chunkRadius; dx <= chunkRadius; dx++ {
		for dy := -chunkRadius; dy <= chunkRadius; dy++ {
			chunkX := centerChunkX + dx
			chunkY := centerChunkY + dy
			chunkKey := fmt.Sprintf("%d,%d", chunkX, chunkY)

			if !client.knownChunks[chunkKey] {
				if chunk, exists := gs.chunkData[chunkKey]; exists {
					chunksToSend = append(chunksToSend, chunk)
					client.knownChunks[chunkKey] = true
				}
			}
		}
	}
	client.writeMu.Unlock()
	gs.chunkDataMu.RUnlock()

	if len(chunksToSend) > 0 {
		chunkMsg := map[string]interface{}{
			"type":   "worldChunks",
			"chunks": chunksToSend,
		}

		client.writeMu.Lock()
		jsonData, _ := json.Marshal(chunkMsg)
		client.conn.WriteMessage(websocket.TextMessage, jsonData)
		client.writeMu.Unlock()
	}
}

func (gs *GameServer) createStateDiff(client *clientConn) *StateDiff {
	currentState := gs.createDynamicState()
	return gs.createStateDiffFromState(client, currentState)
}

func (gs *GameServer) createStateDiffFromState(client *clientConn, currentState *DynamicState) *StateDiff {
	diff := &StateDiff{
		Type: "stateDiff",
		Tick: gs.currentTick,
	}

	gs.mu.RLock()
	clientPlayer := gs.gameState.Players[client.player.ID]
	gs.mu.RUnlock()

	clientX := 0.0
	clientY := 0.0
	if clientPlayer != nil {
		clientX = clientPlayer.X
		clientY = clientPlayer.Y
	}

	client.lastStateMu.RLock()
	lastState := client.lastState
	client.lastStateMu.RUnlock()

	if lastState == nil {
		diff.Players = make(map[string]*Player)
		for id, player := range currentState.Players {
			if id == client.player.ID {
				diff.Players[id] = player
			} else {
				dx := player.X - clientX
				dy := player.Y - clientY
				distSq := dx*dx + dy*dy
				if distSq <= PLAYER_UPDATE_DISTANCE_SQ {
					diff.Players[id] = player
				}
			}
		}

		diff.Bullets = make(map[string]*Bullet)
		for id, bullet := range currentState.Bullets {
			dx := bullet.X - clientX
			dy := bullet.Y - clientY
			distSq := dx*dx + dy*dy
			if distSq <= AOI_RADIUS_SQ {
				diff.Bullets[id] = bullet
			}
		}

		diff.AmmoPickups = make(map[string]*AmmoPickup)
		for id, ammo := range currentState.AmmoPickups {
			dx := ammo.X - clientX
			dy := ammo.Y - clientY
			distSq := dx*dx + dy*dy
			if distSq <= AOI_RADIUS_SQ {
				diff.AmmoPickups[id] = ammo
			}
		}

		diff.WeaponPickups = make(map[string]*WeaponPickup)
		for id, weapon := range currentState.WeaponPickups {
			dx := weapon.X - clientX
			dy := weapon.Y - clientY
			distSq := dx*dx + dy*dy
			if distSq <= AOI_RADIUS_SQ {
				diff.WeaponPickups[id] = weapon
			}
		}

		diff.HealthPickups = make(map[string]*HealthPickup)
		for id, health := range currentState.HealthPickups {
			dx := health.X - clientX
			dy := health.Y - clientY
			distSq := dx*dx + dy*dy
			if distSq <= AOI_RADIUS_SQ {
				diff.HealthPickups[id] = health
			}
		}

		diff.ZoneCenter = currentState.ZoneCenter
		diff.ZoneRadius = currentState.ZoneRadius
		diff.GameTime = currentState.GameTime
		diff.Phase = currentState.Phase
		diff.Winner = currentState.Winner
	} else {
		diff.Players = make(map[string]*Player)
		for id, player := range currentState.Players {
			if id == client.player.ID {
				lastPlayer := lastState.Players[id]
				if lastPlayer == nil || !floatsEqual(player.X, lastPlayer.X, COORD_EPSILON) || !floatsEqual(player.Y, lastPlayer.Y, COORD_EPSILON) ||
					!floatsEqual(player.Angle, lastPlayer.Angle, ANGLE_EPSILON) || player.Health != lastPlayer.Health ||
					player.Ammo != lastPlayer.Ammo || player.Weapon != lastPlayer.Weapon ||
					player.Alive != lastPlayer.Alive || player.Score != lastPlayer.Score ||
					player.Kills != lastPlayer.Kills {
					diff.Players[id] = player
				}
			} else {
				dx := player.X - clientX
				dy := player.Y - clientY
				distSq := dx*dx + dy*dy
				if distSq <= PLAYER_UPDATE_DISTANCE_SQ {
					lastPlayer := lastState.Players[id]
					if lastPlayer == nil || !floatsEqual(player.X, lastPlayer.X, COORD_EPSILON) || !floatsEqual(player.Y, lastPlayer.Y, COORD_EPSILON) ||
						!floatsEqual(player.Angle, lastPlayer.Angle, ANGLE_EPSILON) || player.Health != lastPlayer.Health ||
						player.Ammo != lastPlayer.Ammo || player.Weapon != lastPlayer.Weapon ||
						player.Alive != lastPlayer.Alive || player.Score != lastPlayer.Score ||
						player.Kills != lastPlayer.Kills {
						diff.Players[id] = player
					}
				}
			}
		}

		diff.RemovedPlayers = make([]string, 0)
		for id := range lastState.Players {
			if currentState.Players[id] == nil {
				diff.RemovedPlayers = append(diff.RemovedPlayers, id)
			}
		}

		diff.Bullets = make(map[string]*Bullet)
		for id, bullet := range currentState.Bullets {
			dx := bullet.X - clientX
			dy := bullet.Y - clientY
			distSq := dx*dx + dy*dy
			if distSq <= AOI_RADIUS_SQ {
				lastBullet := lastState.Bullets[id]
				if lastBullet == nil || !floatsEqual(bullet.X, lastBullet.X, COORD_EPSILON) || !floatsEqual(bullet.Y, lastBullet.Y, COORD_EPSILON) ||
					!floatsEqual(bullet.Angle, lastBullet.Angle, ANGLE_EPSILON) || bullet.Active != lastBullet.Active {
					diff.Bullets[id] = bullet
				}
			}
		}

		diff.RemovedBullets = make([]string, 0)
		for id := range lastState.Bullets {
			if currentState.Bullets[id] == nil || !currentState.Bullets[id].Active {
				dx := 0.0
				dy := 0.0
				if lastBullet, exists := lastState.Bullets[id]; exists {
					dx = lastBullet.X - clientX
					dy = lastBullet.Y - clientY
				}
				distSq := dx*dx + dy*dy
				if distSq <= AOI_RADIUS_SQ {
					diff.RemovedBullets = append(diff.RemovedBullets, id)
				}
			}
		}

		diff.AmmoPickups = make(map[string]*AmmoPickup)
		for id, ammo := range currentState.AmmoPickups {
			dx := ammo.X - clientX
			dy := ammo.Y - clientY
			distSq := dx*dx + dy*dy
			if distSq <= AOI_RADIUS_SQ {
				lastAmmo := lastState.AmmoPickups[id]
				if lastAmmo == nil || ammo.Active != lastAmmo.Active {
					diff.AmmoPickups[id] = ammo
				}
			}
		}

		diff.RemovedAmmo = make([]string, 0)
		for id := range lastState.AmmoPickups {
			if currentState.AmmoPickups[id] == nil || !currentState.AmmoPickups[id].Active {
				dx := 0.0
				dy := 0.0
				if lastAmmo, exists := lastState.AmmoPickups[id]; exists {
					dx = lastAmmo.X - clientX
					dy = lastAmmo.Y - clientY
				}
				distSq := dx*dx + dy*dy
				if distSq <= AOI_RADIUS_SQ {
					diff.RemovedAmmo = append(diff.RemovedAmmo, id)
				}
			}
		}

		diff.WeaponPickups = make(map[string]*WeaponPickup)
		for id, weapon := range currentState.WeaponPickups {
			dx := weapon.X - clientX
			dy := weapon.Y - clientY
			distSq := dx*dx + dy*dy
			if distSq <= AOI_RADIUS_SQ {
				lastWeapon := lastState.WeaponPickups[id]
				if lastWeapon == nil || weapon.Active != lastWeapon.Active {
					diff.WeaponPickups[id] = weapon
				}
			}
		}

		diff.RemovedWeapons = make([]string, 0)
		for id := range lastState.WeaponPickups {
			if currentState.WeaponPickups[id] == nil || !currentState.WeaponPickups[id].Active {
				dx := 0.0
				dy := 0.0
				if lastWeapon, exists := lastState.WeaponPickups[id]; exists {
					dx = lastWeapon.X - clientX
					dy = lastWeapon.Y - clientY
				}
				distSq := dx*dx + dy*dy
				if distSq <= AOI_RADIUS_SQ {
					diff.RemovedWeapons = append(diff.RemovedWeapons, id)
				}
			}
		}

		diff.HealthPickups = make(map[string]*HealthPickup)
		for id, health := range currentState.HealthPickups {
			dx := health.X - clientX
			dy := health.Y - clientY
			distSq := dx*dx + dy*dy
			if distSq <= AOI_RADIUS_SQ {
				lastHealth := lastState.HealthPickups[id]
				if lastHealth == nil || health.Active != lastHealth.Active {
					diff.HealthPickups[id] = health
				}
			}
		}

		diff.RemovedHealth = make([]string, 0)
		for id := range lastState.HealthPickups {
			if currentState.HealthPickups[id] == nil || !currentState.HealthPickups[id].Active {
				dx := 0.0
				dy := 0.0
				if lastHealth, exists := lastState.HealthPickups[id]; exists {
					dx = lastHealth.X - clientX
					dy = lastHealth.Y - clientY
				}
				distSq := dx*dx + dy*dy
				if distSq <= AOI_RADIUS_SQ {
					diff.RemovedHealth = append(diff.RemovedHealth, id)
				}
			}
		}

		if !floatsEqual(currentState.ZoneCenter, lastState.ZoneCenter, COORD_EPSILON) {
			diff.ZoneCenter = currentState.ZoneCenter
		}
		if !floatsEqual(currentState.ZoneRadius, lastState.ZoneRadius, COORD_EPSILON) {
			diff.ZoneRadius = currentState.ZoneRadius
		}
		if currentState.GameTime != lastState.GameTime {
			diff.GameTime = currentState.GameTime
		}
		if currentState.Phase != lastState.Phase {
			diff.Phase = currentState.Phase
		}
		if currentState.Winner != lastState.Winner {
			diff.Winner = currentState.Winner
		}
	}

	client.lastStateMu.Lock()
	client.lastState = currentState
	client.lastStateMu.Unlock()

	return diff
}

func (gs *GameServer) broadcastState() {
	gs.mu.RLock()
	clientsCopy := make([]*clientConn, 0, len(gs.clients))
	for _, client := range gs.clients {
		clientsCopy = append(clientsCopy, client)
	}
	gs.mu.RUnlock()

	if len(clientsCopy) == 0 {
		return
	}

	currentState := gs.createDynamicState()

	for _, client := range clientsCopy {
		go func(c *clientConn) {
			gs.mu.RLock()
			player := gs.gameState.Players[c.player.ID]
			gs.mu.RUnlock()

			if player == nil {
				return
			}

			gs.sendChunksToClient(c, player.X, player.Y)

			diff := gs.createStateDiffFromState(c, currentState)

			diffJSON, err := json.Marshal(diff)
			if err != nil {
				log.Println("Marshal error:", err)
				return
			}

			c.writeMu.Lock()
			err = c.conn.WriteMessage(websocket.TextMessage, diffJSON)
			c.writeMu.Unlock()
			if err != nil {
				log.Println("Write error:", err)
			}
		}(client)
	}
}

func (gs *GameServer) startGameLoop() {
	ticker := time.NewTicker(time.Second / TICK_RATE)
	broadcastTicker := time.NewTicker(time.Second / BROADCAST_RATE)
	defer ticker.Stop()
	defer broadcastTicker.Stop()

	tick := 0
	for {
		select {
		case <-ticker.C:
			if gs.gameState.Phase == "lobby" && len(gs.gameState.Players) > 0 {
				gs.gameState.Phase = "playing"
			}
			gs.updateGame(tick)
			tick++
		case <-broadcastTicker.C:
			gs.broadcastState()
		}
	}
}

func generatePlayerID() string {
	return fmt.Sprintf("player_%d", time.Now().UnixNano())
}

func main() {
	rand.Seed(time.Now().UnixNano())

	server := NewGameServer()

	go server.startGameLoop()

	http.HandleFunc("/ws", server.handleConnection)

	clientDir := "./client/dist"
	if _, err := os.Stat(clientDir); os.IsNotExist(err) {
		clientDir = "../client/dist"
		if _, err := os.Stat(clientDir); os.IsNotExist(err) {
			clientDir = "./client"
			if _, err := os.Stat(clientDir); os.IsNotExist(err) {
				clientDir = "../client"
			}
		}
	}

	fileServer := http.FileServer(http.Dir(clientDir))
	disableCache := func(w http.ResponseWriter) {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
	}
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		disableCache(w)
		if r.URL.Path == "/" || r.URL.Path == "/index.html" {
			http.ServeFile(w, r, clientDir+"/index.html")
			return
		}
		fileServer.ServeHTTP(w, r)
	})

	port := 12345
	if portEnv := os.Getenv("PORT"); portEnv != "" {
		if p, err := strconv.Atoi(portEnv); err == nil {
			port = p
		}
	}
	addr := fmt.Sprintf(":%d", port)
	log.Printf("Starting server on port %d", port)
	log.Printf("Access the game at: http://localhost:%d", port)
	log.Fatal(http.ListenAndServe(addr, nil))
}
