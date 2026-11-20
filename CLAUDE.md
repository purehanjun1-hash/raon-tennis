# CLAUDE.md

프로젝트 상세 내용은 `PROJECT.md`를 참고한다.

## 작업 진행 규칙 (모든 코딩 작업에 기본 적용)

- 오타 수정, 단순 조회, 지시가 명확한 작업은 질문 없이 바로 수행한다.
- 요청에 상위 목표(Why), 대상(Who), 완료 기준(Success), 제약 조건(Constraint) 중 하나라도 빠져 있어서 방향이 달라질 수 있다면, 계획·코드 작성 전에 반드시 `interview-me` 스킬(`.claude/skills/interview-me`)을 먼저 실행한다.
- 인터뷰로 의도가 확정되면 목표(Why)와 하지 않을 것(Out of scope)을 `docs/intent/<주제>.md` 파일로 저장하고, 새 세션에서 깔끔하게 구현할 수 있도록 그 자리에서 턴을 멈춘다.
