package main

import (
	"math"
	"math/rand"
	"strings"
	"time"
)

func (gs *GameServer) updateBots(tick int) {
	for enemyID, enemy := range gs.gameState.Players {
		if !strings.HasPrefix(enemyID, "enemy_") || !enemy.Alive {
			continue
		}

		botState := gs.botStates[enemyID]
		if botState == nil {
			botState = &BotState{
				TargetX:       enemy.X,
				TargetY:       enemy.Y,
				LastDirChange: 0,
				MoveAngle:     rand.Float64() * 2 * math.Pi,
			}
			gs.botStates[enemyID] = botState
		}

		const detectionRange = 400.0
		var targetPlayer *Player
		var minDist float64 = detectionRange
		var targetAmmo *AmmoPickup
		var minAmmoDist float64 = 600.0

		if enemy.Ammo <= 10 {
			for _, ammo := range gs.gameState.AmmoPickups {
				if !ammo.Active {
					continue
				}
				dx := ammo.X - enemy.X
				dy := ammo.Y - enemy.Y
				dist := math.Sqrt(dx*dx + dy*dy)
				if dist < minAmmoDist {
					minAmmoDist = dist
					targetAmmo = ammo
				}
			}
		}

		if targetAmmo == nil {
			for _, player := range gs.gameState.Players {
				if player.ID == enemyID || !player.Alive || strings.HasPrefix(player.ID, "enemy_") {
					continue
				}
				dx := player.X - enemy.X
				dy := player.Y - enemy.Y
				dist := math.Sqrt(dx*dx + dy*dy)
				if dist < minDist {
					minDist = dist
					targetPlayer = player
				}
			}
		}

		var moveX, moveY float64
		var targetAngle float64

		if targetAmmo != nil {
			dx := targetAmmo.X - enemy.X
			dy := targetAmmo.Y - enemy.Y
			dist := math.Sqrt(dx*dx + dy*dy)
			if dist > 0 {
				moveX = dx / dist
				moveY = dy / dist
				targetAngle = math.Atan2(dy, dx)
			}
			enemy.Angle = roundFloat(targetAngle, 4)
		} else if targetPlayer != nil {
			dx := targetPlayer.X - enemy.X
			dy := targetPlayer.Y - enemy.Y
			dist := math.Sqrt(dx*dx + dy*dy)
			if dist > 0 {
				moveX = dx / dist
				moveY = dy / dist
				targetAngle = math.Atan2(dy, dx)
			}

			enemy.Angle = roundFloat(targetAngle, 4)

			if dist < 300 && enemy.Ammo > 0 {
				now := time.Now().UnixMilli()
				weapon := GetWeapon(enemy.Weapon)
				if now-enemy.LastShoot >= weapon.GetCooldown() {
					gs.createBullet(enemy)
				}
			}
		} else {
			if tick-botState.LastDirChange > 60 {
				botState.MoveAngle = rand.Float64() * 2 * math.Pi
				botState.LastDirChange = tick
			}
			moveX = math.Cos(botState.MoveAngle)
			moveY = math.Sin(botState.MoveAngle)
			targetAngle = botState.MoveAngle
		}

		if moveX != 0 || moveY != 0 {
			len := math.Sqrt(moveX*moveX + moveY*moveY)
			if len > 1.0 {
				moveX /= len
				moveY /= len
			}

			deltaTime := 1.0 / TICK_RATE
			moveSpeed := enemy.Velocity * deltaTime

			oldX := enemy.X
			oldY := enemy.Y

			newX := enemy.X + moveX*moveSpeed
			newY := enemy.Y + moveY*moveSpeed

			PLAYER_RADIUS := 8.0

			canMoveX := true
			canMoveY := true

			gs.ensureChunksAroundPlayer(newX, enemy.Y)

			testX := newX
			testY := enemy.Y

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
				enemy.X = roundFloat(newX, 2)
			}

			gs.ensureChunksAroundPlayer(enemy.X, newY)

			testX = enemy.X
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
				enemy.Y = roundFloat(newY, 2)
			}

			if oldX == enemy.X && oldY == enemy.Y {
				botState.MoveAngle = rand.Float64() * 2 * math.Pi
				botState.LastDirChange = tick
			}
		}

		enemy.Angle = targetAngle
	}
}
