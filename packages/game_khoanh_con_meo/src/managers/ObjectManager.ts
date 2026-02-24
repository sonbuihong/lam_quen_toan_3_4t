import Phaser from 'phaser';

/**
 * Quản lý các đối tượng trong game (ObjectManager).
 * Nhiệm vụ:
 * 1. Tạo (Spawn) các đối tượng từ file config.
 * 2. Cung cấp danh sách đối tượng.
 * 3. Kiểm tra đối tượng nào nằm trong vùng chọn (Polygon).
 */
export class ObjectManager {
    private scene: Phaser.Scene;
    private objects: Phaser.GameObjects.Image[] = [];      // Tất cả object (images + answers)
    private imageObjects: Phaser.GameObjects.Image[] = []; // Chỉ các hình cần khoanh
    private answerObjects: Phaser.GameObjects.Image[] = []; // Chỉ các ảnh đáp án
    private correctKeys: string[] = []; 

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.objects = [];
        this.imageObjects = [];
        this.answerObjects = [];
    }

    public getAllObjects() {
        return this.objects;
    }

    /** Trả về chỉ các hình cần khoanh (không bao gồm ảnh đáp án phía dưới) */
    public getImageObjects() {
        return this.imageObjects;
    }

    /** Trả về chỉ các ảnh đáp án (không bao gồm hình cần khoanh) */
    public getAnswerObjects() {
        return this.answerObjects;
    }

    /**
     * Tải và tạo các đối tượng từ dữ liệu Level Config.
     * @param configData Dữ liệu JSON config của level
     */
    public spawnObjectsFromConfig(configData: any) {
        // Xóa cũ nếu có
        this.clearObjects();

        if (!configData || !configData.images) {
            console.warn("ObjectManager: Không tìm thấy config objects.");
            return;
        }
        
        // Lưu key đáp án đúng (xử lý cả string và array)
        if (Array.isArray(configData.correctKey)) {
             this.correctKeys = configData.correctKey;
        } else if (typeof configData.correctKey === 'string') {
             this.correctKeys = [configData.correctKey];
        } else {
             this.correctKeys = [];
        }

        // Spawn các hình cần khoanh (images)
        configData.images.forEach((def: any) => {
             let key = def.textureKey;
             const { width, height } = this.scene.scale;
             const x = def.baseX_pct * width;
             const y = def.baseY_pct * height;
             
             const img = this.scene.add.image(x, y, key);
             img.setData('textureKey', key);
             img.setData('isTarget', true);
             if (def.baseScale) img.setScale(def.baseScale);

             // Lưu vào cả 2 mảng: objects (tất cả) và imageObjects (chỉ hình khoanh)
             this.imageObjects.push(img);
             this.objects.push(img);
        });

        // Spawn các ảnh đáp án (answers) - lưu vào objects VÀ answerObjects
        if (configData.answers) {
            configData.answers.forEach((def: any) => {
                 let key = def.textureKey;
                 const { width, height } = this.scene.scale;
                 const x = def.baseX_pct * width;
                 const y = def.baseY_pct * height;
                 
                 const img = this.scene.add.image(x, y, key);
                 img.setData('textureKey', key);
                 img.setData('isTarget', false);
                 if (def.baseScale) img.setScale(def.baseScale);

                 this.objects.push(img);
                 this.answerObjects.push(img); // Lưu riêng để Scene2 truy cập
            });
        }

        console.log(`ObjectManager: ${this.imageObjects.length} hình khoanh, ${this.objects.length - this.imageObjects.length} đáp án. Correct Keys: ${this.correctKeys.join(', ')}`);
    }
    
    /**
     * Kiểm tra xem những đối tượng nào nằm trong vùng chọn.
     * @param polygon Vùng chọn (Phaser.Geom.Polygon)
     * @returns Danh sách các đối tượng nằm bên trong
     */
    public getObjectsInPolygon(polygon: Phaser.Geom.Polygon): Phaser.GameObjects.Image[] {
        const selectedObjects: Phaser.GameObjects.Image[] = [];

        this.objects.forEach(obj => {
            // Kiểm tra tâm của object
            // Có thể mở rộng kiểm tra bounding box nếu cần chính xác hơn
            if (Phaser.Geom.Polygon.Contains(polygon, obj.x, obj.y)) {
                selectedObjects.push(obj);
            }
        });

        return selectedObjects;
    }

    /**
     * Tính phần trăm overlap giữa polygon và bounding box của object
     * @param polygon Vùng vẽ
     * @param object Object cần kiểm tra
     * @returns Phần trăm overlap (0-1)
     */
    public getOverlapPercentage(polygon: Phaser.Geom.Polygon, object: Phaser.GameObjects.Image): number {
        // Lấy bounding box của object
        const objBounds = new Phaser.Geom.Rectangle(
            object.x - object.displayWidth / 2,
            object.y - object.displayHeight / 2,
            object.displayWidth,
            object.displayHeight
        );
        
        const objArea = objBounds.width * objBounds.height;
        if (objArea === 0) return 0;

        // Kiểm tra overlap bằng cách lấy 4 góc + tâm + các điểm trên cạnh
        const testPoints: Phaser.Math.Vector2[] = [
            // 4 góc
            new Phaser.Math.Vector2(objBounds.left, objBounds.top),
            new Phaser.Math.Vector2(objBounds.right, objBounds.top),
            new Phaser.Math.Vector2(objBounds.left, objBounds.bottom),
            new Phaser.Math.Vector2(objBounds.right, objBounds.bottom),
            // Tâm
            new Phaser.Math.Vector2(object.x, object.y),
            // Các điểm giữa cạnh
            new Phaser.Math.Vector2((objBounds.left + objBounds.right) / 2, objBounds.top),
            new Phaser.Math.Vector2((objBounds.left + objBounds.right) / 2, objBounds.bottom),
            new Phaser.Math.Vector2(objBounds.left, (objBounds.top + objBounds.bottom) / 2),
            new Phaser.Math.Vector2(objBounds.right, (objBounds.top + objBounds.bottom) / 2),
        ];

        // Đếm bao nhiêu điểm nằm trong polygon
        let pointsInside = 0;
        testPoints.forEach(point => {
            if (Phaser.Geom.Polygon.Contains(polygon, point.x, point.y)) {
                pointsInside++;
            }
        });

        // Tính phần trăm dựa trên số điểm nằm trong
        const overlapPercentage = pointsInside / testPoints.length;
        return overlapPercentage;
    }

    /**
     * Lấy object đáp án đúng
     */
    public getCorrectObject(): Phaser.GameObjects.Image | undefined {
        return this.objects.find(obj => this.isCorrectAnswer(obj));
    }

    /**
     * Lấy object đáp án sai
     */
    public getWrongObject(): Phaser.GameObjects.Image | undefined {
        return this.objects.find(obj => this.isWrongAnswer(obj));
    }

    /**
     * Kiểm tra xem object có phải đáp án sai không
     */
    public isWrongAnswer(object: Phaser.GameObjects.Image): boolean {
        const key = object.getData('textureKey');
        return !this.correctKeys.includes(key);
    }

    /**
     * Kiểm tra xem object có phải đáp án đúng không
     */
    public isCorrectAnswer(object: Phaser.GameObjects.Image): boolean {
        const key = object.getData('textureKey');
        return this.correctKeys.includes(key);
    }

    /**
     * Hiệu ứng khi chọn đúng/sai (Visual Feedback)
     */
    public highlightObjects(objects: Phaser.GameObjects.Image[], isCorrect: boolean) {
        objects.forEach(obj => {
            this.scene.tweens.add({
                targets: obj,
                scale: obj.scale * 1.2,
                duration: 200,
                yoyo: true
            });
        });
    }

    public clearObjects() {
        this.objects.forEach(obj => obj.destroy());
        this.objects = [];
        this.imageObjects = [];
        this.answerObjects = [];
    }
}
