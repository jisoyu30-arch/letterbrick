# LetterBrick 글쓰기 첨삭 학습 데이터셋

사용자가 작성한 문장을 분석하고 더 나은 문장 구조로 다듬는 비공개 학습 모델을 위한 데이터셋 구축 파이프라인.

> ⚠️ **데이터 사용 시 라이선스·출처 표기 의무가 있습니다. 본 폴더의 데이터를 활용하기 전 반드시 [NOTICE.md](./NOTICE.md)를 확인하세요.**
>
> 핵심 요약:
> - **AI Hub 데이터는 학습용. 학습된 모델·서비스(2차 저작물)는 영리 활용 가능** (LetterBrick 적용)
> - **출처 표기 필수** — LetterBrick 푸터/약관/개인정보처리방침에 NIA 사업 명시
> - **데이터셋 자체 외부 노출·공유·배포 금지** — `seeds/`, `pairs/`는 git 제외 + 한국 리전 비공개 저장소만
> - 학습은 한국 리전 인프라에서만 수행

## 폴더 구조

```
dataset_writing_ai/
├── README.md
├── requirements.txt
├── .env.example          # 환경변수 템플릿 (.env로 복사 후 사용)
├── .gitignore            # raw 데이터·키 git 제외
├── seeds/                # 시드 문장 코퍼스 (출처별 JSONL)
├── pairs/                # 합성된 첨삭 페어 (JSONL)
└── scripts/
    ├── prompts.py            # 카테고리 정의 + 시스템 프롬프트
    ├── collect_wikisource.py # 위키문헌 시드 수집
    └── generate_pairs.py     # Claude API 페어 합성
```

## 설치

```bash
cd dataset_writing_ai
python -m venv .venv
.venv\Scripts\activate          # Windows (PowerShell: .venv\Scripts\Activate.ps1)
pip install -r requirements.txt
copy .env.example .env          # Linux/Mac: cp .env.example .env
```

`.env` 파일을 열어 `ANTHROPIC_API_KEY`를 본인 키로 교체. 모델·effort는 기본값(`claude-opus-4-7`, `low`)으로 두면 됩니다.

## 1단계 — 위키문헌 시드 수집 (라이선스: CC BY-SA 4.0)

```bash
cd scripts
python collect_wikisource.py --max_total_sentences 5000
```

위키문헌(ko.wikisource.org) 한국 문학·수필 카테고리에서 한국어 문장을 추출해 `seeds/wikisource_seeds.jsonl`로 저장. 길이·한국어 비율 필터링 + 중복 제거.

옵션:
- `--max_pages_per_cat 200`: 카테고리당 페이지 수 (기본 200)
- `--max_total_sentences 10000`: 총 시드 상한 (기본 10000)
- `--categories "분류:한국의_시" "분류:한국의_수필"`: 특정 카테고리만

## 2단계 — Claude API로 첨삭 페어 합성

```bash
python generate_pairs.py --limit 5000
```

각 시드 문장을 무작위 카테고리(어색한 어순, 중복 표현, 만연체, 번역체 등 10가지) 방식으로 의도적으로 망가뜨려 거친 버전을 만듭니다. 결과는 `pairs/synthetic_pairs.jsonl`.

페어 레코드 형식:
```json
{
  "seed_id": "a1b2c3d4e5f6",
  "category": "어색한_어순",
  "rough": "사과를 빨간색의 큰 것을 그가 먹었다.",
  "polished": "그는 크고 빨간 사과를 먹었다.",
  "explanation": "수식어 위치가 한국어답지 않아 흐름이 끊깁니다. 명사 앞으로 정리하면 자연스럽습니다.",
  "source": "ko.wikisource:...",
  "license": "CC-BY-SA-4.0",
  "model": "claude-opus-4-7"
}
```

옵션:
- `--limit 1000`: 처리할 시드 수 제한 (테스트용)
- `--resume`: 중단된 작업 이어서
- `--model claude-sonnet-4-6`: 비용 절반으로 (품질 약간 ↓)
- `--model claude-haiku-4-5`: 비용 1/5로 (품질 더 ↓)
- `--effort medium`: 더 정성 있는 출력 (비용·시간 ↑)

