package main

import (
	"fmt"
	"log"
	"math"
	"math/rand"
)

func (gs *GameServer) isValidTreePosition(x, y float64, size float64) bool {
	for _, building := range gs.gameState.Buildings {
		treeLeft := x - size
		treeRight := x + size
		treeTop := y - size
		treeBottom := y + size

		buildingLeft := building.X
		buildingRight := building.X + building.Width
		buildingTop := building.Y
		buildingBottom := building.Y + building.Height

		if treeRight > buildingLeft && treeLeft < buildingRight &&
			treeBottom > buildingTop && treeTop < buildingBottom {
			return false
		}
	}

	for _, tree := range gs.gameState.Trees {
		dx := x - tree.X
		dy := y - tree.Y
		distSq := dx*dx + dy*dy
		minDist := tree.Size + size + 2
		if distSq < minDist*minDist {
			return false
		}
	}

	return true
}

func (gs *GameServer) isValidPickupPosition(x, y float64, radius float64, withinZone bool) bool {
	if withinZone {
		dx := x - gs.gameState.ZoneCenter
		dy := y - gs.gameState.ZoneCenter
		distFromZone := math.Sqrt(dx*dx + dy*dy)
		if distFromZone > gs.gameState.ZoneRadius-radius {
			return false
		}
	}

	for _, building := range gs.gameState.Buildings {
		pickupLeft := x - radius
		pickupRight := x + radius
		pickupTop := y - radius
		pickupBottom := y + radius

		buildingLeft := building.X
		buildingRight := building.X + building.Width
		buildingTop := building.Y
		buildingBottom := building.Y + building.Height

		if pickupRight > buildingLeft && pickupLeft < buildingRight &&
			pickupBottom > buildingTop && pickupTop < buildingBottom {
			return false
		}
	}

	for _, tree := range gs.gameState.Trees {
		dx := x - tree.X
		dy := y - tree.Y
		distSq := dx*dx + dy*dy
		minDist := tree.Size + radius
		if distSq < minDist*minDist {
			return false
		}
	}

	return true
}

func (gs *GameServer) getChunkKey(x, y float64) string {
	chunkX := math.Floor(x / CHUNK_SIZE)
	chunkY := math.Floor(y / CHUNK_SIZE)
	return fmt.Sprintf("%d,%d", int(chunkX), int(chunkY))
}

