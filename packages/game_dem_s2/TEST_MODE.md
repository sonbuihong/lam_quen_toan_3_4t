# Test Mode Guide - Voice Session APIs

## 📋 Tổng quan

Test Mode cho phép kiểm tra các hoạt động cơ bản của Voice Session APIs **mà không ảnh hưởng đến data production**:

- ✅ Không trừ quota thực
- ✅ Không lưu GameSession vào DB
- ✅ Không log behavior violations
- ✅ Không trigger ban
- ✅ Không log behavior violations
- ✅ Không trigger ban
- ✅ Không bảo mật access token (Optional Auth)

**Vẫn thực hiện:**

- ✅ Gọi AI Engine thật
- ✅ Validate input data
- ✅ Check ban status (chỉ check, không ghi log)
- ✅ Check quota (chỉ check, không trừ)
- ✅ **Redis cache operations đầy đủ** (create, read, update, delete)
- ✅ Return debug info chi tiết

---

## 🔧 Cách kích hoạt Test Mode

### Option 1: Query Parameter (Recommended)

```bash
POST /api/v1/voice-sessions/start?testmode=true
# Authorization header is OPTIONAL
```

### Option 2: Request Body

```json
{
  "childId": "learner_123",
  "gameId": "game_001",
  "lessonId": "lesson_abc",
  "gameVersion": "1.0.0",
  "gameType": "NURSERY_RHYME",
  "testmode": true
}
```

---

## 📝 Test Cases Chi Tiết

### Test Case 1: Start Session - New Session (NURSERY_RHYME)

**Mục đích:** Kiểm tra tạo Redis cache key đúng format và khởi tạo structure cho game multi-question.

**Request:**

```bash
POST /api/v1/voice-sessions/start?testmode=true
# Authorization: Bearer <token> (OPTIONAL)
Content-Type: application/json

{
  "childId": "learner_12345",
  "gameId": "game_nursery_rhyme_01",
  "lessonId": "lesson_abc_123",
  "gameVersion": "1.0.2",
  "gameType": "NURSERY_RHYME"
}
```

**Backend Processing:**

1. ✅ Check ban status (không log)
2. ✅ Check quota (không trừ - Mock 100 quota for test user)
3. ✅ Generate session_id: `uuid.uuid4()`
4. ✅ Generate Redis key: `{childId}#{sessionId}#{ageLevel}`
5. ✅ Create cache structure:

   ```python
   {
     "tokens": {"totalInput": 0, "totalOutput": 0},
     "gameType": "NURSERY_RHYME",
     "data": {"results": []}  # Empty array cho multi-question
   }
   ```

6. ✅ Save to Redis
7. ✅ Return response với debugInfo

**Response (200 OK):**

```json
{
  "sessionId": "sess_550e8400-e29b-41d4-a716-446655440000",
  "allowPlay": true,
  "index": 0,
  "quotaRemaining": 100,
  "message": "Session started successfully",
  "testMode": true,
  "debugInfo": {
    "redisKey": "learner_12345#sess_550e8400-e29b-41d4-a716-446655440000#3-4",
    "cacheCreated": true,
    "cacheStructure": {
      "tokens": {
        "totalInput": 0,
        "totalOutput": 0
      },
      "gameType": "NURSERY_RHYME",
      "data": {
        "results": []
      }
    },
    "quotaCheckPassed": true,
    "banCheckPassed": true,
    "wasLastQuota": false,
    "resumedSession": null
  }
}
```

**Validate:**

- ✅ `redisKey` có format đúng: `childId#sessionId#ageLevel`
- ✅ `cacheCreated = true`
- ✅ `cacheStructure.gameType = "NURSERY_RHYME"`
- ✅ `cacheStructure.data.results` là array rỗng
- ✅ `index = 0` (session mới)
- ✅ `quotaRemaining` = 100 (Mock value for test user)

---

### Test Case 2: Start Session - New Session (COUNTING)

**Mục đích:** Kiểm tra khởi tạo structure cho game single-session.

**Request:**

```bash
POST /api/v1/voice-sessions/start?testmode=true
# Authorization: Bearer <token> (OPTIONAL)

{
  "childId": "learner_12345",
  "gameId": "game_counting_01",
  "lessonId": "lesson_count_1_10",
  "gameVersion": "1.0.0",
  "gameType": "COUNTING"
}
```

**Backend Processing:**

```python
# Cache structure cho COUNTING
cache_data = {
  "tokens": {"totalInput": 0, "totalOutput": 0},
  "gameType": "COUNTING",
  "data": {}  # Empty object, sẽ có "result" khi submit
}
```

