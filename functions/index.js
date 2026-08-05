// ----------------------------------------------------------------------------
// 의견이 들어오면 운영자에게 메일로 알린다
// ----------------------------------------------------------------------------
// bugReports 컬렉션에 문서가 생기면 그 내용을 정리해 메일로 보낸다.
//
// 받는 주소와 보내는 계정은 전부 서버가 정한다. 앱은 관여하지 않는다.
// (앱이 받는 사람을 정하게 두면 아무에게나 메일을 보내는 발송기가 된다)
//
// 계정 정보는 코드에 넣지 않고 Secret Manager 에 둔다.
// 설정 방법은 docs/feedback-email-alert.md 참고.

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const nodemailer = require('nodemailer');

// 보내는 계정. 앱 비밀번호를 만든 그 계정이어야 한다 —
// 다른 주소를 넣으면 Gmail 이 535(Invalid login) 로 거절한다.
const GMAIL_USER = defineSecret('GMAIL_USER');
const GMAIL_PASS = defineSecret('GMAIL_PASS');
// 알림을 받을 주소. 없으면 보내는 계정으로 보낸다(자기 자신에게).
const ALERT_TO = defineSecret('ALERT_TO');

/** 메일 본문이 지나치게 길어지지 않도록 자른다 */
const MAX_BODY = 8000;

const KIND_LABEL = {
  bug: '버그 신고',
  idea: '개선 제안',
  etc: '기타 의견',
};

exports.notifyFeedback = onDocumentCreated(
  {
    document: 'bugReports/{reportId}',
    secrets: [GMAIL_USER, GMAIL_PASS, ALERT_TO],
    // 의견은 드물게 들어온다. 폭주해도 비용이 튀지 않게 상한을 둔다.
    maxInstances: 3,
  },
  async (event) => {
    const data = event.data && event.data.data();
    if (!data) return;

    const kind = KIND_LABEL[data.kind] || '의견';
    const version = data.appVersion || '?';
    const logs = Array.isArray(data.errorLogs) ? data.errorLogs : [];

    const body = [
      `[${kind}]`,
      '',
      data.description || '(내용 없음)',
      '',
      '--- 보낸 사람 ---',
      `${data.email || '(이메일 없음)'} / uid ${data.uid || '?'}`,
      '',
      '--- 환경 ---',
      `버전: v${version}`,
      `화면: ${data.pageUrl || '-'}`,
      `기기: ${data.userAgent || '-'}`,
      `해상도: ${data.screen || '-'}`,
      `언어: ${data.language || '-'}`,
      '',
      `--- 오류 기록 ${logs.length}개 ---`,
      ...logs.map((l) => `${l.createdAt} [${l.context || '-'}] ${l.message}`),
      '',
      `문서: ${event.params.reportId}`,
    ]
      .join('\n')
      .slice(0, MAX_BODY);

    const user = GMAIL_USER.value();
    const pass = GMAIL_PASS.value();
    // ALERT_TO 를 등록하지 않았으면 보내는 계정 자신에게 보낸다
    const to = ALERT_TO.value() || user;

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    try {
      await transporter.sendMail({
        from: `뜨개일기 <${user}>`,
        to, // 서버가 정한다. 앱은 관여하지 않는다.
        // 사용자 이메일이 있으면 메일에서 바로 답장할 수 있게 한다
        replyTo: data.email || undefined,
        subject: `[뜨개일기 v${version}] ${kind}`,
        text: body,
      });
      logger.info('의견 알림 메일을 보냈습니다', { reportId: event.params.reportId });
    } catch (error) {
      // 메일이 실패해도 의견 자체는 Firestore 에 남아 있다.
      logger.error('의견 알림 메일 전송 실패', error);
    }
  },
);
