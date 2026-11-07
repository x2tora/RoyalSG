# 로얄상구 작업 지침

작업 전에 [에이전트 인수인계 가이드](docs/AGENT_GUIDE.md)를 읽는다. 현재 사용자 요청과 실제 소스·DB 상태가 문서보다 우선한다.

- 가정을 먼저 밝히고, 요청과 직접 관련된 최소 변경만 한다.
- 구현하지 않은 기능이나 확인하지 않은 배포·검증 결과를 완료했다고 쓰지 않는다.
- 검증 생략 요청이 있으면 존중하고 결과에 생략 범위를 명시한다.
- 커밋과 PR 설명은 한국어로 작성한다. 푸시·배포 등 외부 변경은 현재 요청의 승인 범위에 따른다.
- Next.js가 관리하는 아래 블록은 유지한다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
