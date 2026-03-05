import { game } from "@iruka-edu/mini-game-sdk";

export function getFixedSubmitData() {
    const data = game.prepareSubmitData();
    if (data && Array.isArray((data as any).items)) {
        (data as any).items.forEach((item: any) => {
            if (item.expected) {
                if (item.expected.item_id_override) {
                    item.item_id = item.expected.item_id_override;
                }
                if (item.expected.item_type_override) {
                    item.item_type = item.expected.item_type_override;
                }
            }
        });
    }
    return data;
}

export function getFixedStatsSnapshot() {
    const data = game.getStatsSnapshot();
    if (data && Array.isArray((data as any).items)) {
        (data as any).items.forEach((item: any) => {
            if (item.expected) {
                if (item.expected.item_id_override) {
                    item.item_id = item.expected.item_id_override;
                }
                if (item.expected.item_type_override) {
                    item.item_type = item.expected.item_type_override;
                }
            }
        });
    }
    return data;
}
