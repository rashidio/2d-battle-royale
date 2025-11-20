export class PlayerStatsDisplay {
    constructor() {
        this.lastHealth = null;
        this.lastAmmo = null;
        this.healthFlashTimeout = null;
        this.ammoFlashTimeout = null;
    }

    update(player) {
        if (!player) return;

        this.updateHealth(player.health);
        this.updateAmmo(player.ammo);
        this.updateWeapon(player.weapon);
        this.updateKills(player.kills);
        this.updatePosition(player.x, player.y);
        this.updateAngle(player.angle);
    }

    updateHealth(health) {
        const healthEl = document.getElementById('health');
        if (!healthEl) return;

        const healthChanged = this.lastHealth !== null && this.lastHealth < health;
        healthEl.textContent = health;

        if (healthChanged) {
            healthEl.style.color = '#00FF00';
            if (this.healthFlashTimeout) clearTimeout(this.healthFlashTimeout);
            this.healthFlashTimeout = setTimeout(() => {
                const el = document.getElementById('health');
                if (el) el.style.color = '';
            }, 500);
        }

        this.lastHealth = health;
    }

    updateAmmo(ammo) {
        const ammoEl = document.getElementById('ammo');
        if (!ammoEl) return;

        const ammoValue = ammo || 0;
        const ammoChanged = this.lastAmmo !== null && this.lastAmmo < ammoValue;
        ammoEl.textContent = ammoValue;

        if (ammoChanged) {
            ammoEl.style.color = '#00FF00';
            if (this.ammoFlashTimeout) clearTimeout(this.ammoFlashTimeout);
            this.ammoFlashTimeout = setTimeout(() => {
                const el = document.getElementById('ammo');
                if (el) el.style.color = '';
            }, 500);
        }

        this.lastAmmo = ammoValue;
    }

    updateWeapon(weapon) {
        const weaponEl = document.getElementById('weapon');
        if (!weaponEl) return;

        const weaponName = weapon || 'none';
        if (weaponName === 'none') {
            weaponEl.textContent = '-';
        } else {
            weaponEl.textContent = weaponName.charAt(0).toUpperCase() + weaponName.slice(1);
        }
    }

    updateKills(kills) {
        const killsEl = document.getElementById('kills');
        if (killsEl) {
            killsEl.textContent = kills || 0;
        }
    }

    updatePosition(x, y) {
        const positionEl = document.getElementById('position');
        if (positionEl) {
            positionEl.textContent = `${Math.round(x)}, ${Math.round(y)}`;
        }
    }

    updateAngle(angle) {
        const angleEl = document.getElementById('angle');
        if (angleEl) {
            angleEl.textContent = `${Math.round(angle * 180 / Math.PI)}°`;
        }
    }

    cleanup() {
        if (this.healthFlashTimeout) {
            clearTimeout(this.healthFlashTimeout);
            this.healthFlashTimeout = null;
        }
        if (this.ammoFlashTimeout) {
            clearTimeout(this.ammoFlashTimeout);
            this.ammoFlashTimeout = null;
        }
    }
}