func (gs *GameServer) generateChunk(centerX, centerY float64) {
	chunkKey := gs.getChunkKey(centerX, centerY)
	if gs.generatedChunks[chunkKey] {
		return
	}
	gs.generatedChunks[chunkKey] = true

	chunkStartX := math.Floor(centerX/CHUNK_SIZE) * CHUNK_SIZE
	chunkStartY := math.Floor(centerY/CHUNK_SIZE) * CHUNK_SIZE

	chunkX := int(chunkStartX / CHUNK_SIZE)
	chunkY := int(chunkStartY / CHUNK_SIZE)

	chunk := &WorldChunk{
		ChunkX:    chunkX,
		ChunkY:    chunkY,
		Buildings: make([]Building, 0),
		Trees:     make([]Tree, 0),
	}

	rng := rand.New(rand.NewSource(int64(chunkStartX*1000 + chunkStartY)))

	densitySeed := (chunkX*31 + chunkY*17) % 100
	hasSettlement := densitySeed < 40
	hasForest := densitySeed > 20 && densitySeed < 80

	if hasSettlement {
		settlementX := chunkStartX + CHUNK_SIZE*0.3 + rng.Float64()*CHUNK_SIZE*0.4
		settlementY := chunkStartY + CHUNK_SIZE*0.3 + rng.Float64()*CHUNK_SIZE*0.4

		gridSize := 45.0
		buildingCount := 2 + rng.Intn(4)

		for i := 0; i < buildingCount; i++ {
			gridX := float64(i%3) * gridSize
			gridY := float64(i/3) * gridSize

			offsetX := (rng.Float64() - 0.5) * 10
			offsetY := (rng.Float64() - 0.5) * 10

			buildingX := settlementX + gridX + offsetX - gridSize
			buildingY := settlementY + gridY + offsetY - gridSize

			if buildingX < chunkStartX {
				buildingX = chunkStartX + 10
			}
			if buildingY < chunkStartY {
				buildingY = chunkStartY + 10
			}
			if buildingX+80 > chunkStartX+CHUNK_SIZE {
				buildingX = chunkStartX + CHUNK_SIZE - 80
			}
			if buildingY+80 > chunkStartY+CHUNK_SIZE {
				buildingY = chunkStartY + CHUNK_SIZE - 80
			}

			building := Building{
				X:      buildingX,
				Y:      buildingY,
				Width:  45 + rng.Float64()*35,
				Height: 45 + rng.Float64()*35,
			}
			gs.gameState.Buildings = append(gs.gameState.Buildings, building)
			chunk.Buildings = append(chunk.Buildings, building)
			gs.buildingGrid.Insert(building.X, building.Y, building)
		}
	} else if rng.Float64() < 0.3 {
		singleBuilding := Building{
			X:      chunkStartX + rng.Float64()*CHUNK_SIZE*0.7 + CHUNK_SIZE*0.15,
			Y:      chunkStartY + rng.Float64()*CHUNK_SIZE*0.7 + CHUNK_SIZE*0.15,
			Width:  40 + rng.Float64()*40,
			Height: 40 + rng.Float64()*40,
		}
		gs.gameState.Buildings = append(gs.gameState.Buildings, singleBuilding)
		chunk.Buildings = append(chunk.Buildings, singleBuilding)
		gs.buildingGrid.Insert(singleBuilding.X, singleBuilding.Y, singleBuilding)
	}

	if hasForest {
		forestX := chunkStartX + CHUNK_SIZE*0.2 + rng.Float64()*CHUNK_SIZE*0.6
		forestY := chunkStartY + CHUNK_SIZE*0.2 + rng.Float64()*CHUNK_SIZE*0.6

		forestRadius := 90.0 + rng.Float64()*60.0
		treeCount := 12 + rng.Intn(8)

		for i := 0; i < treeCount; i++ {
			treeType := getRandomTreeType(rng)
			treeSize := 16 + rng.Float64()*9

			validPosition := false
			treeX := 0.0
			treeY := 0.0

			for attempts := 0; attempts < 50; attempts++ {
				angle := rng.Float64() * 2 * math.Pi
				dist := rng.Float64() * forestRadius

				treeX = forestX + math.Cos(angle)*dist
				treeY = forestY + math.Sin(angle)*dist

				if treeX < chunkStartX {
					treeX = chunkStartX + 10
				}
				if treeY < chunkStartY {
					treeY = chunkStartY + 10
				}
				if treeX > chunkStartX+CHUNK_SIZE {
					treeX = chunkStartX + CHUNK_SIZE - 10
				}
				if treeY > chunkStartY+CHUNK_SIZE {
					treeY = chunkStartY + CHUNK_SIZE - 10
				}

				if gs.isValidTreePosition(treeX, treeY, treeSize) {
					validPosition = true
					break
				}
			}

			if validPosition {
				tree := Tree{
					X:    treeX,
					Y:    treeY,
					Size: treeSize,
					Type: treeType,
				}
				gs.gameState.Trees = append(gs.gameState.Trees, tree)
				chunk.Trees = append(chunk.Trees, tree)
				gs.treeGrid.Insert(tree.X, tree.Y, tree)
			}
		}
	} else {
		scatteredCount := 3 + rng.Intn(5)
		for i := 0; i < scatteredCount; i++ {
			treeType := getRandomTreeType(rng)
			treeSize := 15 + rng.Float64()*10

			validPosition := false
			treeX := 0.0
			treeY := 0.0

			for attempts := 0; attempts < 50; attempts++ {
				treeX = chunkStartX + rng.Float64()*CHUNK_SIZE
				treeY = chunkStartY + rng.Float64()*CHUNK_SIZE

				if gs.isValidTreePosition(treeX, treeY, treeSize) {
					validPosition = true
					break
				}
			}

			if validPosition {
				tree := Tree{
					X:    treeX,
					Y:    treeY,
					Size: treeSize,
					Type: treeType,
				}
				gs.gameState.Trees = append(gs.gameState.Trees, tree)
				chunk.Trees = append(chunk.Trees, tree)
				gs.treeGrid.Insert(tree.X, tree.Y, tree)
			}
		}
	}

	gs.chunkDataMu.Lock()
	gs.chunkData[chunkKey] = chunk
	gs.chunkDataMu.Unlock()
}

