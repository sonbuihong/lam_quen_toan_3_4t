# README — Tích hợp Iruka Mini-game SDK cho game **Khoanh chọn (circle_select)** (cầm tay chỉ việc)

> Mục tiêu: người mới nhìn README là **copy–paste được**, biết **chèn code ở đâu**, theo đúng **luồng hoạt động của game**.

Bạn đang có:
- Game Phaser `Scene1`
- Vẽ lasso bằng `LassoManager`
- Chấm đúng/sai bằng `LassoValidation.validateSelection()`
- SDK có tracker: `game.createCircleSelectTracker()`

README này sẽ hướng dẫn bạn “cắm” SDK vào game theo **5 điểm** trong luồng:
1) Tạo tracker (tạo item) khi vào level/scene  
2) Mở attempt khi bắt đầu vẽ (stroke start)  
3) Đóng attempt khi thả tay (stroke end)  
4) Ghi hint (khi showHint/tutorial)  
5) Finalize / Quit (khi win / chuyển scene / restart / shutdown)

---

## 0) Chuẩn data cần ra (để bạn biết mình đang làm đúng)

SDK cần ra `items[]` kiểu:

- `expected` phải có:
  - `selectables`: danh sách id các object có thể khoanh
  - `correct_targets`: danh sách id mục tiêu đúng
  - `min_enclosure_ratio`: min coverage (0–1)

- `history[]`: mỗi lần khoanh = 1 attempt:
  - `started_at_ms`, `ended_at_ms`, `time_spent_ms`
  - `response`: `path_length_px`, `enclosed_ids`, `enclosure_ratio`
  - `is_correct`, `error_code`, `hint_used`

- `hint_used` ở item = tổng hint của item  
- `hint_used` ở attempt = hint trong attempt đó

---

## 1) Fix bắt buộc để **hint_used trong attempt** có dữ liệu (nếu bạn thấy attempt hint luôn = 0)

### Triệu chứng
Bạn log thấy:
- `item.hint_used = 1`
- nhưng `history[].hint_used = 0`
- attempt nhảy số 1,2,4...
- attempt đúng mà `error_code` lại `"SYSTEM_ERROR"`

### Nguyên nhân
Game gọi `tracker.hint()` khi tracker chưa mở attempt → `itemsCore.useHint()` tự mở attempt kiểu “attempt ma”. Sau đó tracker mở attempt lần nữa → attempt trước bị bỏ qua hoặc lệch.

### Fix chuẩn (copy nguyên file này) ** không cần tạo trong dự án của bạn **
**Sửa file SDK**: `src/core/game/trackers/circleSelectTracker.ts`