### Prompt caching 효과

시스템 프롬프트(약 1.5K 토큰)에 `cache_control` 적용 → 두 번째 호출부터 input 비용 90% 절감. 대량 생성 시 비용 차이가 큽니다.

### 비용 추정 (5000 페어 기준, Opus 4.7, effort=low)

- 캐시 미적용 input: 첫 1회만 ~1500 tok = 무시 가능
- 캐시 적용 input (read): 4999 × ~1500 = ~7.5M tok × $0.50 = **$3.75**
- 사용자 메시지 (캐시 외): 5000 × ~150 = 0.75M × $5 = **$3.75**
- 출력: 5000 × ~150 = 0.75M × $25 = **$18.75**
- **합계 약 $26**

Sonnet 4.6으로 바꾸면 약 $15, Haiku 4.5로 바꾸면 약 $5. 첫 시도는 Sonnet으로 1000개 정도 만들어 품질 보고 결정 권장.

## 3단계 — AI Hub 데이터 통합

LetterBrick의 글쓰기 첨삭 시나리오에 직접적인 데이터셋들. 가입 후 데이터별 활용 신청 → 승인(보통 1~3일) → 다운로드.

검색해서 신청할 데이터셋(키워드):
- **"한국어 어문 규범"** — 맞춤법·띄어쓰기 교정 페어. 첨삭 모델의 핵심.
- **"한국어 학습자 말뭉치"** — 학습자 작문 + 첨삭본 페어.
- **"문어 말뭉치"** — 다양한 글쓰기 톤의 한국어 문장 풀.
- **"자기소개서"** 또는 **"에세이 평가"** — 글쓰기 평가 기준 학습.
- **"감성 분석 / 의도 분류"** 한국어 데이터 — 사용자 입력 분석에 보조.

신청 시 활용 목적란 작성 가이드:
> "한국어 글쓰기 학습 보조 도구를 위한 비공개 모델 학습. 사용자가 작성한 문장의 자연스러움과 문법성을 분석하고, 더 나은 표현을 제안하는 시스템에 활용. 외부 배포·재배포 없음."

신청 결과 다운로드한 데이터는 `seeds/aihub_<dataset_name>/` 형태로 두고, 추후 통합 정제 스크립트를 추가합니다.

## 4단계 — 모두의 말뭉치 (국립국어원, 무료)

`https://corpus.korean.go.kr` 회원가입 → 사용 신청 → 승인 후 다운로드.

- 신문·문어·구어·메신저 등 다양한 도메인
- 라이선스: 신청 시 명시된 비상업/상업 구분 확인
- 신청 후 보통 1~2일 내 승인

## 데이터 활용 시 주의사항

자세한 라이선스 의무·LetterBrick 적용 사항·운영 체크리스트는 **[NOTICE.md](./NOTICE.md)** 참조.

요점만:
- **AI Hub**: 학습된 2차 저작물(LetterBrick)의 영리 활용 명시적 허용. 단 출처 표기 의무, 데이터 자체 외부 공유 금지, 한국 리전 처리.
- **위키문헌**: CC BY-SA 4.0. 출처 표기.
- **Claude 합성 페어**: 시드 출처의 라이선스 상속.
- **공통**: `seeds/`·`pairs/` 폴더는 절대 git에 올리지 말 것. 한국 AI 기본법(2026.1 시행) 대응 위해 데이터 출처 내부 기록 유지.

## 다음 단계 권장

1. 1단계 위키문헌 시드 수집 (10분~30분)
2. AI Hub·모두의 말뭉치 가입·신청 (오늘 한 번에 처리)
3. 2단계 페어 생성 — 먼저 `--limit 200 --model claude-sonnet-4-6`로 샘플 보고 품질 평가
4. 품질 OK면 본 생성 (`--limit 5000`)
5. AI Hub 승인 후 데이터 통합 정제
6. 통합 데이터셋으로 파인튜닝 또는 RAG 인덱스 구축