func (gs *GameServer) ensureChunksAroundPlayer(x, y float64) {
	chunkX := math.Floor(x/CHUNK_SIZE) * CHUNK_SIZE
	chunkY := math.Floor(y/CHUNK_SIZE) * CHUNK_SIZE

	for dx := -CHUNK_SIZE * 2; dx <= CHUNK_SIZE*2; dx += CHUNK_SIZE {
		for dy := -CHUNK_SIZE * 2; dy <= CHUNK_SIZE*2; dy += CHUNK_SIZE {
			chunkKey := gs.getChunkKey(chunkX+dx, chunkY+dy)
			if !gs.generatedChunks[chunkKey] {
				alreadyPending := false
				for _, pending := range gs.pendingChunks {
					if pending.X == chunkX+dx && pending.Y == chunkY+dy {
						alreadyPending = true
						break
					}
				}
				if !alreadyPending {
					gs.pendingChunks = append(gs.pendingChunks, struct{ X, Y float64 }{chunkX + dx, chunkY + dy})
				}
			}
		}
	}
}

func (gs *GameServer) processPendingChunks(maxPerTick int) {
	if len(gs.pendingChunks) == 0 {
		return
	}

	processed := 0
	for len(gs.pendingChunks) > 0 && processed < maxPerTick {
		chunk := gs.pendingChunks[0]
		gs.pendingChunks = gs.pendingChunks[1:]
		gs.generateChunk(chunk.X, chunk.Y)
		processed++
	}
}

func getRandomTreeType(rng *rand.Rand) string {
	randVal := rng.Float64()
	if randVal < 0.6 {
		return "normal"
	}
	return "bush"
}

func (gs *GameServer) findValidPickupPosition(radius float64, withinZone bool) (float64, float64) {
	for attempts := 0; attempts < 300; attempts++ {
		var x, y float64
		if withinZone {
			angle := rand.Float64() * 2 * math.Pi
			maxDist := gs.gameState.ZoneRadius - radius - 20
			minDist := maxDist * 0.2
			dist := minDist + math.Sqrt(rand.Float64())*(maxDist-minDist)
			x = gs.gameState.ZoneCenter + math.Cos(angle)*dist
			y = gs.gameState.ZoneCenter + math.Sin(angle)*dist
		} else {
			x = rand.Float64()*10000 - 5000
			y = rand.Float64()*10000 - 5000
		}
		if gs.isValidPickupPosition(x, y, radius, withinZone) {
			return x, y
		}
	}
	log.Printf("findValidPickupPosition failed after 300 attempts (zone=%v), using fallback", withinZone)

	if withinZone {
		angle := rand.Float64() * 2 * math.Pi
		maxDist := gs.gameState.ZoneRadius - radius - 20
		minDist := maxDist * 0.2
		dist := minDist + math.Sqrt(rand.Float64())*(maxDist-minDist)
		return gs.gameState.ZoneCenter + math.Cos(angle)*dist, gs.gameState.ZoneCenter + math.Sin(angle)*dist
	}
	return rand.Float64()*10000 - 5000, rand.Float64()*10000 - 5000
}
