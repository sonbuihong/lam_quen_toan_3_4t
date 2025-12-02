import Phaser from 'phaser';
import type { LevelConfig, CompareMode } from './types';

type GameState =
  | 'SHOW_LEVEL'
  | 'WAIT_CHOICE'
  | 'CHECK_CHOICE'
  | 'BALANCING'
  | 'LEVEL_END'
  | 'GAME_END';

// loại đồ vật
type Subject = 'BALLOON' | 'FLOWER';

const QUESTION_MORE = 'BẠN NÀO CẦM NHIỀU BÓNG HƠN?';
const QUESTION_LESS = 'BẠN NÀO CẦM ÍT BÓNG HƠN?';
const QUESTION_FLOWER_MORE = 'BÊN NÀO CÓ NHIỀU HOA HƠN?';
const QUESTION_FLOWER_LESS = 'BÊN NÀO CÓ ÍT HOA HƠN?';

const GIRL_TEXTURE: Record<Subject, string> = {
  BALLOON: 'girl_balloon',
  FLOWER: 'girl_flower'
};

const BOY_TEXTURE: Record<Subject, string> = {
  BALLOON: 'boy_balloon',
  FLOWER: 'boy_flower'
};

const ANSWER_DEFAULT = 'answer_default';
const ANSWER_CORRECT = 'answer_correct';
const ANSWER_WRONG = 'answer_wrong';

// ===== SCALE (có thể chỉnh để scale toàn cảnh) =====
const BOARD_SCALE = 1.0;

const BASE_BOARD_WIDTH = 900;
const BASE_BOARD_HEIGHT = 550;

const BASE_CHARACTER_SCALE = 0.48; // scale nhân vật cơ bản
const BASE_ANSWER_SCALE = 0.6;     // scale nút chọn
const BASE_CHARACTER_GAP_Y = 25;   // khoảng cách dọc giữa nút và nhân vật

const BOARD_WIDTH = BASE_BOARD_WIDTH * BOARD_SCALE;
const BOARD_HEIGHT = BASE_BOARD_HEIGHT * BOARD_SCALE;

const CHARACTER_SCALE = BASE_CHARACTER_SCALE * BOARD_SCALE;
const ANSWER_SCALE = BASE_ANSWER_SCALE * BOARD_SCALE;
const CHARACTER_GAP_Y = BASE_CHARACTER_GAP_Y * BOARD_SCALE;

// ===== LAYOUT – các hằng số dễ chỉnh vị trí UI =====

// Offset X nhân vật theo từng loại đồ vật
const CHARACTER_OFFSET_X: Record<Subject, { left: number; right: number }> = {
  BALLOON: { left: 25.0, right: 60.0 },
  FLOWER: { left: -30.0, right: -30.0 }
};

// Tỉ lệ cột trái/phải trên board
const LEFT_COL_RATIO = 0.3;
const RIGHT_COL_RATIO = 0.7;

// Vị trí board theo trục Y (pixel màn hình)
const BOARD_TOP_Y = 140;

// Vị trí banner câu hỏi theo trục Y
const BANNER_Y = 80;

// Scale banner câu hỏi (nhân với BOARD_SCALE)
const BANNER_SCALE = 0.65;

// Khoảng cách từ đáy board lên tới nút chọn (pixel gốc, nhân với BOARD_SCALE)
const BUTTON_BOTTOM_MARGIN = 60;

// Offset tinh chỉnh nút chọn theo trục X/Y (nếu cần lệch nhẹ)
const BUTTON_OFFSET_Y = 0;
const BUTTON_OFFSET_X_LEFT = 0;
const BUTTON_OFFSET_X_RIGHT = 0;

// Font size (gốc) cho câu hỏi & feedback (nhân với BOARD_SCALE)
const PROMPT_FONT_SIZE = 30;
const FEEDBACK_FONT_SIZE = 22;

// Khoảng cách feedback text từ đáy màn hình (pixel)
const FEEDBACK_BOTTOM_MARGIN = 40;

// ========================================================

