#!/usr/bin/env bash
# 로컬 DB(127.0.0.1:54322)의 public 스키마에서 TypeScript 타입을 만든다(ARCHITECTURE §5 2단계, 로드맵 SV-10).
#   사용: scripts/gen-types.sh           → supabase/types/database.gen.ts 를 다시 쓴다(합치기 창에서 리드가 커밋)
#         scripts/gen-types.sh --check   → 다시 만들어 커밋된 파일과 비교, 다르면 차이를 보여 주고 exit 1(쓰지 않음)
# 전제: 로컬 스택이 켜져 있고 supabase/migrations 가 모두 적용돼 있다(`npx supabase migration up`).
#       원격(staging·production)에서는 만들지 않는다 — 타입의 기준은 저장소의 마이그레이션이다.
# 한계: jsonb 반환은 Json 타입이다. 반환 형태는 app/src/api/contract 에 손으로 쓰고 통합 테스트가 검증한다(ARCH §5).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/supabase/types/database.gen.ts"
MODE="${1:-write}"
case "$MODE" in
  write | --check) ;;
  *)
    echo "사용: scripts/gen-types.sh [--check]" >&2
    exit 2
    ;;
esac

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

cd "$ROOT"
{
  echo "// 자동 생성: scripts/gen-types.sh (supabase gen types --local --schema public). 손으로 고치지 않는다."
  npx --yes supabase gen types --lang typescript --local --schema public 2>/dev/null
} >"$TMP"

# 생성 실패(로컬 스택 꺼짐 등) 시 빈 파일로 덮어쓰지 않는다
if ! grep -q "export type Database" "$TMP"; then
  echo "타입 생성 실패: 로컬 스택이 켜져 있는지(npx supabase status) 확인하세요." >&2
  exit 3
fi

if [ "$MODE" = "--check" ]; then
  if [ ! -f "$OUT" ]; then
    echo "없음: $OUT — scripts/gen-types.sh 로 먼저 만드세요." >&2
    exit 1
  fi
  if diff -u "$OUT" "$TMP"; then
    echo "타입 최신: $OUT"
    exit 0
  fi
  echo "타입이 마이그레이션과 다릅니다. scripts/gen-types.sh 로 다시 만들어 커밋하세요." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
cp "$TMP" "$OUT"
echo "생성: $OUT ($(wc -l <"$OUT" | tr -d ' ')줄)"
