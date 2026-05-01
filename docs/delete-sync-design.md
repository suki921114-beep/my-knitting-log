# 삭제 동기화 설계 (4단계)

## 왜 별도 설계가 필요한가

지금까지의 동기화는 "추가/수정"만 다뤘습니다.
삭제를 같은 방식으로 처리하면 다음과 같은 **부활 문제**가 생깁니다.

> 노트북에서 실 1개를 삭제 → 로컬에서 사라짐 → 핸드폰에서 [가져오기] 누름
> → 핸드폰의 로컬에는 그 실이 아직 살아있음 → "로컬에 없는 클라우드 항목"으로
> 인식되어 다시 다운로드됨 → **삭제한 실이 부활!**

이를 막으려면 삭제도 다른 변경처럼 "표시"가 되어야 합니다.
이게 흔히 말하는 **soft delete + tombstone(묘비)** 패턴입니다.

---

## 1. 핵심 원칙

### 1-1. Hard delete 대신 soft delete
```ts
// Before
await db.yarns.delete(id);

// After
await db.yarns.update(id, {
  isDeleted: true,
  deletedAt: Date.now(),
  updatedAt: Date.now(), // 동기화가 변경으로 감지하도록
});
```
DB row 는 그대로 두고 플래그만 변경. 이미 `SyncMetadata` 인터페이스에
`isDeleted?: boolean`, `deletedAt?: number | null` 가 정의되어 있어요.

### 1-2. 화면에서는 숨김
모든 목록/상세 페이지의 useLiveQuery 에서 `.filter(x => !x.isDeleted)` 추가.

### 1-3. 클라우드도 묘비 보존
Firestore 의 문서를 지우지 않고 `isDeleted: true` 로 업데이트.
다른 기기가 가져갈 때 그 묘비를 읽고 자기 로컬도 soft delete 처리.

### 1-4. 결국 묘비도 정리 (선택적)
Soft delete 된 row 가 영원히 쌓이면 부담스러우니, 일정 기간 후 (예: 30일)
**모든 활성 기기가 묘비를 동기화한 시점**이라고 가정할 수 있을 때 hard delete.
1차에서는 이걸 도입하지 않고, 사용자가 수동으로 "비우기" 액션을 누르면
hard delete 하는 방식이 단순함.

---

## 2. 동기화 로직 변경

### 2-1. calculateXxxSyncDiff
변경 없음. `updatedAt` 기준으로 비교하기 때문에 `isDeleted: true` 된 항목도
그냥 "수정된 항목"으로 잡혀서 자연스럽게 업로드됨.

### 2-2. calculateXxxFetchDiff
변경 없음. 클라우드에서 isDeleted=true 인 항목도 그대로 다운로드됨.

### 2-3. executeXxxFetch / executeXxxSync
이미 `isDeleted: remote.isDeleted ?? false` 로 클라우드 값을 그대로 반영하고 있음.
=> **변경 거의 없음**.

### 2-4. 화면 쿼리만 필터 추가
```ts
// 예: src/pages/Yarns.tsx
const yarns = useLiveQuery(() =>
  db.yarns.filter(y => !y.isDeleted).sortBy('createdAt')
) || [];
```

이게 핵심. 데이터는 그대로 두고 표시만 거른다.

### 2-5. 통계 카운트도 필터
설정 페이지의 totalItems 계산도 `!isDeleted` 필터.

---

## 3. UX 변경

### 3-1. "삭제" 버튼 동작
현재: 즉시 hard delete + 토스트.
변경: 즉시 soft delete + "되돌리기" 액션이 있는 토스트 (sonner.toast.success(..., { action: { label: '되돌리기', onClick: ... } })).

### 3-2. "삭제됨" 보기 (선택)
설정 페이지 또는 라이브러리 하위에 "휴지통" 진입 → soft delete 된 항목 목록.
거기서 "복원" 또는 "영구 삭제(hard delete)" 가능.
1차에는 굳이 만들 필요 없음. 토스트의 "되돌리기"만으로도 OK.

### 3-3. 프로젝트 연결 정리
실/도안/바늘/부자재 가 삭제되면, 그걸 참조하는 projectYarns 등의 link 는?
- 옵션 A: link 도 soft delete (cascade)
- 옵션 B: link 는 살려두고, 화면에서 "(삭제된 실)" 로 표시
- **추천: A (cascade)**. UX 가 단순.

