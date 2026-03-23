"""
레터브릭 콘텐츠 자동 생성 파이프라인
매월 25일 실행 → 다음달 30일분 후보 생성

사용법:
  python scripts/generate_content.py

환경변수:
  CLAUDE_API_KEY — Anthropic API 키
"""

import json, os, urllib.request, datetime

API_KEY = os.environ.get('CLAUDE_API_KEY', '')
OUTPUT_DIR = 'data/candidates'
os.makedirs(OUTPUT_DIR, exist_ok=True)

today = datetime.date.today()
target_month = today.replace(day=1) + datetime.timedelta(days=32)
target_month = target_month.replace(day=1)
month_str = target_month.strftime('%Y-%m')

def call_claude(prompt, max_tokens=2048):
    if not API_KEY:
        print('  [SKIP] CLAUDE_API_KEY not set')
        return None
    body = json.dumps({
        'model': 'claude-sonnet-4-6',
        'max_tokens': max_tokens,
        'messages': [{'role': 'user', 'content': prompt}]
    }).encode()
    req = urllib.request.Request(
        'https://api.anthropic.com/v1/messages',
        data=body,
        headers={
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'anthropic-version': '2023-06-01'
        }
    )
    try:
        resp = urllib.request.urlopen(req, timeout=60)
        data = json.loads(resp.read())
        return data['content'][0]['text']
    except Exception as e:
        print(f'  [ERROR] {e}')
        return None

# ── 성장편 후보 생성 ──
GROWTH_PROMPT = """당신은 한국어 문장 큐레이터입니다.
레터브릭 성장편에 사용할 문장 쌍을 5개(10문장) 추천해주세요.

필수 조건:
- 저작자 사망 후 70년 이상 경과 (공개 도메인)
- 한국 작가: 1954년 이전 사망
- 외국 작가: 1954년 이전 사망 (번역은 '온:사유 번역' 표시)
- 30~80자 한국어 기준
- 단독으로 의미 완결
- 문학적 기법이 명확히 드러나는 문장
- 유명한 작가, 덜 알려진 문장 우선
- 시대/성별/국적 다양성

각 문장에 포함:
- text: 문장 전문
- author: 작가명
- source: 출처 (작품명 + 연도)
- copyrightNote: 저작권 상태 (사망년도)
- learningPoint: 학습 포인트 (한 줄)
- difficulty: 1~3

JSON 배열로 응답하세요. 코드블록 없이 순수 JSON만."""

# ── 힐링편 후보 생성 ──
HEALING_PROMPT = """당신은 한국어 힐링 산문 작가입니다.
레터브릭 힐링편에 사용할 필사 문구를 3개 작성해주세요.

필수 조건:
- 각 500~600자 (한국어)
- 테마: 1개 다짐, 1개 힐링, 1개 여운
- 따뜻하고 차분한 톤
- 직접적인 조언보다 공감과 묘사 중심
- 마지막 문장이 여운을 남기는 구조
- 특정 종교/정치 관련 내용 제외

각 문구에 포함:
- theme: "다짐" | "힐링" | "여운"
- text: 본문 전문
- inspiration: 영감 출처 (예: "오정희 소설의 밤 풍경")

JSON 배열로 응답하세요. 코드블록 없이 순수 JSON만."""

def generate_growth():
    print(f'[성장편] {month_str} 후보 생성 중...')
    result = call_claude(GROWTH_PROMPT)
    if not result:
        print('  생성 실패 — 샘플 데이터 사용')
        return []
    try:
        # Extract JSON
        if '```' in result:
            result = result.split('```')[1].replace('json','',1)
        data = json.loads(result)
        filepath = f'{OUTPUT_DIR}/growth_candidates_{month_str}.json'
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f'  ✓ {len(data)}개 문장 생성 → {filepath}')
        return data
    except Exception as e:
        print(f'  파싱 실패: {e}')
        return []

def generate_healing():
    print(f'[힐링편] {month_str} 후보 생성 중...')
    result = call_claude(HEALING_PROMPT)
    if not result:
        print('  생성 실패 — 샘플 데이터 사용')
        return []
    try:
        if '```' in result:
            result = result.split('```')[1].replace('json','',1)
        data = json.loads(result)
        filepath = f'{OUTPUT_DIR}/healing_candidates_{month_str}.json'
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f'  ✓ {len(data)}개 문구 생성 → {filepath}')
        return data
    except Exception as e:
        print(f'  파싱 실패: {e}')
        return []

def generate_report(growth, healing):
    report = f"""# 레터브릭 콘텐츠 큐레이션 리포트
## {month_str}

### 성장편 후보: {len(growth)}개 문장
"""
    for i, s in enumerate(growth):
        report += f"\n{i+1}. **{s.get('author','?')}** — {s.get('text','')[:50]}...\n"
        report += f"   출처: {s.get('source','')}\n"
        report += f"   저작권: {s.get('copyrightNote','')}\n"

    report += f"\n### 힐링편 후보: {len(healing)}개 문구\n"
    for i, h in enumerate(healing):
        report += f"\n{i+1}. [{h.get('theme','')}] {h.get('text','')[:60]}...\n"
        report += f"   영감: {h.get('inspiration','')}\n"

    report += f"""
### 검수 체크리스트
- [ ] 성장편 저작권 검증 (사망일 확인)
- [ ] 성장편 출처 확인 (작품 실재 확인)
- [ ] 힐링편 톤/품질 검토
- [ ] 최종 승인

생성일: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}
"""
    filepath = f'{OUTPUT_DIR}/report_{month_str}.md'
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f'[리포트] ✓ {filepath}')

if __name__ == '__main__':
    print(f'=== 레터브릭 콘텐츠 파이프라인 ===')
    print(f'대상: {month_str}\n')
    growth = generate_growth()
    healing = generate_healing()
    generate_report(growth, healing)
    print(f'\n=== 완료 ===')