**Response:**

```json
{
  "sessionId": "sess_8fa3e210-b29c-41d4-a716-556677889900",
  "allowPlay": true,
  "index": 0,
  "quotaRemaining": 100,
  "message": "Session started successfully",
  "testMode": true,
  "debugInfo": {
    "redisKey": "learner_12345#sess_8fa3e210-b29c-41d4-a716-556677889900#3-4",
    "cacheCreated": true,
    "cacheStructure": {
      "tokens": {"totalInput": 0, "totalOutput": 0},
      "gameType": "COUNTING",
      "data": {}
    },
    "quotaCheckPassed": true,
    "banCheckPassed": true
  }
}
```

**Validate:**

- ✅ `cacheStructure.gameType = "COUNTING"`
- ✅ `cacheStructure.data` là object rỗng (không phải array)

---

### Test Case 3: Session Resume - Có phiên dở

**Mục đích:** Kiểm tra logic resume session khi bé rớt mạng/thoát giữa chừng.

**Setup:**

1. Đã có session trong Redis với 3 results
2. Gọi start lại với cùng `childId`

**Request:**

```bash
POST /api/v1/voice-sessions/start?testmode=true
# Authorization: Bearer <token> (OPTIONAL)

{
  "childId": "learner_12345",
  "gameId": "game_nursery_rhyme_01",
  "lessonId": "lesson_abc_123",
  "gameVersion": "1.0.2",
  "gameType": "NURSERY_RHYME"
}
```

**Backend Processing:**

1. ✅ Check quota: `current_usage = 9, limit = 10` → last quota
2. ✅ Scan Redis: Found existing key `learner_12345#sess_old_123#3-4`
3. ✅ Read cache:

   ```python
   existing_cache = {
     "tokens": {"totalInput": 3750, "totalOutput": 1740},
     "gameType": "NURSERY_RHYME",
     "data": {
       "results": [
         {"index": 1, "score": 85, ...},
         {"index": 2, "score": 90, ...},
         {"index": 3, "score": 88, ...}
       ]
     }
   }
   ```

4. ✅ Calculate index: `len(results) = 3`
5. ✅ Return existing session

**Response:**

```json
{
  "sessionId": "sess_old_123",
  "allowPlay": true,
  "index": 3,
  "quotaRemaining": 0,
  "message": "Session resumed successfully",
  "testMode": true,
  "debugInfo": {
    "redisKey": "learner_12345#sess_old_123#3-4",
    "cacheCreated": false,
    "resumedSession": true,
    "existingData": {
      "gameType": "NURSERY_RHYME",
      "resultsCount": 3,
      "totalTokens": {
        "totalInput": 3750,
        "totalOutput": 1740
      }
    },
    "quotaCheckPassed": true,
    "banCheckPassed": true,
    "wasLastQuota": true
  }
}
```

**Validate:**

- ✅ `sessionId` = session cũ (không tạo mới)
- ✅ `index = 3` (đúng progress)
- ✅ `resumedSession = true`
- ✅ `existingData.resultsCount = 3`
- ✅ `quotaRemaining = 0` (đang dùng last quota)

---

### Test Case 4: Submit Answer - NURSERY_RHYME (Test Mode)

**Mục đích:** Kiểm tra cache update với mock data (không gọi AI Engine).

**Request:**

```bash
POST /api/v1/voice-sessions/sess_550e8400.../submit?testmode=true
# Authorization: Bearer <token> (OPTIONAL)
Content-Type: multipart/form-data

Fields:
- audio_file: test_audio.wav (dummy file)
- request_data: {
    "questionIndex": 1,
    "questionId": "q_001",
    "targetText": "Con cò bé bé",
    "durationMs": 4500
  }
```

**Backend Processing:**

1. ✅ Get cache from Redis
2. ⏭️ **SKIP AI Engine call** (test mode)
3. ✅ Generate mock score:

   ```python
   mock_score = 85.0
   mock_attitude = "FOCUSED"
   mock_result = {
     "index": 1,
     "status": "good",
     "score": 85.0,
     "exercise_type": "NURSERY_RHYME",
     "matched_keyword": "Con cò bé bé",
     "tokens": {
       "input_tokens": 1250,  # Mock
       "output_tokens": 580   # Mock
     },
     "component_scores": {
       "S_A": 8.5, "S_B": 9.0, "S_C": 8.0,
       "S_D": 8.5, "S_E": 9.0, "S_F": 8.0
     },
     "raw_metrics": {
       "transcription": "Con cò bé bé (mock)",
       "attitude_level": "FOCUSED"
     }
   }
   ```