cascade 시점: 실 삭제 시 같은 트랜잭션에서 link 도 isDeleted=true.
다른 기기에 동기화될 때도 양쪽 entity 의 묘비가 함께 전달되어야 함.

---

## 4. 구현 우선순위

### Phase 1: 단순 entity (병렬로 함께)
- [ ] **yarns** - 삭제 버튼 → soft delete, 화면 필터
- [ ] **patterns**
- [ ] **needles**
- [ ] **notions**

### Phase 2: 연결 테이블 cascade
- [ ] yarn 삭제 시 projectYarns 도 soft delete (그 반대도)
- [ ] pattern, needle, notion 동일

### Phase 3: 프로젝트 자체
- [ ] **projects** - soft delete + 화면 필터
- [ ] 프로젝트 삭제 시 sub-entity (rowCounters, projectGauges, link 들) 도 cascade soft delete

### Phase 4: sub-entity 단독 삭제
- [ ] rowCounter 1개 삭제 → soft delete
- [ ] projectGauge 1개 삭제 → soft delete

### Phase 5: 휴지통/복원 (선택)
- [ ] 설정 → 휴지통 페이지
- [ ] 복원 / 영구삭제 액션

---

## 5. 데이터 마이그레이션

기존 row 들은 `isDeleted` 가 undefined 일 수 있어요. 이미 sync 코드에 보정 로직이 있지만,
삭제 동기화를 활성화하기 전에 한 번 일괄 보정 하면 깔끔합니다.

```ts
// src/lib/db.ts 의 version().upgrade(...) 안 또는 일회성 마이그레이션 함수
async function backfillDeleteFlags() {
  for (const t of [db.yarns, db.patterns, db.needles, db.notions, db.projects,
                   db.projectYarns, db.projectPatterns, db.projectNeedles,
                   db.projectNotions, db.rowCounters, db.projectGauges]) {
    const all = await t.toArray();
    for (const row of all) {
      if (row.isDeleted === undefined) {
        await t.update(row.id, { isDeleted: false, deletedAt: null });
      }
    }
  }
}
```

---

## 6. 엣지 케이스

### 6-1. 다른 기기에서 동시에 같은 항목 수정 + 삭제
- 노트북: 실 색상 변경 (updatedAt = T1)
- 핸드폰: 같은 실 삭제 (updatedAt = T2 > T1, isDeleted = true)
- → 마지막 쓰기 승: 핸드폰의 삭제가 이김. 노트북의 색상 변경은 잃음.
- 정책 단순화 OK (충돌 머지가 필요해질 때 별도 설계).

### 6-2. 삭제됐다가 같은 cloudId 로 다시 살리기
- "되돌리기" 누르면 isDeleted=false, updatedAt=Date.now() 로 되살림.
- 다음 동기화에서 다른 기기들도 "되살아남"으로 받아감.

### 6-3. 묘비 무한 누적
- 1년 쓰면 수천 개의 묘비. Firestore 비용 영향.
- Phase 5+ 에서 "30일 지난 묘비 hard delete" 같은 정책 추가 가능.

---

## 7. 안전장치

- **삭제 전 확인 다이얼로그** (shadcn AlertDialog 추천): 단순 yarn/needle 은 confirm() 으로도 충분, 프로젝트는 좀 더 강력한 경고.
- **cascade 영향 미리보기**: "이 실을 삭제하면 프로젝트 N개에서 연결이 함께 정리됩니다" 같은 안내.
- **휴지통 안내**: 토스트의 "되돌리기" 버튼 + 7일 유지 안내.

---

## 8. 4단계 첫 구현 범위 제안

한 번에 다 하지 말고 작은 단위로:

**1차 PR (최소 슬라이스)**
- yarns 만 soft delete 로 전환
- Yarns 페이지에 isDeleted 필터
- "되돌리기" 토스트 1회 분량 추가
- 동기화 코드는 변경 없음 (이미 isDeleted 처리 중)
- 검증: 노트북에서 yarn 삭제 → 백업 → 핸드폰 가져오기 → 핸드폰에서도 사라지는지

이게 안정적으로 동작하면 같은 패턴을 patterns/needles/notions/projects 로 확장.
