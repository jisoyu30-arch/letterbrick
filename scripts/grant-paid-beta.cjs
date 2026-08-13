function parseArgs(argv) {
  const args = {};
  argv.forEach((item) => {
    if (!item.startsWith('--')) return;
    const raw = item.slice(2);
    const eq = raw.indexOf('=');
    if (eq === -1) args[raw] = true;
    else args[raw.slice(0, eq)] = raw.slice(eq + 1);
  });
  return args;
}

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_JSON is required.');
  return JSON.parse(raw);
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

async function findUidByEmail(db, email) {
  if (!email) return '';
  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snap.empty) return '';
  return snap.docs[0].id;
}

function buildEntitlement(args, uid) {
  const now = new Date();
  const days = Number(args.days || 30);
  const dailyAiLimit = Number(args.quota || args.dailyAiLimit || 6);
  return {
    uid,
    email: args.email || '',
    status: args.status || 'active',
    plan: args.plan || 'paid_beta',
    cohort: args.cohort || 'beta-2026-06',
    source: args.source || 'manual',
    dailyAiLimit,
    monthlyReport: args.monthlyReport === 'false' ? false : true,
    startedAt: now.toISOString(),
    expiresAt: addDays(now, days).toISOString(),
    updatedAt: now.toISOString()
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = !!args['dry-run'];
  let uid = args.uid || '';

  if (!uid && !args.email) {
    throw new Error('Pass --uid=USER_ID or --email=user@example.com.');
  }

  if (dryRun) {
    uid = uid || 'dry_run_uid';
    const entitlement = buildEntitlement(args, uid);
    console.log(JSON.stringify({ dryRun: true, entitlement }, null, 2));
    return;
  }

  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getFirestore, FieldValue } = require('firebase-admin/firestore');
  const serviceAccount = loadServiceAccount();
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  if (!uid) uid = await findUidByEmail(db, args.email);
  if (!uid) throw new Error(`No user found for email: ${args.email}`);

  const entitlement = buildEntitlement(args, uid);
  const runId = `paid_beta_${new Date().toISOString().replace(/[:.]/g, '-')}_${uid.slice(0, 8)}`;

  await db.collection('paid_beta_entitlements').doc(uid).set(entitlement, { merge: true });
  await db.collection('users').doc(uid).set({ paidBeta: entitlement }, { merge: true });
  await db.collection('admin_paid_beta_grants').doc(runId).set({
    runId,
    uid,
    email: entitlement.email,
    status: 'granted',
    entitlement,
    createdAt: FieldValue.serverTimestamp()
  });

  console.log(JSON.stringify({
    ok: true,
    uid,
    email: entitlement.email,
    plan: entitlement.plan,
    dailyAiLimit: entitlement.dailyAiLimit,
    expiresAt: entitlement.expiresAt,
    runId
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