4. ✅ Append to cache: `data.results.append(mock_result)`
5. ✅ Update tokens: `totalInput += 1250, totalOutput += 580`
6. ✅ Save to Redis

**Response:**

```json
{
  "score": 85.0,
  "attitude_level": "FOCUSED",
  "feedback": "Test mode: Mock score",
  "testMode": true,
  "debugInfo": {
    "redisKey": "learner_12345#sess_550e8400...#3-4",
    "cacheUpdated": true,
    "mockDataUsed": true,
    "currentProgress": {
      "gameType": "NURSERY_RHYME",
      "resultsCount": 1,
      "totalTokens": {
        "totalInput": 1250,
        "totalOutput": 580
      }
    }
  }
}
```

**Validate:**

- ✅ `mockDataUsed = true`
- ✅ `cacheUpdated = true`
- ✅ `currentProgress.resultsCount = 1`
- ✅ Cache trong Redis đã có 1 result

---

### Test Case 5: Submit Answer - COUNTING (Test Mode)

**Request:**

```bash
POST /api/v1/voice-sessions/sess_8fa3e210.../submit?testmode=true
# Authorization: Bearer <token> (OPTIONAL)

{
  "questionIndex": 1,
  "questionId": "q_count_1_10",
  "targetText": "1-10",
  "durationMs": 8000
}
```

**Backend Processing (Mock):**

```python
mock_result = {
  "status": "perfect",
  "score": 100.0,
  "exercise_type": "COUNTING",
  "tokens": {"input_tokens": 800, "output_tokens": 300},
  "component_scores": {
    "sequence_accuracy": 10.0,
    "pronunciation": 9.5
  },
  "counting_metrics": {
    "expected_sequence": ["1","2","3","4","5","6","7","8","9","10"],
    "recognized_sequence": ["1","2","3","4","5","6","7","8","9","10"],
    "missing_numbers": [],
    "extra_numbers": [],
    "accuracy_rate": 100.0
  }
}
# Lưu vào data.result (singular, không phải array)
cache_data["data"]["result"] = mock_result
```

**Response:**

```json
{
  "score": 100.0,
  "attitude_level": "FOCUSED",
  "feedback": "Test mode: Perfect counting",
  "testMode": true,
  "debugInfo": {
    "redisKey": "learner_12345#sess_8fa3e210...#3-4",
    "cacheUpdated": true,
    "mockDataUsed": true,
    "currentProgress": {
      "gameType": "COUNTING",
      "hasResult": true,
      "score": 100.0
    }
  }
}
```

---

### Test Case 6: End Session - Success (Test Mode)

**Mục đích:** Validate tính toán điểm, violation check, và cleanup cache.

**Setup:** Session có 6 câu đã submit

**Request:**

```bash
POST /api/v1/voice-sessions/sess_550e8400.../end?testmode=true
# Authorization: Bearer <token> (OPTIONAL)

{
  "totalQuestionsExpect": 6,
  "isUserAborted": false
}
```

**Backend Processing:**

1. ✅ Get cache from Redis:

   ```python
   cache = {
     "gameType": "NURSERY_RHYME",
     "data": {
       "results": [
         {"index": 1, "score": 85, "raw_metrics": {"attitude_level": "FOCUSED"}},
         {"index": 2, "score": 90, "raw_metrics": {"attitude_level": "FOCUSED"}},
         {"index": 3, "score": 88, "raw_metrics": {"attitude_level": "FOCUSED"}},
         {"index": 4, "score": 92, "raw_metrics": {"attitude_level": "FOCUSED"}},
         {"index": 5, "score": 87, "raw_metrics": {"attitude_level": "FOCUSED"}},
         {"index": 6, "score": 89, "raw_metrics": {"attitude_level": "FOCUSED"}}
       ]
     }
   }
   ```

2. ✅ **Tính completion:**

   ```python
   total_results = 6
   completion_pct = 6 / 6 = 100.0%
   ```

3. ✅ **Violation Check:**

   ```python
   # Bad Attitude Check (chỉ NURSERY_RHYME)
   uncooperative_count = 0  # Không có UNCOOPERATIVE
   bad_attitude_pct = 0 / 6 = 0%
   has_bad_attitude = False  # < 50%
   
   # Early Exit Check
   is_early_exit = False  # isUserAborted=false và completion=100%
   
   violations = []  # Không có vi phạm
   ```

