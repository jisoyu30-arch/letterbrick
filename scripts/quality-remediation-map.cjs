const REMEDIATION_MAP = {
  'missing-content-text': {
    owner: 'content',
    action: '해당 콘텐츠 항목에 실제 표시 텍스트를 추가하세요.',
    checklist: ['public/data.js 위치 확인', '문장/문단 텍스트 추가', 'npm run audit:data-quality 재실행']
  },
  'missing-content-author': {
    owner: 'content',
    action: '저자, inspiration, 또는 레터브릭 오리지널 표시를 명확히 추가하세요.',
    checklist: ['저작권/출처 확인', 'author 또는 inspiration 필드 보강', '공유/저장 credit 표시 확인']
  },
  'missing-content-source': {
    owner: 'content',
    action: '출처 필드에 작품명, 번역/의역/영감 라벨, 또는 오리지널 라벨을 추가하세요.',
    checklist: ['source 필드 추가', '출처 라벨 포함', 'audit 재실행']
  },
  'unlabeled-content-source': {
    owner: 'content',
    action: '출처에 번역/의역/영감/오리지널 같은 신뢰 라벨을 붙이세요.',
    checklist: ['source 문구 확인', '허용 라벨 중 하나 적용', '사용자 표시 문구 확인']
  },
  'duplicate-content-text': {
    owner: 'content',
    action: '중복 콘텐츠 중 하나를 교체하거나 의도된 반복인지 명시적으로 조정하세요.',
    checklist: ['중복 위치 비교', '하나를 새 콘텐츠로 교체', 'day/variant 균형 확인']
  },
  'growth-too-short': {
    owner: 'content',
    action: '성장 문장이 훈련 가치가 충분하도록 18자 이상으로 보강하거나 예외로 유지할지 결정하세요.',
    checklist: ['문장 의도 확인', '너무 짧으면 대체 문장 검토', '짧은 문장 유지 시 기준 문서화']
  },
  'missing-growth-point': {
    owner: 'content',
    action: '성장 문장의 학습 포인트를 추가하세요.',
    checklist: ['pt/reason 필드 확인', '문장 훈련 포인트 작성', 'UI 노출 확인']
  },
  'missing-core-skill': {
    owner: 'content',
    action: '성장 문장의 coreSkill을 추가하세요.',
    checklist: ['learn.coreSkill 추가', 'step rubric과 일관성 확인', 'audit 재실행']
  },
  'invalid-healing-theme': {
    owner: 'content',
    action: '힐링 테마를 다짐, 힐링, 여운 중 하나로 수정하세요.',
    checklist: ['theme 필드 확인', '허용 테마 적용', '테마별 10개 균형 확인']
  },
  'missing-healing-question': {
    owner: 'content',
    action: '힐링 문단에 사용자가 쓸 수 있는 질문을 추가하세요.',
    checklist: ['question 필드 추가', '문단 톤과 일관성 확인', '모바일 표시 확인']
  },
  'healing-too-short': {
    owner: 'content',
    action: '힐링 문단을 220자 이상으로 보강하거나 의도된 짧은 문단인지 검토하세요.',
    checklist: ['문단 길이 확인', '감정 맥락 보강', '낭독/표시 흐름 확인']
  },
  'healing-theme-count': {
    owner: 'content',
    action: '힐링 테마별 개수를 10개씩 맞추세요.',
    checklist: ['테마 카운트 확인', '부족/초과 테마 조정', 'audit 재실행']
  },
  'malformed-record': {
    owner: 'data',
    action: '필수 필드가 누락된 저장 기록을 확인하고 복구/삭제 여부를 결정하세요.',
    checklist: ['Firestore path 확인', 'uid/date/sentence/edition 확인', '필요 시 archive와 대조']
  },
  'duplicate-saved-record': {
    owner: 'data',
    action: '중복 저장 기록 cleanup dry-run을 실행하고 삭제 후보를 검토하세요.',
    checklist: ['npm run quality:duplicates:dry 실행', 'keep/delete 후보 확인', 'commit은 별도 승인 후 실행']
  },
  'recent-record-drop': {
    owner: 'ops',
    action: '최근 저장량 급감 원인을 확인하세요.',
    checklist: ['배포/인증/Firestore rules 변경 확인', '앱 저장 health 확인', '유입/사용량 지표 대조']
  },
  'data-quality-fatal': {
    owner: 'ops',
    action: 'audit 실행 자체가 실패했습니다. 로그와 환경변수를 확인하세요.',
    checklist: ['GitHub Actions 로그 확인', 'FIREBASE_SERVICE_ACCOUNT 확인', '스크립트 문법 확인']
  }
};

function remediationFor(code) {
  return REMEDIATION_MAP[code] || {
    owner: 'ops',
    action: '이슈 코드를 분류하고 대응 기준을 추가하세요.',
    checklist: ['이슈 재현', 'owner 지정', 'remediation map 업데이트']
  };
}

module.exports = { REMEDIATION_MAP, remediationFor };
