# 의견이 들어오면 메일 받기

사용자가 **설정 → 의견 보내기**에서 보내기를 누르면 Firestore `bugReports` 컬렉션에
문서가 쌓인다. 그대로 두면 콘솔을 직접 열어봐야 알 수 있어 놓치기 쉽다.

Firebase 확장 **Trigger Email from Firestore** 를 붙이면 문서가 생길 때마다
메일이 온다. 서버 코드는 필요 없다.

앱은 이미 신고 문서에 확장이 읽는 두 필드를 함께 넣고 있다.

```jsonc
{
  "to": ["knits2crochet@gmail.com"],
  "message": {
    "subject": "[뜨개일기 v1.0.0] 버그 신고",
    "text": "…내용 + 환경 + 오류 기록 요약…"
  },
  // 아래는 콘솔에서 자세히 볼 때 쓰는 원본
  "description": "…", "kind": "bug", "errorLogs": [ … ]
}
```

---

## 1. 보낼 메일 계정 준비 (Gmail 기준)

확장은 SMTP 서버로 메일을 보낸다. Gmail 을 쓰려면 **앱 비밀번호**가 필요하다.

1. [Google 계정 → 보안](https://myaccount.google.com/security) → **2단계 인증**을 켠다 (이미 켜져 있으면 넘어감)
2. 같은 화면에서 **앱 비밀번호** 검색 → 새로 만들기 → 이름 아무거나 (예: `뜨개일기 알림`)
3. 나오는 **16자리**를 복사해 둔다 (공백은 빼고 붙여 쓴다)

> Gmail 은 하루 발송량 제한이 있다. 의견 알림 정도면 충분하지만,
> 나중에 양이 많아지면 SendGrid·Mailgun 같은 전용 서비스로 바꾸면 된다.

---

## 2. 확장 설치

Firebase 콘솔 → 왼쪽 메뉴 **Extensions** → **Trigger Email from Firestore** 검색 → 설치

설정값은 이렇게 넣는다.

| 항목 | 값 |
|---|---|
| **SMTP connection URI** | `smtps://knits2crochet@gmail.com@smtp.gmail.com:465` |
| **SMTP password** | 위에서 만든 앱 비밀번호 16자리 |
| **Email documents collection** | `bugReports` |
| **Default FROM address** | `knits2crochet@gmail.com` |
| **Default REPLY-TO address** | (비워도 됨) |
| **Users collection** / **Templates collection** | (비워 둔다) |

> URI 안의 `@` 가 두 번 나오는 게 맞다. 사용자 이름에 `@` 가 들어가서다.
> 비밀번호는 URI 에 넣지 말고 **SMTP password 칸에 따로** 넣는다.

---

## 3. 규칙 다시 게시

`firestore.rules` 에 `to` 를 운영자 주소로 고정하는 조건이 추가됐다.
**Firestore → 규칙**에 통째로 붙여넣고 게시한다.

이게 없으면 클라이언트가 `to` 를 아무 주소로나 바꿔 **스팸 발송기로 쓸 수 있다.**
반드시 함께 반영할 것.

---

## 4. 확인

앱에서 의견을 하나 보내 본다.

- 1~2분 안에 메일이 오면 성공
- 안 오면 Firestore 의 그 문서에 확장이 남긴 **`delivery` 필드**를 본다.
  `state: SUCCESS` / `ERROR` 와 실패 사유가 적혀 있다.
- 흔한 실패: 앱 비밀번호 오타, 2단계 인증 미설정, 컬렉션 이름 오타

---

## 비용

확장은 Cloud Functions 로 동작한다. 의견 한 건당 함수 호출 한 번이라
개인 규모에서는 무료 한도 안에 들어간다. 예산 알림은 이미 걸어 두었다.
