# 스레드 자동 발행

Last updated: 2026-10-12

노션 「스레드 발행 큐」에서 **승인**한 글을 GitHub Actions가 매시 7분에 Threads에 올립니다.
초안은 절대 저절로 나가지 않습니다.

| 채널 | 계정 | 글 |
|------|------|----|
| `KO` | 사람이 쓴 문장 (가제) | 혐오와 AI의 시대, 문자로 이겨내기. 작가가 쓰고 승인 |
| `EN` | LetterBrick Korean | `public/ko-curriculum.js` 56일 커리큘럼을 영어권 학습자용 글로 변환 |

```
노션 큐 (초안 → 승인)
  → .github/workflows/threads-publish.yml (매시 7분, 채널별)
  → Threads API (글 올리기, 긴 글은 답글로 이어 붙이기)
  → 노션에 '발행됨' + 게시 링크 기록
```

## 노션 큐 규칙

| 속성 | 쓰임 |
|------|------|
| 제목 | 내부용 이름. 스레드에는 안 올라감 |
| 채널 | `KO` / `EN` |
| 상태 | 초안 → **승인** → 발행 중 → 발행됨 / 실패 |
| 발행 시각 | 이 시각 이후 첫 실행에서 올라감 (서울 시간) |
| 기둥 | 콘텐츠 분류 |
| 게시 링크 · 발행된 시각 | 발행 후 자동으로 채워짐 |
| 메모 | 실패 이유가 자동으로 적힘 |
| 출처 | 숫자·인용 출처와 승인 전에 확인할 점 |

본문은 각 페이지 안에 씁니다.

- 한 줄은 한 줄, 빈 줄은 빈 줄 그대로 올라갑니다.
- 구분선(`---`)을 넣으면 다음 글이 답글로 이어 붙습니다. 긴 글을 나눌 때 씁니다.
- 글 하나는 500자 이하입니다.
- 글, 제목, 인용, 목록 블록만 됩니다. 이미지와 들여쓴 블록은 실패로 돌려보냅니다.

안전장치:

- `[[ ]]`로 표시한 채울 자리가 남아 있으면 올리지 않습니다.
- 발행 시각이 24시간 넘게 지난 글은 올리지 않고 **실패**로 돌립니다. 시각을 고치고 다시 승인하면 됩니다.
- 채널마다 한 번 실행에 한 개씩만 올립니다. 밀린 글이 한꺼번에 쏟아지지 않습니다.
- 올리기 직전에 **발행 중**으로 바꿉니다. 도중에 멈춘 글은 **발행 중**으로 남고 다시 올라가지 않습니다. 스레드에 올라갔는지 직접 확인해 주세요.

## 처음 설정 (한 번만)

### 1. Threads 계정

채널마다 Threads 계정이 하나씩 필요합니다. Threads 계정은 인스타그램 계정으로 만들고, 프로필은 공개로 둡니다.

### 2. Meta 앱과 토큰

Meta 화면의 메뉴 이름은 자주 바뀝니다. 막히면 공식 문서를 보세요:
https://developers.facebook.com/docs/threads/get-started

1. https://developers.facebook.com/apps 에서 앱을 만들고, 사용 사례로 Threads API 액세스를 고릅니다.
2. 사용 사례 설정에서 권한 `threads_basic`, `threads_content_publish`를 켭니다.
3. 앱 역할에 KO·EN 계정을 Threads 테스터로 추가합니다. 각 계정의 Threads 설정 → 계정 → 웹사이트 권한 → 초대에서 수락합니다.
4. 사용 사례 설정의 사용자 토큰 생성기에서 계정별 토큰을 받습니다.
5. 받은 토큰이 1시간짜리 단기 토큰이면 60일짜리 장기 토큰으로 바꿉니다. 이미 장기 토큰이면 이 명령은 오류를 냅니다.

   ```bash
   curl -s "https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=앱_시크릿&access_token=단기_토큰"
   ```

토큰은 채팅이나 노션에 붙여 넣지 말고 바로 GitHub Secrets에 넣습니다.

### 3. 노션 통합

