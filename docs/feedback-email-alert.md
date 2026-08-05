# 의견이 들어오면 메일 받기

**설정 → 의견 보내기**에서 보내기를 누르면 Firestore `bugReports` 에 문서가 쌓인다.
그대로 두면 콘솔을 직접 열어봐야 알 수 있어 놓치기 쉽다.

`functions/index.js` 의 **notifyFeedback** 이 그 문서를 보고 메일을 보낸다.

> Firebase Extensions(Trigger Email)를 쓰는 방법도 있지만,
> **2027년 3월 31일에 종료**된다. 그래서 직접 만들었다.

**받는 주소와 보내는 계정은 서버가 정한다.** 앱은 관여하지 않으므로,
누가 앱을 뜯어 고쳐도 남에게 메일을 보내는 발송기로 쓸 수 없다.

---

## 한 번만 하면 되는 준비

### 1. Gmail 앱 비밀번호

1. [Google 계정 → 보안](https://myaccount.google.com/security) → **2단계 인증** 켜기
2. 같은 화면에서 **앱 비밀번호** 검색 → 새로 만들기 (이름: `뜨개일기 알림`)
3. 나오는 **16자리**를 복사 (공백은 빼고 붙여 쓴다)

### 2. Firebase CLI 설치 + 로그인

PowerShell 에서:

```powershell
npm install -g firebase-tools
firebase login
```

브라우저가 열리면 Firebase 계정으로 로그인한다.

### 3. 계정 정보를 Secret 으로 등록

코드에 비밀번호를 넣지 않는다. Google Secret Manager 에 넣고 함수가 꺼내 쓴다.

```powershell
cd C:\Users\ddoro\Desktop\suki\my-knitting-log-main\my-knitting-log-main

firebase functions:secrets:set GMAIL_USER
# 물어보면: knits2crochet@gmail.com

firebase functions:secrets:set GMAIL_PASS
# 물어보면: 위에서 만든 앱 비밀번호 16자리
```

### 4. 배포

```powershell
cd functions
npm install
cd ..
firebase deploy --only functions
```

처음 배포할 때 필요한 API 를 켤지 물어보면 **Y**.
2~3분 걸린다.

---

## 확인

앱에서 의견을 하나 보내 본다. 1분 안에 메일이 오면 성공.

안 오면 로그를 본다.

```powershell
firebase functions:log --only notifyFeedback
```

흔한 실패:

| 로그 내용 | 원인 |
|---|---|
| `Invalid login` | 앱 비밀번호 오타, 또는 2단계 인증 미설정 |
| `Secret ... not found` | 3번을 건너뛰었다 |
| 로그가 아예 없음 | 배포가 안 됐거나 컬렉션 이름이 다르다 |

메일 전송이 실패해도 **의견 자체는 Firestore 에 그대로 남는다.**

---

## 고칠 때

메일 문구나 형식을 바꾸려면 `functions/index.js` 만 고치고 다시 배포한다.

```powershell
firebase deploy --only functions
```

---

## 비용

의견 한 건당 함수 호출 한 번이라 개인 규모에서는 무료 한도 안이다.
Secret Manager 는 버전당 월 $0.06 수준(2개 = 약 $0.12).
예산 알림은 이미 걸어 두었다.
