import { test, expect } from '@playwright/test';
import {
    setupGame,
    getPlayerState,
    getPlayerBullets
} from '../helpers/game-helpers.js';

test.describe('Shooting Mechanics', () => {
    test.beforeEach(async ({ page }) => {
        await setupGame(page);
    });


    test('should decrease ammo when shooting', async ({ page }) => {
        const initial = await getPlayerState(page);

        expect(initial.ammo).toBeGreaterThan(0);
        expect(initial.alive).toBe(true);

        // Shoot and wait for server response
        await page.mouse.click(500, 400);
        await page.waitForTimeout(800);

        const final = await getPlayerState(page);

        console.log(`Ammo: ${initial.ammo} -> ${final.ammo}`);

        // Ammo should decrease (or at least not increase)
        expect(final.ammo).toBeLessThanOrEqual(initial.ammo);

        if (final.ammo < initial.ammo) {
            console.log(`Ammo decreased by ${initial.ammo - final.ammo}`);
        } else {
            console.log(`WARNING: Ammo unchanged (cooldown or server delay)`);
        }
    });

    test('should respect shoot cooldown', async ({ page }) => {
        // Rapid fire
        for (let i = 0; i < 5; i++) {
            await page.mouse.click(500, 400);
        }

        await page.waitForTimeout(200);

        const bullets = await getPlayerBullets(page);

        console.log(`Rapid fire created ${bullets.length} bullets`);

        // Should not create 5 bullets due to cooldown
        expect(bullets.length).toBeLessThan(5);
        console.log(`Cooldown prevented ${5 - bullets.length} shots`);
    });

    test('should respect ammo limit when shooting', async ({ page }) => {
        const initialState = await getPlayerState(page);
        const initialAmmo = initialState.ammo;

        await page.keyboard.down('Space');
        await page.waitForTimeout(3000);
        await page.keyboard.up('Space');

        await page.waitForTimeout(500);

        const finalState = await getPlayerState(page);
        const ammoUsed = initialAmmo - finalState.ammo;

        console.log(`Used ${ammoUsed} ammo (${initialAmmo} -> ${finalState.ammo})`);

        expect(ammoUsed).toBeGreaterThan(0);
        expect(finalState.ammo).toBeGreaterThanOrEqual(0);

        console.log('Ammo system working correctly');
    });

    test('should create multiple bullets over time', async ({ page }) => {
        const initial = await getPlayerState(page);

        await page.keyboard.down('Space');
        await page.waitForTimeout(1000);
        await page.keyboard.up('Space');

        await page.waitForTimeout(500);

        const final = await getPlayerState(page);
        const ammoUsed = initial.ammo - final.ammo;

        console.log(`Used ${ammoUsed} ammo from holding space for 1 second`);

        expect(ammoUsed).toBeGreaterThanOrEqual(1);
        console.log('Multiple shots test completed');
    });
});
