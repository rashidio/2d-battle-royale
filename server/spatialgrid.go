package main

import (
	"fmt"
	"math"
	"sync"
)

type SpatialGrid struct {
	cellSize float64
	cells    map[string][]interface{}
	mu       sync.RWMutex
}

func NewSpatialGrid(cellSize float64) *SpatialGrid {
	return &SpatialGrid{
		cellSize: cellSize,
		cells:    make(map[string][]interface{}),
	}
}

func (g *SpatialGrid) getCellKey(x, y float64) string {
	cellX := int(math.Floor(x / g.cellSize))
	cellY := int(math.Floor(y / g.cellSize))
	return fmt.Sprintf("%d,%d", cellX, cellY)
}

func (g *SpatialGrid) Insert(x, y float64, entity interface{}) {
	g.mu.Lock()
	defer g.mu.Unlock()
	key := g.getCellKey(x, y)
	g.cells[key] = append(g.cells[key], entity)
}

func (g *SpatialGrid) GetNearby(x, y, radius float64) []interface{} {
	g.mu.RLock()
	defer g.mu.RUnlock()

	cellX := int(math.Floor(x / g.cellSize))
	cellY := int(math.Floor(y / g.cellSize))
	cellRadius := int(math.Ceil(radius / g.cellSize))

	var results []interface{}
	for dx := -cellRadius; dx <= cellRadius; dx++ {
		for dy := -cellRadius; dy <= cellRadius; dy++ {
			key := fmt.Sprintf("%d,%d", cellX+dx, cellY+dy)
			if entities, ok := g.cells[key]; ok {
				results = append(results, entities...)
			}
		}
	}
	return results
}

func (g *SpatialGrid) Clear() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.cells = make(map[string][]interface{})
}
