import Phaser from 'phaser';
import { ObjectManager } from '../managers/ObjectManager';

export interface LassoResult {
    success: boolean;
    failureReason?: string;
    selectedObjects: Phaser.GameObjects.GameObject[];
}

export class LassoValidation {
    /**
     * Xác thực logic khoanh vùng
     * @param polygon Hình đa giác do người chơi vẽ
     * @param objectManager Quản lý đối tượng trong game
     * @returns Kết quả xác thực (thành công/thất bại, lý do, danh sách object đã chọn)
     */
    static validateSelection(polygon: Phaser.Geom.Polygon, objectManager: ObjectManager): LassoResult {
        // 1. Lấy danh sách đối tượng trong vùng chọn
        const selectedObjects = objectManager.getObjectsInPolygon(polygon);
        
        console.log(`[LassoValidation] Đã khoanh trúng: ${selectedObjects.length} đối tượng.`);

        // 2. Phân loại: bao nhiêu hình đúng / sai đã bị khoanh vào
        // Quan trọng: Chỉ tính trên getImageObjects() (hình cần khoanh),
        // không dùng getAllObjects() vì sẽ đếm nhầm ảnh đáp án phía dưới
        const imageObjects = objectManager.getImageObjects();
        const totalCorrectCount = imageObjects.filter(obj => objectManager.isCorrectAnswer(obj)).length;

        const selectedCorrect = selectedObjects.filter(obj => objectManager.isCorrectAnswer(obj));
        // Chỉ tính là sai nếu khùm lại hình không phải hình cần khoanh VÀ có dữ liệu isTarget=true
        const selectedWrong = selectedObjects.filter(
            obj => !objectManager.isCorrectAnswer(obj) && (obj as Phaser.GameObjects.Image).getData('isTarget') === true
        );

        console.log(`[LassoValidation] Đúng trong vùng: ${selectedCorrect.length}/${totalCorrectCount}, Sai trong vùng: ${selectedWrong.length}`);

        let isSuccess = false;
        let failureReason = "";

        // Điều kiện thành công:
        // - Khoanh ĐÚNG TẤT CẢ hình đúng (không thiếu cái nào)
        // - Không khoanh vào bất kỳ hình sai nào
        if (selectedWrong.length > 0) {
            failureReason = `Khoanh trúng ${selectedWrong.length} hình sai!`;
        } else if (selectedCorrect.length < totalCorrectCount) {
            failureReason = `Cần khoanh tất cả ${totalCorrectCount} hình đúng! Mới khoanh được ${selectedCorrect.length}.`;
        } else if (selectedCorrect.length === 0) {
            failureReason = "Không khoanh trúng hình nào!";
        } else {
            // Khoanh đúng tất cả và không dính hình sai
            isSuccess = true;
        }

        return {
            success: isSuccess,
            failureReason: failureReason,
            selectedObjects: selectedObjects
        };
    }
}