4. ✅ **Calculate Final Score:**

   ```python
   scores = [85, 90, 88, 92, 87, 89]
   average = sum(scores) / len(scores) = 531 / 6 = 88.5
   
   # Apply min score (age 3-4: 60)
   adjusted = max(88.5, 60) = 88.5
   
   # Scale to 0-10
   scaled = 88.5 / 10 = 8.85
   
   # Ceiling
   ceiled = ceil(8.85) = 9
   
   # Cap at 10
   final_score = min(9, 10) = 9
   ```

5. ⏭️ **SKIP (Test Mode):**
   - Quota deduction
   - DB save
   - Violation logging

6. ✅ **Delete Redis cache**

**Response:**

```json
{
  "sessionId": "sess_550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "finalScore": 9.0,
  "quotaDeducted": false,
  "violationWarning": null,
  "isBanned": false,
  "bannedUntil": null,
  "testMode": true,
  "debugInfo": {
    "redisKey": "learner_12345#sess_550e8400...#3-4",
    "cacheDeleted": true,
    "calculations": {
      "totalResults": 6,
      "completionPct": 100.0,
      "scores": [85, 90, 88, 92, 87, 89],
      "averageScore": 88.5,
      "minScoreApplied": 60,
      "adjustedScore": 88.5,
      "scaledScore": 8.85,
      "ceiledScore": 9,
      "finalScore": 9
    },
    "violations": {
      "badAttitude": false,
      "badAttitudePct": 0.0,
      "earlyExit": false,
      "wouldBan": false
    },
    "skippedActions": [
      "quota_deduction",
      "db_save",
      "violation_logging"
    ]
  }
}
```

**Validate:**

- ✅ `cacheDeleted = true` → Redis đã cleanup
- ✅ `calculations` hiển thị đầy đủ các bước tính điểm
- ✅ `violations.badAttitude = false, earlyExit = false`
- ✅ `quotaDeducted = false` (test mode)
- ✅ `skippedActions` list rõ các action đã skip

---

### Test Case 7: End Session - With Violations

**Request:**

```bash
POST /api/v1/voice-sessions/sess_bad_attitude.../end?testmode=true
# Authorization: Bearer <token> (OPTIONAL)

{
  "totalQuestionsExpect": 6,
  "isUserAborted": false
}
```

**Backend Processing:**

```python
# Cache có nhiều UNCOOPERATIVE
cache_results = [
  {"score": 70, "raw_metrics": {"attitude_level": "UNCOOPERATIVE"}},
  {"score": 65, "raw_metrics": {"attitude_level": "UNCOOPERATIVE"}},
  {"score": 60, "raw_metrics": {"attitude_level": "UNCOOPERATIVE"}},
  {"score": 75, "raw_metrics": {"attitude_level": "DISTRACTED"}},
  {"score": 80, "raw_metrics": {"attitude_level": "FOCUSED"}},
  {"score": 70, "raw_metrics": {"attitude_level": "FOCUSED"}}
]

# Violation check
uncooperative_count = 3
bad_attitude_pct = 3 / 6 = 50.0%
has_bad_attitude = True  # >= 50% threshold

violations = ["bad_attitude"]
```

**Response:**

```json
{
  "sessionId": "sess_bad_attitude_123",
  "status": "completed",
  "finalScore": 7.0,
  "quotaDeducted": false,
  "violationWarning": "Test mode: Would log bad_attitude violation",
  "isBanned": false,
  "bannedUntil": null,
  "testMode": true,
  "debugInfo": {
    "redisKey": "learner_12345#sess_bad_attitude_123#3-4",
    "cacheDeleted": true,
    "calculations": {
      "totalResults": 6,
      "completionPct": 100.0,
      "scores": [70, 65, 60, 75, 80, 70],
      "averageScore": 70.0,
      "finalScore": 7
    },
    "violations": {
      "badAttitude": true,
      "badAttitudePct": 50.0,
      "uncooperativeCount": 3,
      "earlyExit": false,
      "wouldBan": false,
      "wouldLogViolation": "bad_attitude"
    },
    "skippedActions": [
      "quota_deduction",
      "db_save",
      "violation_logging",
      "ban_trigger"
    ]
  }
}
```

**Validate:**

- ✅ `violations.badAttitude = true`
- ✅ `violations.badAttitudePct = 50.0`
- ✅ `violations.wouldLogViolation = "bad_attitude"`
- ✅ Trong production sẽ log violation, nhưng test mode skip

