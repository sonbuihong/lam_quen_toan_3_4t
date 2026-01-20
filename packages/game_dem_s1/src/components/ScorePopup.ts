import Phaser from 'phaser';
import { TextureKeys } from '../consts/Keys';

export default class ScorePopup extends Phaser.GameObjects.Container {
    private popupTitle!: Phaser.GameObjects.Text;
    private popupScore!: Phaser.GameObjects.Text;
    private popupFeedback!: Phaser.GameObjects.Text;
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
        
        // 2. Title
        this.popupTitle = this.scene.add.text(0, -60, "KẾT QUẢ", {
            fontSize: '50px',
            color: '#000000',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        // 3. Score
        this.popupScore = this.scene.add.text(0, 45, "0", {
            fontSize: '80px',
            color: '#d32f2f',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        // 4. Feedback (Hidden/Unused for now)
        this.popupFeedback = this.scene.add.text(0, 90, "", {
            fontSize: '30px',
            color: '#333333',
            fontFamily: 'Arial',
            wordWrap: { width: 400 },
            align: 'center'
        }).setOrigin(0.5).setVisible(false);

        this.add([this.bg, this.popupTitle, this.popupScore, this.popupFeedback]);
    }

    public show(score: number, feedback: string) {
        const roundedScore = Math.round(score || 0);
        const isPass = roundedScore >= 60;

        // Set Text & Color based on Score
        if (isPass) {
            this.popupTitle.setText("BÉ GIỎI QUÁ!");
            this.popupTitle.setColor('#2e7d32'); // Green
            this.popupScore.setColor('#2e7d32');
        } else {
            this.popupTitle.setText("BÉ CỐ GẮNG HƠN NHÉ!");
            this.popupTitle.setColor('#d32f2f'); // Red
            this.popupScore.setColor('#d32f2f');
        }

        this.popupScore.setText(`${roundedScore}`);
        // this.popupFeedback.setText(feedback);
        console.log("feedback", feedback);
        
        this._animateShow();
    }

    public showFinal(finalScore: number) {
        this.popupTitle.setText("TỔNG KẾT");
        this.popupTitle.setColor('#1565c0'); // Blue
        
        this.popupScore.setText(`${finalScore}/10`);
        this.popupScore.setColor('#1565c0');

        // let msg = "";
        // if (finalScore >= 6) {
        //     msg = "Chúc mừng bé hoàn thành bài học!";
        // } else {
        //     msg = "Bé hãy luyện tập thêm nhé!";
        // }
        // this.popupFeedback.setText(msg);

        // Hide normal game buttons for final screen (or change logic if needed)
        // this.btnReplay.setVisible(false);
        // this.btnNext.setVisible(false);

        this._animateShow();
    }

    private _animateShow() {
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
