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
    private objects: Phaser.GameObjects.Image[] = [];
    private correctKeys: string[] = []; 

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.objects = [];
    }

    public getAllObjects() {
        return this.objects;
    }

    /**
     * Tải và tạo các đối tượng từ dữ liệu Level Config.
     * Hỗ trợ cấu trúc mới: mảng config với left/right objects
     * @param configData Dữ liệu JSON config - có thể là array hoặc single object
     */
    public spawnObjectsFromConfig(configData: any) {
        // Xóa cũ nếu có
        this.clearObjects();

        // Xử lý cả trường hợp truyền vào array hoặc single object
        const configs = Array.isArray(configData) ? configData : [configData];
        
        if (configs.length === 0) {
            console.warn("ObjectManager: Config rỗng.");
            return;
        }

        // Spawn từng config
        configs.forEach((config: any) => {
            const { width, height } = this.scene.scale;
            
            // Spawn QES (Question) Object
            if (config.qes) {
                const qesDef = config.qes;
                const qX = qesDef.baseX_pct * width;
                const qY = qesDef.baseY_pct * height;
                const qImg = this.scene.add.image(qX, qY, qesDef.textureKey);
                
                qImg.setData('textureKey', qesDef.textureKey);
                qImg.setData('type', 'question'); // Mark as question
                
                if (qesDef.baseScale) {
                    qImg.setScale(qesDef.baseScale);
                }
                
                this.objects.push(qImg);
            }

            if (config.items && Array.isArray(config.items)) {
                config.items.forEach((item: any) => {
                    const x = item.baseX_pct * width;
                    const y = item.baseY_pct * height;
                    const img = this.scene.add.image(x, y, item.textureKey);
                    
                    img.setData('textureKey', item.textureKey);
                    img.setData('id', item.id); // ⭐ Đánh dấu id (thay cho side)
                    img.setData('isCorrect', item.isCorrect); // ⭐ Đánh dấu đáp án từ config
                    img.setData('type', 'answer'); // Mark as potential answer
                    
                    if (item.baseScale) {
                        img.setScale(item.baseScale);
                    }
                    
                    this.objects.push(img);
                });
            }
        });

        console.log(`ObjectManager: Đã tạo ${this.objects.length} đối tượng từ ${configs.length} config(s).`);
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
        const isCorrect = object.getData('isCorrect');
        return isCorrect === false; // Chỉ trả true nếu rõ ràng là false
    }

    /**
     * Kiểm tra xem object có phải đáp án đúng không
     */
    public isCorrectAnswer(object: Phaser.GameObjects.Image): boolean {
        const isCorrect = object.getData('isCorrect');
        return isCorrect === true; // Chỉ trả true nếu rõ ràng là true
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
                yoyo: true,
                onComplete: () => obj.clearTint()
            });
        });
    }

    /**
     * Xác định object id
     * @param obj Object cần kiểm tra
     * @returns id string | null
     */
    public getObjectId(obj: Phaser.GameObjects.Image): string | null {
        return obj.getData('id') || null;
    }

    /**
     * Xóa tất cả objects (dùng khi chuyển level)
     */
    public clearAllObjects() {
        this.objects.forEach(obj => obj.destroy());
        this.objects = [];
        this.correctKeys = [];
        console.log("ObjectManager: Đã xóa tất cả objects.");
    }

    public clearObjects() {
        this.objects.forEach(obj => obj.destroy());
        this.objects = [];
    }
}
