# 사진 클라우드 백업 — 켜기 전에 할 일

폰과 태블릿에서 같은 사진을 보려면 Firebase Storage 를 써야 한다.
코드는 준비되어 있고(`ENABLE_CLOUD_PHOTO_SYNC = true`), **콘솔 작업 3가지**만 하면 된다.

순서를 지킬 것. 2번(예산 알림)을 건너뛰면 안전장치가 없다.

---

## 1. Blaze 요금제로 전환

2026년 2월 3일부터 Cloud Storage for Firebase 는 **결제 계정 연결이 필수**다.
사용량이 0이어도 카드 등록 없이는 버킷을 만들 수 없다.

1. [Firebase 콘솔](https://console.firebase.google.com/) → 프로젝트 `my-knitting-log`
2. 왼쪽 아래 **요금제 업그레이드** → **Blaze**
3. 결제 계정 연결

> 무료 한도(Google Cloud Always Free) 안에서는 청구액이 0이다.
> 단, 무료 한도는 **미국 리전 버킷**에만 적용된다. 서울 리전이면 첫 GB부터
> 과금되지만 GB당 월 $0.026 수준이라 개인 규모에서는 몇십 원이다.

---

## 2. 예산 알림 설정 ← 가장 중요

상한 로직이 뚫리거나 예상 밖의 트래픽이 생겨도 여기서 걸린다.

1. [Google Cloud 콘솔 → 결제 → 예산 및 알림](https://console.cloud.google.com/billing)
2. **예산 만들기**
3. 범위: 프로젝트 `my-knitting-log`
4. 금액: **월 $5** 정도로 시작 (실제 예상 비용의 몇 배)
5. 알림 임계값: 50% / 90% / 100%
6. 이메일 수신 확인

> 예산 알림은 **메일만 보내고 결제를 막지는 않는다.**
> 완전히 차단하려면 예산 초과 시 결제 계정을 분리하는 Cloud Function 이 필요하다.
> 개인 규모에서는 알림으로 충분하지만, 알림 메일은 반드시 확인할 것.

---

## 3. Storage 보안 규칙 게시

1. Firebase 콘솔 → **Storage** → 버킷이 없으면 **시작하기**
2. 리전 선택 (비용을 아끼려면 `us-central1`, 속도를 원하면 `asia-northeast3`)
3. **Rules** 탭 → 저장소의 `storage.rules` 내용을 **통째로 붙여넣기** → **게시**

같은 방식으로 **Firestore → 규칙**도 `firestore.rules` 로 다시 게시한다.
(사용량 문서 `users/{uid}/meta/storageUsage` 규칙이 새로 들어갔다)

---

## 4. 버킷 CORS 설정 ← 이걸 빼면 사진을 못 받는다

**업로드는 되는데 다운로드만 안 되는** 증상의 원인이다.

앱은 Capacitor WebView 안에서 돌고, 출처가 `https://localhost` 다.
Storage 버킷은 기본적으로 낯선 출처의 다운로드를 막기 때문에, 브라우저가
요청 자체를 차단하고 `Failed to fetch` 만 남긴다. 규칙(권한)과는 별개 문제라
`storage.rules` 를 아무리 고쳐도 해결되지 않는다.

[Google Cloud Shell](https://console.cloud.google.com/) 오른쪽 위 터미널 아이콘을 눌러
브라우저에서 바로 실행할 수 있다.

```bash
cat > cors.json <<'EOF'
[
  {
    "origin": ["https://localhost", "capacitor://localhost",
               "http://localhost:5173", "http://localhost:8080",
               "https://my-knitting-log.vercel.app"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"],
    "maxAgeSeconds": 3600
  }
]
EOF

gcloud storage buckets update gs://my-knitting-log.firebasestorage.app --cors-file=cors.json

# 확인
gcloud storage buckets describe gs://my-knitting-log.firebasestorage.app --format="default(cors_config)"
```

같은 내용이 저장소의 `storage-cors.json` 에 있다.
**웹 주소가 바뀌면 origin 목록에 추가하고 다시 실행할 것.**

---

## 상한이 어떻게 걸리는가

세 겹이다.

| 겹 | 무엇을 막나 | 어디서 | 우회 가능? |
|---|---|---|---|
| 1 | 사진 한 장 2MB 초과 | `storage.rules` | 불가 |
| 2 | 총량 1GB 초과 | `storage.rules` + 사용량 문서 | 어려움 |
| 3 | 예상 밖의 비용 | Google Cloud 예산 알림 | — |

2번은 클라이언트가 기록한 사용량 문서를 신뢰한다.
`firestore.rules` 에서 **사진 수가 줄지 않으면 용량도 줄일 수 없게** 막아 두었지만,
완벽한 방어는 아니다. 완전히 막으려면 Storage 트리거 Cloud Function 으로
서버에서 사용량을 계산해야 한다 (Blaze 면 추가 비용 거의 없음, 나중 과제).

값은 `src/lib/quota.ts` 와 `storage.rules` 두 곳에 있다. **바꿀 때 둘 다 고칠 것.**

---

## 상한을 넘으면

- 넘친 사진만 업로드를 건너뛴다
- **로컬 사진은 그대로** — 그 기기에서는 계속 보인다
- 백업 화면에 "사진 N장을 올리지 못했어요" 안내가 뜬다
- 용량을 비우면 다음 백업에서 자동으로 재시도된다

---

## 비용 감각

압축 설정(1280px / WebP / 최대 800KB)에서 사진 한 장은 보통 150~250KB.

| 사용자 | 보관량 | 월 저장 비용 |
|---|---|---|
| 나 + 태블릿 | ~100MB | ≈ 0 |
| 100명 (1인 200MB) | 20GB | 약 $0.5 |
| 1,000명 | 200GB | 약 $5 |

저장보다 **다운로드 트래픽**이 비싸다($0.12~0.15/GB).
사용자가 늘면 저장량보다 이쪽을 먼저 보는 게 맞다.
