# Firestore 보안 규칙 적용 가이드

> **출시 전 필수.** 규칙이 테스트 모드로 남아 있으면 누구나 다른 사용자의
> 기록을 읽고 지울 수 있습니다. 다른 어떤 출시 준비보다 먼저 확인하세요.

규칙 원본: 저장소 루트의 [`firestore.rules`](../firestore.rules)

---

## 1. 현재 상태 확인 (가장 먼저)

1. https://console.firebase.google.com 접속 → 프로젝트 **my-knitting-log** 선택
2. 왼쪽 메뉴에서 **빌드 → Firestore Database** 클릭
3. 상단 탭에서 **규칙(Rules)** 클릭

지금 표시되는 내용을 확인합니다. 아래에 해당하면 **즉시 교체해야 합니다.**

```
// 위험 — 누구나 전체 데이터 접근 가능
allow read, write: if true;
```

```
// 위험 — 만료일이 지나면 모든 접근이 차단되거나, 그 전까지는 전부 열려 있음
allow read, write: if request.time < timestamp.date(2026, 1, 1);
```

```
// 위험 — 로그인만 했으면 남의 데이터도 접근 가능
allow read, write: if request.auth != null;
```

마지막 항목이 특히 놓치기 쉽습니다. "로그인한 사용자만"은 안전해 보이지만,
**로그인한 아무나 다른 사람의 `users/{남의uid}` 경로를 읽을 수 있습니다.**
반드시 `request.auth.uid == uid` 비교가 들어가야 합니다.

---

## 2. 교체 방법

1. 위 **규칙** 탭의 편집기 내용을 **전부 지웁니다**
2. 저장소의 `firestore.rules` 파일 내용을 **그대로 복사해 붙여넣습니다**
3. **게시(Publish)** 버튼 클릭
4. "규칙이 게시되었습니다" 표시 확인

게시는 즉시 반영됩니다. 앱을 다시 배포할 필요는 없습니다.

---

## 3. 제대로 막혔는지 검증

Firebase 콘솔의 **규칙 시뮬레이터**로 확인합니다. 규칙 탭 오른쪽 위의
**시뮬레이터** 를 열고 아래 두 가지를 테스트하세요.

### 3-1. 본인 데이터 — 허용되어야 함

| 항목 | 값 |
| --- | --- |
| 시뮬레이션 유형 | `get` |
| 위치 | `/users/testuid123/yarns/abc` |
| 인증 | 사용됨 (Authenticated) |
| 인증 UID | `testuid123` |

→ 결과가 **허용됨(Allow)** 이어야 정상입니다.

### 3-2. 남의 데이터 — 반드시 거부되어야 함

| 항목 | 값 |
| --- | --- |
| 시뮬레이션 유형 | `get` |
| 위치 | `/users/testuid123/yarns/abc` |
| 인증 | 사용됨 (Authenticated) |
| 인증 UID | `otheruid999` |

→ 결과가 **거부됨(Deny)** 이어야 정상입니다.
여기서 허용이 뜨면 규칙이 잘못 적용된 것이니 1번부터 다시 하세요.

---

## 4. 실제 앱에서 최종 확인

규칙 게시 후 앱에서 **설정 → 백업 및 동기화 → 백업** 을 한 번 실행합니다.

- 정상: 기존과 동일하게 업로드/다운로드 완료 토스트
- 실패: `Missing or insufficient permissions` 오류 → 규칙 경로와
  `src/lib/sync/*.ts` 의 컬렉션 경로가 어긋난 것이니 개발자에게 알리세요

---

## 5. Storage 규칙

사진 클라우드 백업(`ENABLE_CLOUD_PHOTO_SYNC`)을 켤 때 함께 적용해야 합니다.
현재는 꺼져 있어 급하지 않습니다. [`firebase-storage-rules.md`](./firebase-storage-rules.md) 참고.
