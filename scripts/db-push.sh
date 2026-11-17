#!/usr/bin/env bash
# 원격 Supabase 에 마이그레이션을 반영한다. 실행은 사용자만(DECISIONS 2026-11-17 운영 결정).
#   사용: scripts/db-push.sh staging | production
# 안전장치:
#   - 대상 ref 는 app/env/<환경>.env 의 SUPABASE_PROJECT_REF 에서만 읽는다(`supabase link` 상태에 기대지 않고 --remote=<ref> 로 지정)
#   - 먼저 --dry-run 으로 적용될 마이그레이션을 보여 준다
#   - 환경 이름과 ref 를 다시 입력해야 진행한다(production 은 실행 전 스키마 백업)
# 설계: docs/plans/09-environments.md §4, 사용법: docs/team/RELEASE.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_NAME="${1:-}"
case "$ENV_NAME" in
  staging | production) ;;
  *)
    echo "사용: scripts/db-push.sh staging|production" >&2
    exit 2
    ;;
esac

ENV_FILE="$ROOT/app/env/$ENV_NAME.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "중단: $ENV_FILE 가 없어요(${ENV_NAME}.env.example 을 복사해 채우세요)." >&2
  exit 1
fi

# 줄이 없어도 grep 실패로 조용히 끝나지 않게 || true, 아래 형식 검사가 안내한다
REF="$( (grep -E '^SUPABASE_PROJECT_REF=' "$ENV_FILE" || true) | head -1 | cut -d= -f2- | tr -d '[:space:]')"
if [[ ! "$REF" =~ ^[a-z]{20}$ ]]; then
  echo "중단: $ENV_FILE 의 SUPABASE_PROJECT_REF 가 올바른 ref(소문자 20자)가 아니에요: '$REF'" >&2
  exit 1
fi

# staging 과 production 이 같은 ref 를 가리키면 멈춘다(복사 실수 방지)
OTHER_NAME=$([[ "$ENV_NAME" == staging ]] && echo production || echo staging)
OTHER_FILE="$ROOT/app/env/$OTHER_NAME.env"
if [[ -f "$OTHER_FILE" ]]; then
  OTHER_REF="$( (grep -E '^SUPABASE_PROJECT_REF=' "$OTHER_FILE" || true) | head -1 | cut -d= -f2- | tr -d '[:space:]')"
  if [[ "$OTHER_REF" == "$REF" ]]; then
    echo "중단: $ENV_NAME 과 $OTHER_NAME 의 ref 가 같아요($REF). env 파일을 확인하세요." >&2
    exit 1
  fi
fi

cd "$ROOT"
SUPABASE=(npx --no-install supabase)

# production: 반영되는 마이그레이션은 "지금 작업 트리"의 supabase/migrations 이므로 main·깨끗한 트리·원격과 같은 커밋만 허용
if [[ "$ENV_NAME" == production ]]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$BRANCH" != main ]]; then
    echo "중단: production 반영은 main 에서만 해요(지금 '$BRANCH')." >&2
    exit 1
  fi
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "중단: 커밋 안 된 변경이 있어요. production 에는 커밋된 마이그레이션만 반영합니다." >&2
    git status --short supabase/ >&2 || true
    exit 1
  fi
  if git remote get-url origin >/dev/null 2>&1; then
    git fetch --quiet origin main
    if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
      echo "중단: 로컬 main 이 origin/main 과 달라요. pull/push 로 맞춘 뒤 다시 실행하세요." >&2
      exit 1
    fi
  else
    echo "주의: 원격 저장소(origin)가 없어 원격과 같은 커밋인지 확인하지 못했어요(로컬 main 기준으로 진행)."
  fi
fi

echo "────────────────────────────────────────"
echo " 대상 환경 : $ENV_NAME"
echo " 대상 ref  : $REF  (https://$REF.supabase.co)"
echo " 원본      : app/env/$ENV_NAME.env"
LINKED="$(cat supabase/.temp/project-ref 2>/dev/null || true)"
if [[ -n "$LINKED" && "$LINKED" != "$REF" ]]; then
  echo " 참고      : 현재 link 된 프로젝트는 $LINKED (이 스크립트는 link 를 쓰지 않고 위 ref 로만 보냄)"
fi
echo "────────────────────────────────────────"
echo
echo "1) 적용될 마이그레이션 미리 보기(--dry-run). DB 비밀번호를 물으면 입력하세요."
"${SUPABASE[@]}" db push --remote="$REF" --dry-run

echo
echo "위 목록을 확인했으면, 진행하려면 환경 이름과 ref 를 그대로 입력하세요."
read -r -p "환경 이름($ENV_NAME): " ANSWER_ENV
read -r -p "ref($REF): " ANSWER_REF
if [[ "$ANSWER_ENV" != "$ENV_NAME" || "$ANSWER_REF" != "$REF" ]]; then
  echo "입력이 달라서 멈췄어요. 아무것도 반영하지 않았습니다."
  exit 1
fi

if [[ "$ENV_NAME" == production ]]; then
  # 백업은 저장소 밖(커밋 금지), 본인만 읽기(umask 077). 스키마만 백업한다 — 데이터는 Pro 일일 백업(7일)/PITR 로 복원
  umask 077
  BACKUP_DIR="${BUMOJASIK_BACKUP_DIR:-$HOME/bumo-jasik-backups}"
  mkdir -p "$BACKUP_DIR"
  BACKUP="$BACKUP_DIR/production-schema-$(date +%Y%m%d-%H%M%S).sql"
  echo
  echo "2) production 스키마 백업 → $BACKUP"
  "${SUPABASE[@]}" db dump --remote="$REF" -f "$BACKUP"
fi

echo
echo "3) db push → $ENV_NAME ($REF)"
"${SUPABASE[@]}" db push --remote="$REF"
echo
echo "완료: $ENV_NAME($REF) 반영. 다음: $ENV_NAME 앱으로 확인(docs/team/RELEASE.md)."
