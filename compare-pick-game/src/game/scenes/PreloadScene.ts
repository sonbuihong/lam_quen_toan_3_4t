// src/game/scenes/PreloadScene.ts
import Phaser from 'phaser';
import type { LessonPackage } from '../types/lesson';

type DifficultyLevel = 1 | 2 | 3;

type PreloadData = {
    lessonId: string;
    difficulty?: DifficultyLevel; // nhận thêm từ LessonSelectScene
};

export class PreloadScene extends Phaser.Scene {
    private lessonId!: string;
    private selectedDifficulty: DifficultyLevel = 3; // mặc định: chơi full nếu không truyền
    private lessonData!: LessonPackage;

    constructor() {
        super('PreloadScene');
    }

    init(data: PreloadData) {
        this.lessonId = data.lessonId;
        // nếu không truyền difficulty (ví dụ replay từ SummaryScene) thì cho = 3
        this.selectedDifficulty = data.difficulty ?? 3;
    }

    preload() {
        // === UI CHUNG ===
        this.load.image('speaker-icon', 'assets/ui/speaker.png');

        // Panel nền câu hỏi & câu trả lời
        this.load.image('panel_bg', 'assets/ui/panel_bg.webp');
        this.load.image('panel_bg_correct', 'assets/ui/panel_bg_ok.webp');
        this.load.image('panel_bg_wrong', 'assets/ui/panel_bg_wrong.webp');
        this.load.image('panel_bg_1', 'assets/ui/panel_bg_1.webp');
        this.load.image('panel_bg_1_correct', 'assets/ui/panel_bg_1_ok.webp');
        this.load.image('panel_bg_1_wrong', 'assets/ui/panel_bg_1_wrong.webp');

        // Thanh câu hỏi (khung câu hỏi)
        this.load.image('question_bar', 'assets/ui/question_bar.webp');

        this.load.image('boy', 'assets/characters/boy.webp');
        this.load.image('squirrel', 'assets/characters/squirrel.webp');

        // === UI KẾT THÚC BÀI HỌC ===
        this.load.image('banner_congrat', 'assets/ui/banner_congrat.webp');
        this.load.image('btn_reset', 'assets/ui/btn_reset.webp');
        this.load.image('btn_exit', 'assets/ui/btn_exit.webp');

        this.load.audio('complete', 'audio/sfx/complete.ogg');
        this.load.audio('fireworks', 'audio/sfx/fireworks.ogg');
        this.load.audio('applause', 'audio/sfx/applause.ogg');
        this.load.audio('sfx_click', 'audio/sfx/click.ogg');

        // === JSON BÀI HỌC ===
        // XÓA JSON CŨ TRƯỚC
        if (this.cache.json.exists('lessonData')) {
            this.cache.json.remove('lessonData');
        }
        this.load.json('lessonData', `lessons/${this.lessonId}.json`);
    }

    create() {
        const rawLesson = this.cache.json.get('lessonData') as LessonPackage;
        const filteredItems = rawLesson.items.filter((item) => {
            const d = (item as any).difficulty ?? 1;
            return d === this.selectedDifficulty;
        });

        const lessonForPlay: LessonPackage = {
            ...rawLesson,
            items: filteredItems,
        };

        // preload asset cho bộ câu đã lọc
        this.preloadLessonAssets(lessonForPlay).then(() => {
            this.lessonData = lessonForPlay;
            this.scene.start('LessonScene', {
                lesson: this.lessonData,
                difficulty: this.selectedDifficulty, // ⬅️ truyền xuống
            });
        });
    }

    private async preloadLessonAssets(lesson: LessonPackage) {
        // preload hình trong lesson
        lesson.items.forEach((item) => {
            item.options.forEach((opt) => {
                if (!this.textures.exists(opt.image)) {
                    this.load.image(opt.image, opt.image);
                }
            });

            if (item.promptAudio) {
                this.load.audio(item.promptAudio, item.promptAudio);
            }
        });

        if (lesson.defaultPromptAudio) {
            this.load.audio(
                lesson.defaultPromptAudio,
                lesson.defaultPromptAudio
            );
        }

        return new Promise<void>((resolve) => {
            this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
            this.load.start();
        });
    }
}
