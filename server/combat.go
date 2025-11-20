package main

import (
	"time"
)

func (gs *GameServer) createBullet(player *Player) {
	if player.Ammo <= 0 {
		return
	}

	weapon := GetWeapon(player.Weapon)
	now := time.Now().UnixMilli()

	if now-player.LastShoot < weapon.GetCooldown() {
		return
	}

	player.LastShoot = now
	player.Ammo--

	bullets := weapon.CreateBullets(player, gs)
	for _, bullet := range bullets {
		gs.gameState.Bullets[bullet.ID] = bullet
	}
}
