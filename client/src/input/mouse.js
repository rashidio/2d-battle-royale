export class MouseHandler {
    constructor(game) {
        this.game = game;
    }

    setup(canvas) {
        canvas.setAttribute('tabindex', '0');
        canvas.style.outline = 'none';

        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.game.sendShoot();
            }
        });
    }
}
