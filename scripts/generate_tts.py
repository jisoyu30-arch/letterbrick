"""
레터브릭 TTS 낭독 자동 생성
힐링편 후보 JSON에서 텍스트를 읽어 MP3 생성

사용법:
  python scripts/generate_tts.py
"""

import asyncio, json, os, glob

OUTPUT_DIR = 'public/audio'
CANDIDATES_DIR = 'data/candidates'
VOICE = 'ko-KR-SunHiNeural'
RATE = '-20%'
PITCH = '-4Hz'

async def generate():
    try:
        import edge_tts
    except ImportError:
        print('edge-tts not installed. Run: pip install edge-tts')
        return

    # Find latest healing candidates
    files = sorted(glob.glob(f'{CANDIDATES_DIR}/healing_candidates_*.json'))
    if not files:
        print('No healing candidates found. Run generate_content.py first.')
        return

    latest = files[-1]
    print(f'Loading: {latest}')
    with open(latest, 'r', encoding='utf-8') as f:
        passages = json.load(f)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for i, p in enumerate(passages):
        text = p.get('text', '')
        if not text:
            continue
        filename = f'{OUTPUT_DIR}/candidate_healing_{i+1:02d}.mp3'
        print(f'  Generating {filename} ({len(text)} chars)...', end=' ', flush=True)
        comm = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
        await comm.save(filename)
        print('OK')

    print(f'\n✓ {len(passages)} files generated')

if __name__ == '__main__':
    asyncio.run(generate())
