# Firebase Storage 보안 규칙

`my-knitting-log` 가 사용자별 사진을 안전하게 격리하기 위한 최소 규칙.

## 적용 방법

1. <https://console.firebase.google.com> → `my-knitting-log` 프로젝트
2. 좌측 메뉴 → **Build → Storage**
3. 첫 사용이면 **Get started** → 위치 선택 (**asia-northeast3** 한국 추천) → 시작 모드는 **Production mode** 추천
4. 상단 탭 → **Rules**
5. 아래 규칙으로 교체 → **Publish**

## 규칙 (그대로 복사)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // users/{uid} 경로는 본인만 읽기/쓰기 가능
    match /users/{uid}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // 그 외 모든 경로는 차단
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## 동작

- **로그인 안 한 사용자**: 모든 경로 차단 (`request.auth == null`)
- **로그인한 사용자 A**: `users/A/...` 만 읽기/쓰기 가능
- **로그인한 사용자 B**: A 의 사진(`users/A/...`) 절대 못 봄/못 씀

## 앱이 사용하는 path

```
users/{uid}/projectPhotos/{projectCloudId}/{photoCloudId}.{ext}
```

- `uid` — Firebase Auth 의 사용자 UID
- `projectCloudId` — 프로젝트 동기화 식별자 (UUID)
- `photoCloudId` — 사진 동기화 식별자 (UUID)
- `ext` — `jpg` / `png` / `webp` / `gif`

## 향후 확장

- **30일 지난 묘비 사진 삭제** (휴지통 영구 삭제 + cron) — 별도 작업
- **이미지 압축** (브라우저 측에서 업로드 전) — 별도 작업
- **공유 사진 (커뮤니티)** — `public/photos/...` 경로에 별도 규칙 추가 필요
