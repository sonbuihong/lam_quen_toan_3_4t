import Phaser from 'phaser';
import { TextureKeys } from '../consts/Keys';

export default class ScorePopup extends Phaser.GameObjects.Container {
    private popupTitle!: Phaser.GameObjects.Text;
    private popupScore!: Phaser.GameObjects.Text;
    private processingSprite!: Phaser.GameObjects.Sprite;
    private bg!: Phaser.GameObjects.Image;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);
        this.scene.add.existing(this);
        this.setDepth(3000);
        this.setVisible(false);

        this.createUI();
    }

    private createUI() {
        // 1. Background
        this.bg = this.scene.add.image(0, 0, TextureKeys.S1_Board).setScale(0.35);

        // 2. Sprite Animation Setup
        if (!this.scene.anims.exists('chamdiem')) {
            this.scene.anims.create({
                key: 'chamdiem',
                frames: this.scene.anims.generateFrameNumbers(TextureKeys.Sprite2, {
                    start: 0,
                    end: 7
                }),
                frameRate: 8,
                repeat: -1
            });
        }
        
        // 3. Create Sprite (Hidden by default)
        this.processingSprite = this.scene.add.sprite(0, 0, TextureKeys.Sprite2);
        this.processingSprite.setVisible(false);
        this.add([this.bg, this.processingSprite]);
    }

    public show(score: number, feedback: string) {
        // Hide processing sprite when showing result
        if (this.processingSprite) {
            this.processingSprite.setVisible(false);
            this.processingSprite.stop();
        }

        const roundedScore = Math.round(score || 0);
        const isPass = roundedScore >= 60;

        if(isPass){
            if (!this.scene.anims.exists('happy')) {
                this.scene.anims.create({
                    key: 'happy',
                    frames: this.scene.anims.generateFrameNumbers(TextureKeys.Sprite3, {
                        start: 0,
                        end: 5
                    }),
                    frameRate: 6,
                    repeat: -1
                });
            }
            this.processingSprite.setVisible(true);
            this.processingSprite.play('happy');
        } else {
            if (!this.scene.anims.exists('sad')) {
                this.scene.anims.create({
                    key: 'sad',
                    frames: this.scene.anims.generateFrameNumbers(TextureKeys.Sprite4, {
                        start: 0,
                        end: 5
                    }),
                    frameRate: 6,
                    repeat: -1
                });
            }
            this.processingSprite.setVisible(true);
            this.processingSprite.play('sad');
        }
        
        // if (this.popupScore) this.popupScore.setText(`${roundedScore}`);
        
        this._animateShow();
    }

    public showProcessing() {
        if (this.processingSprite) {
            this.processingSprite.setVisible(true).setScale(0.9);
            this.processingSprite.play('chamdiem');
        }
        this._animateShow();
    }

    public showFinal(finalScore: number) {
        if (this.processingSprite) {
            this.processingSprite.setVisible(false);
        }
        if(finalScore == 6){
            this.add(this.scene.add.image(0, 0, TextureKeys.Six).setScale(0.3));
        } else if(finalScore == 7){
            this.add(this.scene.add.image(0, 0, TextureKeys.Seven).setScale(0.3));
        } else if(finalScore == 8){
            this.add(this.scene.add.image(0, 0, TextureKeys.Eight).setScale(0.3));
        } else if(finalScore == 9){
            this.add(this.scene.add.image(0, 0, TextureKeys.Nine).setScale(0.3));
        } else if(finalScore == 10){
            this.add(this.scene.add.image(0, 0, TextureKeys.Ten).setScale(0.3));
        }

        this._animateShow();
    }

    private _animateShow() {
        if (this.visible && this.scale > 0.1) {
             // Already visible, just pulse/bounce to indicate update
             this.scene.tweens.add({
                targets: this,
                scale: 1.1,
                duration: 100,
                yoyo: true,
                ease: 'Sine.easeInOut'
            });
            return;
        }

        this.setVisible(true);
        this.setScale(0);
        
        this.scene.tweens.add({
            targets: this,
            scale: 1,
            duration: 300,
            ease: 'Back.out'
        });
    }

    public hide() {
        this.scene.tweens.add({
            targets: this,
            scale: 0,
            duration: 200,
            ease: 'Back.in',
            onComplete: () => {
                this.setVisible(false);
            }
        });
    }
}
