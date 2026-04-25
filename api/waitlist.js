// Vercel Serverless Function — /api/waitlist
// 레터브릭 랜딩 페이지 이메일 수집 → Firestore waitlist 저장

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue }     = require('firebase-admin/firestore');

function getDb() {
  if (!getApps().length) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(sa) });
  }
  return getFirestore();
}

module.exports = async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, source } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  try {
    const db = getDb();
    // 이메일을 문서 ID로 사용 (중복 자동 방지)
    const id = email.replace(/[@.]/g, '_');
    await db.collection('waitlist').doc(id).set({
      email,
      source: source || 'ko-landing',
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Waitlist save error:', e);
    return res.status(500).json({ error: 'Failed to save' });
  }
};
