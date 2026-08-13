"""
한국어 위키문헌(ko.wikisource.org)에서 시드 문장 코퍼스 수집.

라이선스: CC BY-SA 4.0 (저작권 만료 작품 + 사용자 기여 텍스트).
사용 시 출처 표기 권장.

사용법:
  python collect_wikisource.py --max_total_sentences 5000
"""

import argparse
import hashlib
import json
import re
import time
from pathlib import Path

import requests
from tqdm import tqdm

API = "https://ko.wikisource.org/w/api.php"

DEFAULT_CATEGORIES = [
    "분류:한국의_단편_소설",
    "분류:한국의_시",
    "분류:한국의_수필",
    "분류:한국_문학",
    "분류:한국의_저작권_만료_저작물",
]

USER_AGENT = "LetterBrickDatasetBot/1.0 (research; contact via project)"


def fetch_category_pages(category: str, limit: int = 500) -> list[dict]:
    params = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": category,
        "cmlimit": min(limit, 500),
        "cmtype": "page",
        "format": "json",
    }
    pages: list[dict] = []
    while True:
        r = requests.get(API, params=params, headers={"User-Agent": USER_AGENT}, timeout=30)
        r.raise_for_status()
        data = r.json()
        members = data.get("query", {}).get("categorymembers", [])
        pages.extend(members)
        cont = data.get("continue")
        if cont and len(pages) < limit:
            params.update(cont)
        else:
            break
    return pages[:limit]


def fetch_page_text(title: str) -> str:
    params = {
        "action": "query",
        "prop": "extracts",
        "explaintext": "true",
        "titles": title,
        "format": "json",
    }
    r = requests.get(API, params=params, headers={"User-Agent": USER_AGENT}, timeout=30)
    r.raise_for_status()
    pages = r.json().get("query", {}).get("pages", {})
    for _, p in pages.items():
        return p.get("extract", "") or ""
    return ""


_NEWLINE_RE = re.compile(r"\s+")
_SENT_BOUNDARY_RE = re.compile(r"(?<=[.!?。!?])\s+")
_KOREAN_END_RE = re.compile(r"(?<=[다요죠음])\.\s*")


def split_sentences(text: str) -> list[str]:
    text = _NEWLINE_RE.sub(" ", text)
    parts = _SENT_BOUNDARY_RE.split(text)
    sentences: list[str] = []
    for s in parts:
        s = s.strip()
        if not s:
            continue
        for sub in _KOREAN_END_RE.split(s):
            sub = sub.strip()
            if sub:
                sentences.append(sub)
    return sentences


_NUMBERED_LINE_RE = re.compile(r"^(\d+\.|제\s*\d+|\[\d+\]|\(\d+\))")
_KOREAN_CHAR_RE = re.compile(r"[가-힣]")


def is_good_sentence(s: str) -> bool:
    if len(s) < 15 or len(s) > 250:
        return False
    if _NUMBERED_LINE_RE.match(s):
        return False
    korean_count = len(_KOREAN_CHAR_RE.findall(s))
    if korean_count / max(len(s), 1) < 0.35:
        return False
    if s.count("=") >= 2:
        return False
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="seeds/wikisource_seeds.jsonl")
    parser.add_argument("--max_pages_per_cat", type=int, default=200)
    parser.add_argument("--max_total_sentences", type=int, default=10000)
    parser.add_argument("--categories", nargs="*", default=DEFAULT_CATEGORIES)
    args = parser.parse_args()

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    seen_hashes: set[str] = set()
    count = 0

    with out_path.open("w", encoding="utf-8") as f:
        for cat in args.categories:
            print(f"\n=== {cat} ===")
            try:
                pages = fetch_category_pages(cat, args.max_pages_per_cat)
            except Exception as e:
                print(f"  카테고리 조회 실패: {e}")
                continue
            print(f"  페이지 {len(pages)}개")

            for page in tqdm(pages, desc=cat):
                title = page.get("title", "")
                if title.startswith("분류:"):
                    continue
                try:
                    text = fetch_page_text(title)
                except Exception:
                    continue
                if not text:
                    continue

                for s in split_sentences(text):
                    if not is_good_sentence(s):
                        continue
                    h = hashlib.md5(s.encode("utf-8")).hexdigest()
                    if h in seen_hashes:
                        continue
                    seen_hashes.add(h)
                    rec = {
                        "id": h[:12],
                        "text": s,
                        "source": f"ko.wikisource:{title}",
                        "license": "CC-BY-SA-4.0",
                    }
                    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    count += 1
                    if count >= args.max_total_sentences:
                        break

                time.sleep(0.1)  # API 부하 분산

                if count >= args.max_total_sentences:
                    break
            if count >= args.max_total_sentences:
                break

    print(f"\n완료: 총 {count}개 시드 문장 → {out_path}")


if __name__ == "__main__":
    main()
