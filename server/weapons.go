package main

import (
	"fmt"
	"log"
)

type Weapon interface {
	GetName() string
	GetCooldown() int64
	GetInitialAmmo() int
	CreateBullets(player *Player, gs *GameServer) []*Bullet
}

type Pistol struct{}

func (p *Pistol) GetName() string {
	return "pistol"
}

func (p *Pistol) GetCooldown() int64 {
	return 500
}

func (p *Pistol) GetInitialAmmo() int {
	return 30
}

func (p *Pistol) CreateBullets(player *Player, gs *GameServer) []*Bullet {
	bulletID := fmt.Sprintf("bullet_%d", gs.nextBulletID)
	gs.nextBulletID++

	bullet := &Bullet{
		ID:       bulletID,
		PlayerID: player.ID,
		X:        roundFloat(player.X, 2),
		Y:        roundFloat(player.Y, 2),
		Angle:    roundFloat(player.Angle, 4),
		Speed:    18.0,
		Active:   true,
		Weapon:   player.Weapon,
	}

	log.Printf("[BULLET CREATED] Player %s shot pistol bullet %s at (%.2f, %.2f) angle %.2f, ammo now: %d",
		player.ID, bulletID, player.X, player.Y, player.Angle, player.Ammo)

	return []*Bullet{bullet}
}

type Rifle struct{}

func (r *Rifle) GetName() string {
	return "rifle"
}

func (r *Rifle) GetCooldown() int64 {
	return 450
}

func (r *Rifle) GetInitialAmmo() int {
	return 20
}

func (r *Rifle) CreateBullets(player *Player, gs *GameServer) []*Bullet {
	spreadAngle := 0.15

	bulletID1 := fmt.Sprintf("bullet_%d", gs.nextBulletID)
	gs.nextBulletID++
	bullet1 := &Bullet{
		ID:       bulletID1,
		PlayerID: player.ID,
		X:        roundFloat(player.X, 2),
		Y:        roundFloat(player.Y, 2),
		Angle:    roundFloat(player.Angle-spreadAngle, 4),
		Speed:    18.0,
		Active:   true,
		Weapon:   player.Weapon,
	}
	log.Printf("[BULLET CREATED] Player %s shot rifle bullet %s at (%.2f, %.2f) angle %.2f",
		player.ID, bulletID1, player.X, player.Y, player.Angle-spreadAngle)

	bulletID2 := fmt.Sprintf("bullet_%d", gs.nextBulletID)
	gs.nextBulletID++
	bullet2 := &Bullet{
		ID:       bulletID2,
		PlayerID: player.ID,
		X:        roundFloat(player.X, 2),
		Y:        roundFloat(player.Y, 2),
		Angle:    roundFloat(player.Angle+spreadAngle, 4),
		Speed:    18.0,
		Active:   true,
		Weapon:   player.Weapon,
	}
	log.Printf("[BULLET CREATED] Player %s shot rifle bullet %s at (%.2f, %.2f) angle %.2f",
		player.ID, bulletID2, player.X, player.Y, player.Angle+spreadAngle)

	return []*Bullet{bullet1, bullet2}
}

type Machinegun struct{}

func (m *Machinegun) GetName() string {
	return "machinegun"
}

func (m *Machinegun) GetCooldown() int64 {
	return 100
}

func (m *Machinegun) GetInitialAmmo() int {
	return 50
}

func (m *Machinegun) CreateBullets(player *Player, gs *GameServer) []*Bullet {
	bulletID := fmt.Sprintf("bullet_%d", gs.nextBulletID)
	gs.nextBulletID++

	bullet := &Bullet{
		ID:       bulletID,
		PlayerID: player.ID,
		X:        roundFloat(player.X, 2),
		Y:        roundFloat(player.Y, 2),
		Angle:    roundFloat(player.Angle, 4),
		Speed:    18.0,
		Active:   true,
		Weapon:   player.Weapon,
	}

	log.Printf("[BULLET CREATED] Player %s shot machinegun bullet %s at (%.2f, %.2f) angle %.2f, ammo now: %d",
		player.ID, bulletID, player.X, player.Y, player.Angle, player.Ammo)

	return []*Bullet{bullet}
}

type Shotgun struct{}

func (s *Shotgun) GetName() string {
	return "shotgun"
}

func (s *Shotgun) GetCooldown() int64 {
	return 800
}

func (s *Shotgun) GetInitialAmmo() int {
	return 15
}

func (s *Shotgun) CreateBullets(player *Player, gs *GameServer) []*Bullet {
	bullets := make([]*Bullet, 0)
	pelletCount := 5
	spreadAngle := 0.3

	for i := 0; i < pelletCount; i++ {
		bulletID := fmt.Sprintf("bullet_%d", gs.nextBulletID)
		gs.nextBulletID++

		angleOffset := -spreadAngle/2 + (spreadAngle * float64(i) / float64(pelletCount-1))

		bullet := &Bullet{
			ID:       bulletID,
			PlayerID: player.ID,
			X:        roundFloat(player.X, 2),
			Y:        roundFloat(player.Y, 2),
			Angle:    roundFloat(player.Angle+angleOffset, 4),
			Speed:    18.0,
			Active:   true,
			Weapon:   player.Weapon,
		}

		bullets = append(bullets, bullet)
	}

	log.Printf("[BULLET CREATED] Player %s shot shotgun %d pellets at (%.2f, %.2f), ammo now: %d",
		player.ID, pelletCount, player.X, player.Y, player.Ammo)

	return bullets
}

var weaponInstances = map[string]Weapon{
	"pistol":     &Pistol{},
	"rifle":      &Rifle{},
	"machinegun": &Machinegun{},
	"shotgun":    &Shotgun{},
}

func GetWeapon(weaponType string) Weapon {
	if weapon, ok := weaponInstances[weaponType]; ok {
		return weapon
	}
	return weaponInstances["pistol"]
}
