/**
 * 레터브릭 — 일일 필사 리마인더 발송
 * GitHub Actions에서 매일 오전 8시 KST에 실행됩니다.
 *
 * 필요 환경변수:
 *   FIREBASE_SERVICE_ACCOUNT — Firebase Admin SDK 서비스 계정 JSON (GitHub Secret)
 *
 * GitHub Secret 설정 방법:
 *   1. GitHub 레포 → Settings → Secrets and variables → Actions
 *   2. New repository secret
 *   3. Name: FIREBASE_SERVICE_ACCOUNT
 *   4. Value: serviceAccount.json 파일 내용 전체 붙여넣기
 */

const { initializeApp, cert } = require('/tmp/fcm/node_modules/firebase-admin/app');
const { getFirestore }        = require('/tmp/fcm/node_modules/firebase-admin/firestore');
const { getMessaging }        = require('/tmp/fcm/node_modules/firebase-admin/messaging');

// ── 초기화 ──────────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({ credential: cert(serviceAccount) });

const db        = getFirestore();
const messaging = getMessaging();

// ── 알림 내용 ───────────────────────────────────────────────────────────────
const NOTIFICATION = {
  title: '✏️ 오늘의 필사',
  body:  '레터브릭을 열어 오늘의 문장을 써보세요.',
};

const WEBPUSH_LINK = 'https://letterbrick.vercel.app/';

// ── 메인 ────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Firestore에서 유효한 FCM 토큰 수집
  const snap = await db.collection('fcmTokens').get();
  const tokens = [];
  snap.forEach(doc => {
    const t = doc.data().token;
    if (t) tokens.push(t);
  });

  if (tokens.length === 0) {
    console.log('등록된 FCM 토큰 없음 — 발송 건너뜀');
    return;
  }

  console.log(`총 ${tokens.length}개 토큰에 알림 발송 시작`);

  // 2. 500개씩 청크 분할 (FCM 배치 한도)
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  let totalSuccess = 0;
  let invalidTokens = [];

  for (const chunk of chunks) {
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: NOTIFICATION,
      webpush: {
        fcmOptions: { link: WEBPUSH_LINK },
        notification: {
          icon: 'https://letterbrick.vercel.app/images/icon_pen_tool.svg',
          badge: 'https://letterbrick.vercel.app/images/icon_pen_tool.svg',
          tag: 'lb-reminder',
          renotify: true,
        },
      },
    });

    totalSuccess += response.successCount;
    console.log(`청크 발송: 성공 ${response.successCount}, 실패 ${response.failureCount}`);

    // 만료·무효 토큰 수집
    response.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error && r.error.code;
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(chunk[i]);
        }
      }
    });
  }

  console.log(`✅ 발송 완료: ${totalSuccess}/${tokens.length}`);

  // 3. 무효 토큰 Firestore에서 정리
  if (invalidTokens.length > 0) {
    console.log(`🗑️ 무효 토큰 ${invalidTokens.length}개 정리 중...`);
    const invalidSet = new Set(invalidTokens);
    const batch = db.batch();
    snap.forEach(doc => {
      if (invalidSet.has(doc.data().token)) batch.delete(doc.ref);
    });
    await batch.commit();
    console.log('정리 완료');
  }
}

main().catch(err => {
  console.error('발송 실패:', err);
  process.exit(1);
});
