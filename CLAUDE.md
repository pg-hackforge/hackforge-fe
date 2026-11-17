# hackforge-fe

Hackforge 프론트엔드. React + Vite SPA, TypeScript(strict), Tailwind CSS v4 + shadcn/ui(Base UI), Node 26 LTS. 결정과 이유는 `../hackforge-docs/decisions/015-fe-스택.md`.

## 먼저 읽을 것

- 무엇을 왜 만드는지: `../hackforge-docs/product.md`, 결정은 `../hackforge-docs/decisions/`
- 작업 중인 기능: `../hackforge-docs/specs/<기능>/tasks.md`
- API spec: `../hackforge-be/openapi.yaml`. 타입과 API client는 이 파일로 codegen하고 손으로 쓰지 않는다. API를 바꿔야 하면 백엔드 spec PR이 먼저다.

## 명령

- `npm run dev`: 개발 서버
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`: CI와 같은 확인. PR 전에 모두 통과해야 한다
- `npm run format`: Prettier로 정리(Tailwind class 순서 포함)
- `npx shadcn@latest add <컴포넌트>`: shadcn/ui 컴포넌트 추가. 추가 뒤 `npm run format`

## 작업 규칙

- `tasks.md`의 `[fe]` 작업을 한 번에 하나씩 구현한다.
- API가 바뀌는 기능은 hackforge-be PR이 머지·배포된 뒤에 머지한다.
- 사람은 코드보다 화면으로 리뷰한다. 디자인 완성도와 UX를 우선하고, PR에는 확인할 화면 목록과 실행 방법(`npm install`, `npm run dev`, 볼 경로와 상태)을 적는다.
- 색과 글꼴은 `src/index.css`의 토큰만 쓴다. 컴포넌트에 색 값을 직접 쓰지 않는다.
- import는 `@/` alias를 쓴다(`src/` 기준).
- 화면과 무관한 로직은 `src/lib/`에 두고 Vitest로 테스트한다.

## Git

- GitHub Flow. `main`에서 짧은 브랜치(`feat/...`, `fix/...`)를 따서 PR로 머지하고, `main`에 직접 push하지 않는다.
- PR 하나에 `tasks.md` 작업 1~3개만 담는다. 본문은 PR 템플릿 섹션을 모두 채운다(근거에 이슈와 작업 번호).
- 커밋 접두어: `feat:` `fix:` `docs:` `chore:`
- 커밋 본문에는 diff로 알 수 없는 이유만 한두 줄 쓴다. 뻔한 변경은 제목 한 줄로 끝낸다.
- 라벨: `feature` `bug` `be` `fe` `infra`
- `suhodang/<이 저장소 이름>`은 `main`과 tag를 자동으로 덮어쓰는 read-only mirror다(`.github/workflows/mirror.yml`). 거기서 작업하지 않는다.