```ts
// src/core/game/trackers/circleSelectTracker.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { type ItemMeta, type ItemResult, type ErrorCode } from "../items";
import { createBaseTracker, nowMs, openAttempt, endAttemptWithEval, type BaseTracker } from "./common";

type CircleExpected = { correct_targets?: string[]; min_enclosure_ratio?: number; [k: string]: any };
type CircleResponse = { enclosed_ids?: string[]; enclosure_ratio?: Record<string, number>; [k: string]: any };

export function createCircleSelectTracker(opts: {
  meta: ItemMeta;
  expected: CircleExpected;
}): BaseTracker & {
  onStrokeStart: (ts?: number) => void;
  onStrokeEnd: (
    response: CircleResponse,
    ts?: number,
    evalOverride?: { isCorrect?: boolean; errorCode?: ErrorCode | null }
  ) => void;
  onQuit: (ts?: number) => void;
  onTimeout: (ts?: number) => void;
  finalize: () => ItemResult;
} {
  const { handle, base } = createBaseTracker({ meta: { ...opts.meta, item_type: "circle_select" }, expected: opts.expected });

  let attemptOpen = false;
  let attemptOpenedAt: number | null = null;
  let strokeStartedAt: number | null = null;

  function ensureAttempt(ts = nowMs()) {
    if (!attemptOpen) {
      attemptOpenedAt = ts;
      openAttempt(handle, { started_at_ms: ts });
      attemptOpen = true;
    }
  }

  function judge(r: CircleResponse): { ok: boolean; code: ErrorCode | null } {
    const targets = Array.isArray(opts.expected?.correct_targets) ? opts.expected.correct_targets : [];
    const enclosed = Array.isArray(r?.enclosed_ids) ? r.enclosed_ids : [];

    const missing = targets.some((t) => !enclosed.includes(t));
    if (missing) return { ok: false, code: "MISSING_TARGET" as any };

    const min = typeof opts.expected?.min_enclosure_ratio === "number" ? opts.expected.min_enclosure_ratio : 0;
    const ratio = r?.enclosure_ratio ?? {};
    const bad = targets.some((t) => typeof ratio?.[t] === "number" && ratio[t] < min);
    if (bad) return { ok: false, code: "LOW_COVERAGE" };

    return { ok: true, code: null };
  }

  function close(
    ts = nowMs(),
    kind: "normal" | "quit" | "timeout",
    response?: any,
    evalRes?: { ok: boolean; code: ErrorCode | null }
  ) {
    ensureAttempt(attemptOpenedAt ?? ts);

    const endedAt = ts;
    const resp = response ?? {};
    const isCorrect = kind === "normal" ? (evalRes?.ok ?? false) : false;

    // ✅ đúng -> error_code phải null
    const normalCode = (evalRes?.code ?? null) as any;

    const errorCode: ErrorCode | null =
      kind === "timeout" ? "TIMEOUT" :
      kind === "quit" ? "USER_ABANDONED" :
      normalCode;

    // ✅ time_spent ưu tiên từ strokeStart
    const start = strokeStartedAt ?? attemptOpenedAt ?? ts;

    endAttemptWithEval(handle, resp, {
      timingExtra: {
        started_at_ms: start,
        ended_at_ms: endedAt,
        time_spent_ms: Math.max(0, endedAt - start),
      },
      isCorrect,
      errorCode,
    });

    attemptOpen = false;
    attemptOpenedAt = null;
    strokeStartedAt = null;
  }

  return {
    ...base,

    // ✅ QUAN TRỌNG: hint luôn ensureAttempt
    hint(count = 1) {
      ensureAttempt(nowMs());
      base.hint(count);
    },

    onStrokeStart(ts = nowMs()) {
      ensureAttempt(ts);
      strokeStartedAt = ts;
    },

    onStrokeEnd(response, ts = nowMs(), evalOverride) {
      const e =
        evalOverride?.isCorrect !== undefined || evalOverride?.errorCode !== undefined
          ? { ok: !!evalOverride?.isCorrect, code: (evalOverride?.errorCode ?? null) as any }
          : judge(response);

      close(ts, "normal", response, e);
    },

    onQuit(ts = nowMs()) { close(ts, "quit", {}); },
    onTimeout(ts = nowMs()) { close(ts, "timeout", {}); },

    finalize() {
      if (attemptOpen) close(nowMs(), "quit", {});
      return base.finalize();
    },
  };
}
````

---

## 2) Luồng hoạt động của game khoanh chọn (để biết “cắm” ở đâu)

Luồng game của bạn (Scene1) theo thứ tự:

1. `create()`

   * setup hệ thống, spawn objects, setup input, start timer…
2. Người chơi chạm màn hình (pointerdown)

   * nếu đang intro: bắt đầu gameplay
   * nếu đang chơi: reset idle, dừng hint
   * **(đây là lúc bé bắt đầu vẽ lasso)** → gọi `onStrokeStart`
3. Người chơi vẽ xong → `LassoManager.onLassoComplete(polygon)`

   * bạn gọi `handleLassoSelection(polygon)`
   * **(đây là lúc thả tay kết thúc 1 lần khoanh)** → gọi `onStrokeEnd`
4. Nếu đúng

   * recordCorrect + finalizeAttempt + chuyển EndGame
   * **(đây là lúc finalize item)**
5. Nếu sai

   * recordWrong + cho thử lại
6. Idle → showHint

   * **(đây là lúc ghi hint)**

---

## 3) 5 điểm cắm vào code Scene1 (có chỉ rõ vị trí)

### 3.1 Điểm cắm #1 — Tạo tracker (tạo item) trong `create()`

✅ Chèn vào `create()` **sau spawn objects** (vì phải biết list object để làm `selectables`)

**Vị trí trong code bạn**: ngay sau dòng:

```ts
this.objectManager.spawnObjectsFromConfig(levelConfig);
```

**Thêm code:**

```ts
// SDK Integration (circle_select item)
game.setTotal(1);               // bạn đã có
game.startQuestionTimer();      // bạn đã có

// ===== (1) TẠO TRACKER Ở ĐÂY =====
this.__sdkInitCircleSelectItem();
```

Và bạn cần thêm function helper trong class:

```ts
// ===== SDK STATE =====
private runSeq = 1;
private itemSeq = 0;
private circleTracker: ReturnType<typeof game.createCircleSelectTracker> | null = null;