1. https://www.notion.so/profile/integrations 에서 내부 통합을 만듭니다. 기능은 콘텐츠 읽기와 콘텐츠 업데이트를 켭니다.
2. 통합 토큰을 복사합니다.
3. 「스레드 발행 큐」 데이터베이스의 ••• → 연결에서 방금 만든 통합을 추가합니다.
4. 큐의 데이터소스 ID는 노션 「스레드 자동화」 안내 페이지에 적혀 있습니다.

### 4. GitHub Secrets

저장소 Settings → Secrets and variables → Actions → New repository secret:

| 이름 | 값 |
|------|----|
| `NOTION_TOKEN` | 노션 통합 토큰 |
| `NOTION_THREADS_DATA_SOURCE_ID` | 큐 데이터소스 ID |
| `THREADS_TOKEN_KO` | KO 계정 장기 토큰 |
| `THREADS_TOKEN_EN` | EN 계정 장기 토큰 |
| `THREADS_SECRETS_PAT` (선택) | 토큰 자동 갱신용. 이 저장소 하나에 Secrets 읽기·쓰기 권한만 준 fine-grained PAT |

한 채널만 먼저 쓰려면 그 채널 토큰만 넣으면 됩니다. 토큰이 없는 채널은 건너뜁니다.

### 5. main에 합치기

예약 실행(schedule)은 기본 브랜치(`main`)에 있는 워크플로만 돌아갑니다.

### 6. 점검 실행

Actions → Threads Publish → Run workflow에서 '점검만 하기'를 켠 채 실행합니다.
실행 요약에 계정 이름과 올릴 예정인 글 수가 나오면 연결이 끝난 것입니다.
글은 올라가지 않고 노션도 바뀌지 않습니다.

## 토큰 갱신

장기 토큰은 60일 동안 유효하고, 받은 지 24시간이 지나면 새로 받을 수 있습니다
(https://developers.facebook.com/docs/threads/get-started/long-lived-tokens).

Threads Token Refresh 워크플로가 매월 1일·15일에 토큰을 확인합니다.

- `THREADS_SECRETS_PAT`가 있으면 새 토큰을 받아 Secrets에 바로 저장합니다.
- 없으면 토큰이 살아 있는지만 확인합니다. 이때는 50일쯤마다 2단계를 다시 해서 토큰을 바꿔 주세요.
- 토큰이 이미 만료됐으면 실행이 실패합니다. 2단계부터 다시 하면 됩니다.

## 영어 채널 글 다시 만들기

```bash
npm run --silent threads:en-queue -- --start=2026-12-10 --time=22:00 > en-posts.json
```

시작일부터 하루에 하나씩, 서울 시간 기준 같은 시각에 놓인 글 목록이 나옵니다.
`--from`, `--to`로 일차 범위를, `--url`로 7일마다 붙는 안내 링크를 바꿀 수 있습니다.
결과를 노션 큐에 초안으로 넣으면 됩니다.

## 알아 둘 것

- 공개 저장소라 Actions 로그도 공개됩니다. 스크립트는 글 본문, 제목, 토큰을 로그에 남기지 않습니다.
- 공개 저장소에서는 60일 동안 저장소 활동이 없으면 GitHub가 예약 실행을 멈춥니다. 멈추면 Actions 탭에서 워크플로를 다시 켜 주세요.
- 실행이 실패하면 GitHub 알림 설정에 따라 메일이 옵니다. 실패는 글이 나가지 않았다는 뜻이니 노션 메모를 확인하세요.
- 테스트: `npm run test:threads`

## 파일

| 파일 | 역할 |
|------|------|
| `scripts/threads/publish.cjs` | 승인된 글을 찾아 올리고 노션에 기록 |
| `scripts/threads/refresh-token.cjs` | 토큰 확인·갱신 |
| `scripts/threads/curriculum-posts.cjs` | 커리큘럼 → EN 채널 글 |
| `scripts/threads/lib.cjs` | 노션 블록 → 글 변환, 글자 수 검사, 시각 계산 |
| `scripts/threads/notion.cjs`, `threads-api.cjs` | API 클라이언트 |
| `scripts/threads/threads.test.cjs` | 테스트 |
| `.github/workflows/threads-publish.yml` | 매시 발행 |
| `.github/workflows/threads-token-refresh.yml` | 매월 1일·15일 토큰 갱신 |