export default class GameScene extends Phaser.Scene {
  public levels: LevelConfig[] = [];
  public levelIndex = 0;
  public score = 0;
  public level = 0;

  private gameState: GameState = 'SHOW_LEVEL';

  private promptText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;

  private leftBtn!: Phaser.GameObjects.Image;
  private rightBtn!: Phaser.GameObjects.Image;
  private questionBanner!: Phaser.GameObjects.Image;

  private girlSprite!: Phaser.GameObjects.Image;
  private boySprite!: Phaser.GameObjects.Image;

  private levelSubjects: Subject[] = [];
  private levelQuestions: string[] = [];

  // đánh dấu việc vào / hoàn thành màn phụ (BalanceScene) cho level hiện tại
  public subgameEntered = false;

  public subgameDone = false; 

  constructor() {
    super('GameScene');
  }

  init(data: { levelIndex?: number; score?: number }) {
    this.levelIndex = data.levelIndex ?? 0;
    this.level = this.levelIndex;
    this.score = data.score ?? 0;

    // mỗi lần vào GameScene cho level mới, reset trạng thái màn phụ
    this.subgameEntered = false;
    this.subgameDone = false;

    const globalKey = '__comparisonLevels__';

    // Bắt đầu lượt chơi mới (level 0) -> tạo bộ level mới
    if (this.levelIndex === 0 || !(window as any)[globalKey]) {
      const { levels, subjects, questions } = this.generateLevels(4);
      this.levels = levels;
      this.levelSubjects = subjects;
      this.levelQuestions = questions;
      (window as any)[globalKey] = { levels, subjects, questions };
    } else {
      // Các lần quay lại GameScene ở level > 0 -> dùng lại bộ level cũ
      const saved = (window as any)[globalKey];
      this.levels = saved.levels;
      this.levelSubjects = saved.subjects;
      this.levelQuestions = saved.questions;
    }
  }

  // để main.ts dùng check khi bấm nút "Next"
  public isLevelComplete(): boolean {
    // coi như level hoàn thành khi đã trả lời xong câu hỏi (đúng/sai đều đã xử lý)
    return this.subgameDone;
  }

  create() {
    const { width, height } = this.scale;

    // Ẩn nút HTML ở màn câu hỏi, chỉ hiện khi sang màn phụ (BalanceScene)
    if ((window as any).setGameButtonsVisible) {
      (window as any).setGameButtonsVisible(false);
    }
    if ((window as any).setRandomGameViewportBg) {
      (window as any).setRandomGameViewportBg();
    }

    // BOARD

    // Gắn asset cho nút HTML trên viewport
    const replayBtnEl = document.getElementById('btn-replay') as
      | HTMLButtonElement
      | null;
    const nextBtnEl = document.getElementById('btn-next') as
      | HTMLButtonElement
      | null;

    const setBtnBgFromUrl = (el: HTMLButtonElement | null, url?: string) => {
      if (!el || !url) return;
      el.style.backgroundImage = `url("${url}")`;
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundPosition = 'center';
      el.style.backgroundSize = 'contain';
    };

    setBtnBgFromUrl(replayBtnEl, '/assets/button/replay.png');
    setBtnBgFromUrl(nextBtnEl, '/assets/button/next.png');

    const boardX = (width - BOARD_WIDTH) / 2;
    const boardY = BOARD_TOP_Y;

    this.add
      .image(
        boardX + BOARD_WIDTH / 2,
        boardY + BOARD_HEIGHT / 2,
        'banner_question'
      )
      .setDisplaySize(BOARD_WIDTH, BOARD_HEIGHT)
      .setOrigin(0.5);

    // Banner Câu hỏi
    const bannerY = BANNER_Y;
    this.questionBanner = this.add
      .image(width / 2, bannerY, 'btn_primary_pressed')
      .setOrigin(0.5);
    this.questionBanner.setScale(BANNER_SCALE * BOARD_SCALE);

    this.promptText = this.add
      .text(width / 2, bannerY, '', {
        fontFamily: 'San Francisco, "Noto Sans", system-ui, sans-serif',
        fontSize: `${PROMPT_FONT_SIZE * BOARD_SCALE}px`,
        fontStyle: '700',
        color: '#FFFFFF',
        align: 'center'
      })
      .setOrigin(0.5);

    // CỘT
    const baseLeftColX = boardX + BOARD_WIDTH * LEFT_COL_RATIO;
    const baseRightColX = boardX + BOARD_WIDTH * RIGHT_COL_RATIO;
    const btnY =
      boardY +
      BOARD_HEIGHT -
      BUTTON_BOTTOM_MARGIN * BOARD_SCALE +
      BUTTON_OFFSET_Y;

    // Nút chọn
    this.leftBtn = this.add
      .image(baseLeftColX + BUTTON_OFFSET_X_LEFT, btnY, ANSWER_DEFAULT)
      .setScale(ANSWER_SCALE)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleChoice('LEFT'));