private __sdkInitCircleSelectItem() {
  // nếu scene recreate mà chưa finalize item cũ
  this.__sdkFinalizeAsQuit();

  this.itemSeq += 1;

  // 1) Build selectables IDs (bắt buộc ổn định)
  const allObjects = this.objectManager.getAllObjects();

  const selectables = allObjects.map((obj, idx) => {
    // ưu tiên name nếu có, fallback texture+idx
    return (obj as any).name ?? `${(obj as any).texture?.key ?? "obj"}_${idx}`;
  });

  // 2) Chỉ định target đúng (ví dụ bóng)
  // bạn đang tìm đúng bằng texture key S1_Ball -> ta tạo id tương ứng
  // Nếu object đúng có name "ball_0" thì dùng đúng string đó luôn
  const correct_targets = ["ball_0"];

  this.circleTracker = game.createCircleSelectTracker({
    meta: {
      item_id: `CIRCLE_SELECT_${this.itemSeq}`,
      item_type: "circle_select",
      seq: this.itemSeq,
      run_seq: this.runSeq,
      difficulty: 1,
      scene_id: "SCN_CIRCLE_01",
      scene_seq: 1,
      scene_type: "circle_select",
      skill_ids: ["khoanh_chon_34_math_004"],
    },
    expected: {
      selectables,
      correct_targets,
      min_enclosure_ratio: 0.8,
    },
  });
}
```

> Lưu ý: `correct_targets` phải match ID bạn trả về trong `response.enclosed_ids`.

---

### 3.2 Điểm cắm #2 — Mở attempt khi bắt đầu vẽ (stroke start)

Bạn đang lắng nghe `pointerdown` trong `setupInput()`.

✅ Chèn vào `setupInput()` **sau khi xử lý intro** và trước khi game logic khác.

**Vị trí trong code bạn**: trong `setupInput()` đoạn:

```ts
this.input.on('pointerdown', () => {
  if (this.isWaitingForIntroStart) { ... return; }

  this.idleManager.reset();
  this.stopIntro();
  this.stopActiveHint();
});
```

**Thêm 1 dòng gọi SDK:**

```ts
this.input.on('pointerdown', () => {
  if (this.isWaitingForIntroStart) {
    // ... code intro ...
    this.playIntroSequence();
    return;
  }

  // ===== (2) STROKE START Ở ĐÂY =====
  this.circleTracker?.onStrokeStart?.(Date.now());

  this.idleManager.reset();
  this.stopIntro();
  this.stopActiveHint();
});
```

> Tại sao đặt ở đây?
> Vì game của bạn bắt đầu thao tác vẽ bằng touch, `pointerdown` là mốc phù hợp nhất để ghi `started_at_ms`.

---

### 3.3 Điểm cắm #3 — Đóng attempt khi thả tay (stroke end)

Bạn đã có:

```ts
this.lassoManager.onLassoComplete = (polygon) => {
  this.handleLassoSelection(polygon);
};
```

✅ Chèn vào `handleLassoSelection()` **ngay sau khi có result**.

**Trong `handleLassoSelection(polygon)`**, bạn đang có:

```ts
const result = LassoValidation.validateSelection(polygon, this.objectManager);
const selectedObjects = result.selectedObjects;
const isSuccess = result.success;
```

**Thêm đoạn build response + gọi SDK:**

```ts
// ===== (3) STROKE END Ở ĐÂY =====
const ts = Date.now();

// map selected objects -> enclosed_ids (phải trùng id trong expected)
const enclosed_ids = (selectedObjects ?? []).map((obj: any, idx: number) => {
  return obj.name ?? `${obj.texture?.key ?? "obj"}_${idx}`;
});

// enclosure_ratio: nếu chưa tính ratio thật, tạm fill 1.0 cho các obj được khoanh
const enclosure_ratio: Record<string, number> = {};
for (const id of enclosed_ids) enclosure_ratio[id] = 1;

// path_length_px: nếu LassoManager có API lấy length thì dùng, không có thì 0
const path_length_px = (this.lassoManager as any).getPathLengthPx?.() ?? 0;

// nếu bạn muốn tracker tự judge => bỏ evalOverride
// (newbie dễ làm đúng: override theo result.success)
this.circleTracker?.onStrokeEnd?.(
  { path_length_px, enclosed_ids, enclosure_ratio },
  ts,
  isSuccess ? { isCorrect: true, errorCode: null } : { isCorrect: false, errorCode: "WRONG_TARGET" as any }
);
```

> Đặt ở đây vì: `onLassoComplete` là mốc “kết thúc 1 attempt” đúng nhất.

---

### 3.4 Điểm cắm #4 — Hint khi idle / tutorial

Bạn đang có `showHint()`:

```ts
private showHint() {
  game.addHint();
  // ...
}
```

✅ Thêm 1 dòng gọi tracker:

```ts
private showHint() {
  game.addHint();

  // ===== (4) HINT Ở ĐÂY =====
  this.circleTracker?.hint?.(1);

  // ... phần audio + visual hint của bạn ...
}
```

> Sau patch tracker, `hint_used` sẽ nằm trong attempt hiện tại (không còn rơi vào “attempt ma”).

---

### 3.5 Điểm cắm #5 — Finalize / Quit (win / shutdown / restart)

#### 5A) Khi WIN (đúng)

Bạn đang xử lý đúng ở `if (isSuccess) { ... }` và có:

```ts
game.finalizeAttempt();
```

✅ Trước `finalizeAttempt()`, finalize item:

```ts
// ===== (5A) FINALIZE ITEM TRƯỚC KHI FINALIZE SESSION =====
this.circleTracker?.finalize?.();
this.circleTracker = null;

