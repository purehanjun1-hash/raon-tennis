# Windows용: 내 컴퓨터의 모든 프로젝트(Orca 포함)에 interview-me 스킬과 작업 규칙을 적용한다.
# 사용법: powershell -ExecutionPolicy Bypass -File tools\install-claude-global.ps1
$ErrorActionPreference = "Stop"
$ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$SkillDir = Join-Path $ClaudeDir "skills\interview-me"
New-Item -ItemType Directory -Force -Path $SkillDir | Out-Null
Invoke-WebRequest "https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/interview-me/SKILL.md" -OutFile (Join-Path $SkillDir "SKILL.md")
Write-Host "스킬 설치: $SkillDir"

$Md = Join-Path $ClaudeDir "CLAUDE.md"
$Mark = "<!-- interview-me-rules -->"
if (-not (Test-Path $Md)) { New-Item -ItemType File -Path $Md | Out-Null }
if ((Get-Content $Md -Raw -Encoding UTF8) -like "*$Mark*") {
  Write-Host "규칙이 이미 있습니다 (건너뜀)"
} else {
  $Rules = @"

$Mark
## 작업 진행 규칙 (모든 프로젝트, 모든 코딩 작업에 기본 적용)

- 오타 수정, 단순 조회, 지시가 명확한 작업은 질문 없이 바로 수행한다.
- 요청에 상위 목표(Why), 대상(Who), 완료 기준(Success), 제약 조건(Constraint) 중 하나라도 빠져 있어서 방향이 달라질 수 있다면, 계획·코드 작성 전에 반드시 ``interview-me`` 스킬을 먼저 실행한다.
- 인터뷰로 의도가 확정되면 목표(Why)와 하지 않을 것(Out of scope)을 ``docs/intent/<주제>.md`` 파일로 저장하고, 새 세션에서 깔끔하게 구현할 수 있도록 그 자리에서 턴을 멈춘다.
"@
  Add-Content -Path $Md -Value $Rules -Encoding UTF8
  Write-Host "규칙 추가: $Md"
}
Write-Host "완료. Orca에서 Claude Code를 새로 열면 적용됩니다."