    this.rightBtn = this.add
      .image(baseRightColX + BUTTON_OFFSET_X_RIGHT, btnY, ANSWER_DEFAULT)
      .setScale(ANSWER_SCALE)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleChoice('RIGHT'));

    // NHÂN VẬT
    const currentSubject = this.levelSubjects[this.levelIndex] ?? 'BALLOON';
    const subjectOffset = CHARACTER_OFFSET_X[currentSubject];

    // Girl
    const girlX = baseLeftColX + subjectOffset.left;
    this.girlSprite = this.add
      .image(girlX, 0, GIRL_TEXTURE[currentSubject])
      .setScale(CHARACTER_SCALE);
    const girlY =
      btnY -
      this.leftBtn.displayHeight / 2 -
      this.girlSprite.displayHeight / 2 -
      CHARACTER_GAP_Y;
    this.girlSprite.setY(girlY);

    // Boy
    const boyX = baseRightColX + subjectOffset.right;
    this.boySprite = this.add
      .image(boyX, 0, BOY_TEXTURE[currentSubject])
      .setScale(CHARACTER_SCALE);
    const boyY =
      btnY -
      this.rightBtn.displayHeight / 2 -
      this.boySprite.displayHeight / 2 -
      CHARACTER_GAP_Y;
    this.boySprite.setY(boyY);

    // Feedback
    this.feedbackText = this.add
      .text(width / 2, height - FEEDBACK_BOTTOM_MARGIN, '', {
        fontSize: `${FEEDBACK_FONT_SIZE * BOARD_SCALE}px`,
        color: '#333'
      })
      .setOrigin(0.5);

    this.startLevel();
  }

  // ================= RANDOM LEVEL =================
  private generateLevels(numLevels: number): {
    levels: LevelConfig[];
    subjects: Subject[];
    questions: string[];
  } {
    // Tạo đủ 4 kiểu màn khác nhau, không lặp:
    // BALLOON-MORE, BALLOON-LESS, FLOWER-MORE, FLOWER-LESS
    const combos: { subject: Subject; mode: CompareMode }[] = [
      { subject: 'BALLOON', mode: 'MORE' },
      { subject: 'BALLOON', mode: 'LESS' },
      { subject: 'FLOWER', mode: 'MORE' },
      { subject: 'FLOWER', mode: 'LESS' }
    ];

    // shuffle
    for (let i = combos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combos[i], combos[j]] = [combos[j], combos[i]];
    }

    const levels: LevelConfig[] = [];
    const subjects: Subject[] = [];
    const questions: string[] = [];

    const total = Math.min(numLevels, combos.length);

    for (let i = 0; i < total; i++) {
      const { subject, mode } = combos[i];

      let text: string;
      if (subject === 'BALLOON') {
        text = mode === 'MORE' ? QUESTION_MORE : QUESTION_LESS;
      } else {
        text =
          mode === 'MORE' ? QUESTION_FLOWER_MORE : QUESTION_FLOWER_LESS;
      }

      levels.push({
        id: i + 1,
        leftCount: 1,
        rightCount: 2,
        mode
      });

      subjects.push(subject);
      questions.push(text);
    }

    return { levels, subjects, questions };
  }

  // =============== BẮT ĐẦU MÀN ===============
  private startLevel() {
    if (this.levelIndex >= this.levels.length) {
      this.scene.start('EndGameScene', {
        score: this.score,
        total: this.levels.length
      });
      return;
    }

    const subject = this.levelSubjects[this.levelIndex];

    this.promptText.setText(this.levelQuestions[this.levelIndex]);

    // Điều chỉnh banner theo độ rộng câu hỏi
    const textWidth = this.promptText.width;
    const baseBannerWidth = this.questionBanner.width;
    const padding = 80; // khoảng dư 2 bên text
    const minBannerWidth = 600;
    const desiredWidth = Math.max(minBannerWidth, textWidth + padding);
    const scaleX = desiredWidth / baseBannerWidth;
    const scaleY = BANNER_SCALE * BOARD_SCALE;
    this.questionBanner.setScale(scaleX, scaleY);

    this.girlSprite.setTexture(GIRL_TEXTURE[subject]);
    this.boySprite.setTexture(BOY_TEXTURE[subject]);

    this.leftBtn.setTexture(ANSWER_DEFAULT);
    this.rightBtn.setTexture(ANSWER_DEFAULT);

    this.feedbackText.setText('');
    this.gameState = 'WAIT_CHOICE';
  }

  // ============ XỬ LÝ CHỌN =============
  private handleChoice(side: 'LEFT' | 'RIGHT') {
    if (this.gameState !== 'WAIT_CHOICE') return;
    this.gameState = 'CHECK_CHOICE';

    const level = this.levels[this.levelIndex];
    const chosenCount = side === 'LEFT' ? level.leftCount : level.rightCount;
    const otherCount = side === 'LEFT' ? level.rightCount : level.leftCount;

    const isCorrect =
      level.mode === 'LESS'
        ? chosenCount < otherCount
        : chosenCount > otherCount;

    if (isCorrect) {
      // đã trả lời đúng và chuẩn bị sang màn phụ
      this.subgameEntered = true;

      this.score++;
      // dùng âm thanh thay cho text feedback
      (window as any).playVoiceLocked(this.sound, 'sfx_correct');
      (window as any).playVoiceLocked(this.sound, 'correct');

      const chosenBtn = side === 'LEFT' ? this.leftBtn : this.rightBtn;
      const otherBtn = side === 'LEFT' ? this.rightBtn : this.leftBtn;
      chosenBtn.setTexture(ANSWER_CORRECT);
      otherBtn.setTexture(ANSWER_WRONG);

      // đánh dấu level đã hoàn thành (cho main.ts dùng)
      this.gameState = 'LEVEL_END';

      // BẬT NÚT VIEWPORT HTML
      if ((window as any).setGameButtonsVisible) {
        (window as any).setGameButtonsVisible(true);
      }

      // ❗ CHỈ GỬI levelIndex HIỆN TẠI, KHÔNG +1
      // Tăng delay để âm thanh đúng được phát hết trước khi chuyển màn
      this.time.delayedCall(2000, () => {
        this.scene.start('BalanceScene', {
          leftCount: level.leftCount,
          rightCount: level.rightCount,
          nextScene: 'GameScene',
          score: this.score,
          levelIndex: this.levelIndex,
          subject: this.levelSubjects[this.levelIndex] // 👈 BẮT BUỘC
        });
      });
    } else {
      // dùng âm thanh thay cho text feedback
      
      (window as any).playVoiceLocked(this.sound, 'sfx_wrong');
      (window as any).playVoiceLocked(this.sound, 'wrong');

      const chosenBtn = side === 'LEFT' ? this.leftBtn : this.rightBtn;
      chosenBtn.setTexture(ANSWER_WRONG);

      this.time.delayedCall(700, () => {
        chosenBtn.setTexture(ANSWER_DEFAULT);
        this.feedbackText.setText('');
        this.gameState = 'WAIT_CHOICE';
      });
    }
  }
}