---

### Test Case 8: End Session - Early Exit

**Request:**

```bash
POST /api/v1/voice-sessions/sess_early_exit.../end?testmode=true
# Authorization: Bearer <token> (OPTIONAL)

{
  "totalQuestionsExpect": 6,
  "isUserAborted": true
}
```

**Backend Processing:**

```python
# Chỉ có 2 results trong cache
total_results = 2
completion_pct = 2 / 6 = 33.3%

# Violation check
is_early_exit = True  # isUserAborted=true
violations = ["early_exit"]

# Quota logic
should_deduct_quota = False  # < 50% completion
```

**Response:**

```json
{
  "sessionId": "sess_early_exit_456",
  "status": "aborted",
  "finalScore": 6.0,
  "quotaDeducted": false,
  "violationWarning": "Test mode: Would log early_exit violation",
  "isBanned": false,
  "bannedUntil": null,
  "testMode": true,
  "debugInfo": {
    "redisKey": "learner_12345#sess_early_exit_456#3-4",
    "cacheDeleted": true,
    "calculations": {
      "totalResults": 2,
      "completionPct": 33.3,
      "scores": [80, 75],
      "averageScore": 77.5,
      "finalScore": 8
    },
    "violations": {
      "badAttitude": false,
      "earlyExit": true,
      "wouldLogViolation": "early_exit"
    },
    "quotaLogic": {
      "shouldDeduct": false,
      "reason": "completion < 50% and aborted"
    },
    "skippedActions": [
      "quota_deduction",
      "db_save",
      "violation_logging"
    ]
  }
}
```

---

## 🧪 Curl Command Examples

### Test 1: Start New Session

```bash
curl -X POST "http://localhost:8000/api/v1/voice-sessions/start?testmode=true" \
  # -H "Authorization: Bearer YOUR_TOKEN" (OPTIONAL) \
  -H "Content-Type: application/json" \
  -d '{
    "childId": "learner_12345",
    "gameId": "game_001",
    "lessonId": "lesson_abc",
    "gameVersion": "1.0.0",
    "gameType": "NURSERY_RHYME"
  }'
```

### Test 2: Submit Answer

```bash
curl -X POST "http://localhost:8000/api/v1/voice-sessions/sess_550e8400.../submit?testmode=true" \
  # -H "Authorization: Bearer YOUR_TOKEN" (OPTIONAL) \
  -F "audio_file=@test_audio.wav" \
  -F 'request_data={"questionIndex":1,"questionId":"q_001","targetText":"Con cò bé bé","durationMs":4500}'
```

### Test 3: End Session

```bash
curl -X POST "http://localhost:8000/api/v1/voice-sessions/sess_550e8400.../end?testmode=true" \
  # -H "Authorization: Bearer YOUR_TOKEN" (OPTIONAL) \
  -H "Content-Type: application/json" \
  -d '{
    "totalQuestionsExpect": 6,
    "isUserAborted": false
  }'
```

---

## ✅ Checklist Validation

### Start Session

- [ ] Redis key format đúng: `childId#sessionId#ageLevel`
- [ ] Cache structure đúng theo gameType
- [ ] NURSERY_RHYME: `data.results` là array
- [ ] COUNTING/SPELLING: `data` là object rỗng
- [ ] `index = 0` cho session mới
- [ ] Session resume: `index` = số results đã có

### Submit Answer

- [ ] `mockDataUsed = true`
- [ ] Cache được update
- [ ] Token usage tăng lên
- [ ] Results count tăng (NURSERY_RHYME) hoặc có result (COUNTING/SPELLING)

### End Session

- [ ] Calculations cho thấy đúng logic tính điểm
- [ ] Violations detect đúng
- [ ] `cacheDeleted = true`
- [ ] `quotaDeducted = false` (test mode)
- [ ] `skippedActions` list đầy đủ

---

## 🚨 Lưu ý quan trọng

1. **Test Mode chỉ dùng cho testing, KHÔNG dùng production**
2. **Redis cache vẫn được xóa** khi end session (để test cleanup)
3. **Mock scores** có thể config trong code nếu cần
4. **Debug info chỉ có khi `testmode=true`**, production sẽ null

---

## 📞 Support

Nếu có vấn đề với test mode, check:

1. `testMode` field trong response = `true`?
2. `debugInfo` có giá trị?
3. Redis có tạo/xóa key đúng?
4. Quota có bị trừ không? (phải = `false`)
