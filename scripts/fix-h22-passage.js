/**
 * 힐링 22번 문단 교체 스크립트
 * 무라카미 하루키 스타일로 의심받는 "음식을 만드는 일" 문단을
 * 완전히 오리지널 문단으로 교체합니다.
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const NEW_TEXT = '저녁 산책을 나서면 동네가 다르게 보인다. 낮에는 그냥 지나치던 골목이, 가로등 빛 아래서는 낯설고 따뜻해 보인다. 아무 목적 없이 걷는다. 왼발, 오른발, 발이 땅에 닿는 소리를 듣는다. 숨을 들이쉬고 내쉰다. 이 사람들도, 저 창문 안에서도 각자의 하루를 살고 있겠지. 그것만 생각해도 왠지 마음이 가벼워진다. 완전히 혼자이지만 완전히 혼자는 아닌 이 느낌. 걷다 보면 어떤 날은 그것만으로 풀리기도 한다. 아무것도 해결되지 않았지만, 그래도 다시 시작할 수 있을 것 같아지는 거리가 있다. 오늘 밤의 그 거리를 나는 혼자 걷는다.';

const NEW_WHY = '걷는다는 것은 생각을 정리하는 일이기도 합니다. 발이 움직이면 마음도 움직이기 시작합니다.';

const NEW_INSPIRATION = '일상의 산책이 주는 작은 위로';

async function fixPassage() {
  try {
    // edition='healing', day=22인 문서 찾기
    const snap = await db.collection('sentences')
      .where('edition', '==', 'healing')
      .where('day', '==', 22)
      .get();

    if (snap.empty) {
      console.log('❌ 힐링 day=22 문서를 찾지 못했습니다.');
      console.log('전체 힐링 문서 목록:');
      const allSnap = await db.collection('sentences')
        .where('edition', '==', 'healing')
        .get();
      allSnap.forEach(doc => {
        const d = doc.data();
        console.log(`  ID: ${doc.id}, day: ${d.day}, theme: ${d.theme}`);
      });
      process.exit(1);
    }

    for (const doc of snap.docs) {
      const old = doc.data();
      console.log('📄 대상 문서:');
      console.log('  ID:', doc.id);
      console.log('  day:', old.day);
      console.log('  theme:', old.theme);
      console.log('  OLD text:', old.text.substring(0, 80) + '...');

      await doc.ref.update({
        text: NEW_TEXT,
        why: NEW_WHY,
        inspiration: NEW_INSPIRATION,
        source: '레터브릭',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('✅ 업데이트 완료!');
      console.log('  NEW text:', NEW_TEXT.substring(0, 80) + '...');
    }

    console.log('\n🎉 힐링 22번 문단 교체 완료');
    process.exit(0);
  } catch (e) {
    console.error('❌ 오류:', e.message);
    process.exit(1);
  }
}

fixPassage();
