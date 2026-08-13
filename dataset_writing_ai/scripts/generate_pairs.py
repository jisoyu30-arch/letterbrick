"""
시드 문장에서 첨삭 페어 합성.

각 시드 문장을 무작위 카테고리에 따라 의도적으로 망가뜨려 "거친 버전"을 만들고,
(거친 버전, 다듬어진 원본) 페어를 JSONL로 저장한다.

Claude API 사용. 시스템 프롬프트는 prompt caching 적용 → 두 번째 호출부터 input 비용 90% 절감.

사용법:
  python generate_pairs.py --limit 5000
  python generate_pairs.py --resume          # 중단된 작업 이어서
  python generate_pairs.py --model claude-sonnet-4-6 --effort low   # 비용 우선
"""

import argparse
import json
import os
import random
import sys
import time
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from tqdm import tqdm

# scripts/ 폴더에서 import
sys.path.insert(0, str(Path(__file__).parent))
from prompts import CATEGORIES, RESPONSE_SCHEMA, SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

# per 1M tokens (USD)
PRICING = {
    "claude-opus-4-7": {"input": 5.00, "output": 25.00, "cache_write": 6.25, "cache_read": 0.50},
    "claude-opus-4-6": {"input": 5.00, "output": 25.00, "cache_write": 6.25, "cache_read": 0.50},
    "claude-sonnet-4-6": {"input": 3.00, "output": 15.00, "cache_write": 3.75, "cache_read": 0.30},
    "claude-haiku-4-5": {"input": 1.00, "output": 5.00, "cache_write": 1.25, "cache_read": 0.10},
}


def load_seeds(path: Path) -> list[dict]:
    seeds: list[dict] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                seeds.append(json.loads(line))
    return seeds


def load_processed_ids(path: Path) -> set[str]:
    if not path.exists():
        return set()
    ids: set[str] = set()
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
                if rec.get("seed_id"):
                    ids.add(rec["seed_id"])
            except json.JSONDecodeError:
                pass
    return ids


def generate_one(
    client: anthropic.Anthropic,
    model: str,
    effort: str,
    seed_text: str,
    category: str,
) -> dict | None:
    cat_def = CATEGORIES[category]
    user_msg = USER_PROMPT_TEMPLATE.format(
        category=category,
        category_description=cat_def["description"],
        instruction=cat_def["instruction"],
        seed=seed_text,
    )

    try:
        resp = client.messages.create(
            model=model,
            max_tokens=1024,
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            output_config={
                "format": {"type": "json_schema", "schema": RESPONSE_SCHEMA},
                "effort": effort,
            },
            messages=[{"role": "user", "content": user_msg}],
        )
    except anthropic.RateLimitError:
        time.sleep(30)
        return None
    except anthropic.APIError as e:
        print(f"\n  API error: {e}", file=sys.stderr)
        return None

    text = "".join(b.text for b in resp.content if b.type == "text")
    if not text.strip():
        return None
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        parsed = json.loads(text[start:end])
    except json.JSONDecodeError:
        print(f"\n  JSON parse failed: {text[:120]!r}", file=sys.stderr)
        return None

    return {
        "parsed": parsed,
        "usage": resp.usage,
    }


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="seeds/wikisource_seeds.jsonl")
    parser.add_argument("--output", default="pairs/synthetic_pairs.jsonl")
    parser.add_argument("--limit", type=int, default=None, help="처리할 최대 시드 수")
    parser.add_argument(
        "--model",
        default=os.getenv("ANTHROPIC_MODEL", "claude-opus-4-7"),
        help="Claude 모델 ID (claude-opus-4-7 / claude-sonnet-4-6 / claude-haiku-4-5)",
    )
    parser.add_argument(
        "--effort",
        default=os.getenv("EFFORT", "low"),
        choices=["low", "medium", "high", "max"],
    )
    parser.add_argument("--resume", action="store_true", help="기존 출력 이어쓰기")
    parser.add_argument("--seed", type=int, default=42, help="카테고리 무작위화 시드")
    args = parser.parse_args()

    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.", file=sys.stderr)
        sys.exit(1)

    random.seed(args.seed)
    client = anthropic.Anthropic()

    in_path = Path(args.input)
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    seeds = load_seeds(in_path)
    processed = load_processed_ids(out_path) if args.resume else set()
    todo = [s for s in seeds if s.get("id") not in processed]
    if args.limit:
        todo = todo[: args.limit]

    print(f"입력: {in_path} ({len(seeds):,}개 시드)")
    print(f"출력: {out_path}")
    print(f"이미 처리됨: {len(processed):,}개")
    print(f"이번 실행에서 처리: {len(todo):,}개")
    print(f"모델: {args.model}, effort: {args.effort}")
    print()

    if not todo:
        print("처리할 시드가 없습니다.")
        return

    cat_names = list(CATEGORIES.keys())
    total_in = total_out = total_cw = total_cr = 0
    success = fail = 0

    mode = "a" if args.resume else "w"
    with out_path.open(mode, encoding="utf-8") as out_f:
        pbar = tqdm(todo, desc="페어 생성")
        for seed in pbar:
            category = random.choice(cat_names)
            seed_text = seed["text"]

            result = generate_one(client, args.model, args.effort, seed_text, category)
            if result is None:
                fail += 1
                pbar.set_postfix(success=success, fail=fail)
                continue

            parsed = result["parsed"]
            usage = result["usage"]

            record = {
                "seed_id": seed.get("id"),
                "category": category,
                "rough": parsed.get("rough"),
                "polished": seed_text,
                "explanation": parsed.get("explanation"),
                "source": seed.get("source"),
                "license": seed.get("license"),
                "model": args.model,
            }
            out_f.write(json.dumps(record, ensure_ascii=False) + "\n")
            out_f.flush()

            total_in += usage.input_tokens
            total_out += usage.output_tokens
            total_cw += getattr(usage, "cache_creation_input_tokens", 0) or 0
            total_cr += getattr(usage, "cache_read_input_tokens", 0) or 0
            success += 1
            pbar.set_postfix(success=success, fail=fail, cache_hit=f"{total_cr:,}")

    p = PRICING.get(args.model, PRICING["claude-opus-4-7"])
    cost = (
        total_in * p["input"]
        + total_out * p["output"]
        + total_cw * p["cache_write"]
        + total_cr * p["cache_read"]
    ) / 1_000_000

    print()
    print("=== 완료 ===")
    print(f"성공: {success:,}, 실패: {fail:,}")
    print(f"입력 토큰 (full price): {total_in:,}")
    print(f"출력 토큰: {total_out:,}")
    print(f"캐시 쓰기 토큰: {total_cw:,}")
    print(f"캐시 읽기 토큰 (90% 할인): {total_cr:,}")
    print(f"예상 비용: ${cost:.4f}")
    print(f"출력 파일: {out_path}")


if __name__ == "__main__":
    main()
