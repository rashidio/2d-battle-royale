package main

import (
	"math"
	"math/rand"
)

func roundFloat(val float64, precision int) float64 {
	multiplier := math.Pow(10, float64(precision))
	return math.Round(val*multiplier) / multiplier
}

func validateInput(moveX, moveY, angle float64) bool {
	if math.IsNaN(moveX) || math.IsNaN(moveY) || math.IsNaN(angle) {
		return false
	}
	if math.IsInf(moveX, 0) || math.IsInf(moveY, 0) || math.IsInf(angle, 0) {
		return false
	}
	if math.Abs(moveX) > 10 || math.Abs(moveY) > 10 {
		return false
	}
	return true
}

func calculateZoneDamagePerTick(zoneRadius float64) float64 {
	if zoneRadius >= 3000 {
		return 0.1
	} else if zoneRadius >= 2000 {
		return 0.1 + (3000-zoneRadius)/1000.0*0.1
	} else if zoneRadius >= 1000 {
		return 0.2 + (2000-zoneRadius)/1000.0*0.1
	} else if zoneRadius >= 500 {
		return 0.3 + (1000-zoneRadius)/500.0*0.2
	} else {
		return 0.5
	}
}

func floatsEqual(a, b float64, epsilon float64) bool {
	return math.Abs(a-b) < epsilon
}

func (gs *GameServer) findValidPosition(startX, startY, radius float64, maxAttempts int, zoneConstrained bool) (float64, float64, bool) {
	for attempts := 0; attempts < maxAttempts; attempts++ {
		x := startX
		y := startY

		if zoneConstrained && attempts > 0 {
			angle := rand.Float64() * 2 * math.Pi
			dist := rand.Float64() * (gs.gameState.ZoneRadius - 50)
			x = gs.gameState.ZoneCenter + math.Cos(angle)*dist
			y = gs.gameState.ZoneCenter + math.Sin(angle)*dist
		}

		if zoneConstrained {
			dx := x - gs.gameState.ZoneCenter
			dy := y - gs.gameState.ZoneCenter
			distFromZone := math.Sqrt(dx*dx + dy*dy)
			if distFromZone > gs.gameState.ZoneRadius-20 {
				continue
			}
		}

		validPosition := true

		nearbyBuildings := gs.buildingGrid.GetNearby(x, y, 100)
		for _, entity := range nearbyBuildings {
			building, ok := entity.(Building)
			if !ok {
				continue
			}
			if x+radius >= building.X && x-radius <= building.X+building.Width &&
				y+radius >= building.Y && y-radius <= building.Y+building.Height {
				validPosition = false
				break
			}
		}

		if validPosition {
			nearbyTrees := gs.treeGrid.GetNearby(x, y, 50)
			for _, entity := range nearbyTrees {
				tree, ok := entity.(Tree)
				if !ok {
					continue
				}
				dx := x - tree.X
				dy := y - tree.Y
				dist := math.Sqrt(dx*dx + dy*dy)
				if dist < tree.Size+radius {
					validPosition = false
					break
				}
			}
		}

		if validPosition {
			return x, y, true
		}
	}

	return startX, startY, false
}