// --- GAME HUB COMPLETE ---
game.finalizeAttempt();
```

#### 5B) Khi scene shutdown (thoát giữa chừng)

Trong `shutdown()` của bạn, thêm gọi quit+finalize:

```ts
shutdown() {
  // ... cleanup ...

  // ===== (5B) QUIT + FINALIZE NẾU THOÁT GIỮA CHỪNG =====
  this.__sdkFinalizeAsQuit();
}
```

Thêm helper này trong class:

```ts
private __sdkFinalizeAsQuit() {
  const ts = Date.now();
  if (this.circleTracker) {
    this.circleTracker.onQuit?.(ts);
    this.circleTracker.finalize?.();
  }
  this.circleTracker = null;
}
```

#### 5C) Khi restart

Trong `init(data?.isRestart)` bạn đang gọi `game.retryFromStart()`.

✅ Trước khi retry, quit item + tăng runSeq:

```ts
if (data?.isRestart) {
  this.__sdkFinalizeAsQuit();
  this.runSeq += 1;
  this.itemSeq = 0;

  if (!data.fromEndGame) {
    game.retryFromStart();
  }
}
```

---

## 4) Bản “diff” siêu ngắn: người mới copy theo từng đoạn

### 4.1 Thêm state SDK vào class

```ts
private runSeq = 1;
private itemSeq = 0;
private circleTracker: ReturnType<typeof game.createCircleSelectTracker> | null = null;
```

### 4.2 Thêm helper init item

```ts
private __sdkInitCircleSelectItem() { ... }
```

### 4.3 Thêm helper quit+finalize

```ts
private __sdkFinalizeAsQuit() { ... }
```

### 4.4 create(): gọi init item sau spawn

```ts
this.objectManager.spawnObjectsFromConfig(levelConfig);
this.__sdkInitCircleSelectItem();
```

### 4.5 pointerdown: gọi onStrokeStart

```ts
this.circleTracker?.onStrokeStart?.(Date.now());
```

### 4.6 handleLassoSelection: gọi onStrokeEnd

```ts
this.circleTracker?.onStrokeEnd?.({ path_length_px, enclosed_ids, enclosure_ratio }, Date.now(), ...);
```

### 4.7 showHint: gọi hint

```ts
this.circleTracker?.hint?.(1);
```

### 4.8 win: finalize item trước finalizeAttempt

```ts
this.circleTracker?.finalize?.();
this.circleTracker = null;
game.finalizeAttempt();
```

### 4.9 shutdown/restart: quit finalize

```ts
this.__sdkFinalizeAsQuit();
```

---

## 5) Debug nhanh (nếu vẫn lệch)

### Check 1: ID có match không?

* `expected.correct_targets` phải đúng y chang string trong `response.enclosed_ids`.
* Nếu bạn thấy `correct_targets: ["ball_0"]` mà enclosed trả `"ball2_1"` → sai target là đúng.

### Check 2: hint trong attempt có chạy chưa?

* Gọi `showHint()` xong, attempt hiện tại phải có `hint_used > 0`.
* Nếu attempt chưa mở mà bạn gọi hint → tracker patch ở trên sẽ tự mở attempt đúng cách.

### Check 3: attempt có nhảy số không?

* Nếu bạn thấy 1,2,4: có “attempt ma” do hint mở attempt kiểu khác → patch tracker fix.

---

## 6) Ví dụ output đúng (khi có hint)

```json
{
  "item_id": "CIRCLE_SELECT_1",
  "item_type": "circle_select",
  "expected": {
    "selectables": ["ball_0","ball2_1"],
    "correct_targets": ["ball_0"],
    "min_enclosure_ratio": 0.8
  },
  "history": [
    {
      "attempt": 1,
      "started_at_ms": 1735612900000,
      "ended_at_ms": 1735612903500,
      "time_spent_ms": 3500,
      "response": {
        "path_length_px": 180,
        "enclosed_ids": ["ball2_1"],
        "enclosure_ratio": { "ball2_1": 0.88 }
      },
      "is_correct": false,
      "error_code": "WRONG_TARGET",
      "hint_used": 1
    }
  ],
  "hint_used": 1
}
```

---

## 7) Kết luận: “cắm” ở đâu trong luồng?

* **create() sau spawn** → tạo tracker + expected
* **pointerdown khi đang chơi** → mở attempt (stroke start)
* **lasso complete** → đóng attempt (stroke end)
* **showHint / tutorial** → tracker.hint()
* **win / shutdown / restart** → finalize hoặc quit+finalize

