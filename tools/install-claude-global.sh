#!/usr/bin/env bash
# 내 컴퓨터의 모든 프로젝트(Orca 포함)에 interview-me 스킬과 작업 규칙을 적용한다.
# 사용법: bash tools/install-claude-global.sh   (여러 번 실행해도 안전)
set -euo pipefail
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SKILL_DIR="$CLAUDE_DIR/skills/interview-me"
URL="https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/interview-me/SKILL.md"

mkdir -p "$SKILL_DIR"
curl -fsSL "$URL" -o "$SKILL_DIR/SKILL.md"
echo "✓ 스킬 설치: $SKILL_DIR/SKILL.md"

MD="$CLAUDE_DIR/CLAUDE.md"
MARK="<!-- interview-me-rules -->"
touch "$MD"
if grep -qF "$MARK" "$MD"; then
  echo "✓ 규칙이 이미 $MD 에 있습니다 (건너뜀)"
else
  cat >> "$MD" <<'RULES'

<!-- interview-me-rules -->
## 작업 진행 규칙 (모든 프로젝트, 모든 코딩 작업에 기본 적용)

- 오타 수정, 단순 조회, 지시가 명확한 작업은 질문 없이 바로 수행한다.
- 요청에 상위 목표(Why), 대상(Who), 완료 기준(Success), 제약 조건(Constraint) 중 하나라도 빠져 있어서 방향이 달라질 수 있다면, 계획·코드 작성 전에 반드시 `interview-me` 스킬을 먼저 실행한다.
- 인터뷰로 의도가 확정되면 목표(Why)와 하지 않을 것(Out of scope)을 `docs/intent/<주제>.md` 파일로 저장하고, 새 세션에서 깔끔하게 구현할 수 있도록 그 자리에서 턴을 멈춘다.
RULES
  echo "✓ 규칙 추가: $MD"
fi
echo "완료. Orca에서 Claude Code를 새로 열면 적용됩니다."
