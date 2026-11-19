# hackforge-fe

Hackforge 프론트엔드. React + Vite SPA, TypeScript(strict), Tailwind CSS v4 + shadcn/ui(Base UI), Node 26 LTS. 결정과 이유는 `../hackforge-docs/decisions/015-fe-스택.md`.

## 먼저 읽을 것

- 무엇을 왜 만드는지: `../hackforge-docs/product.md`, 결정은 `../hackforge-docs/decisions/`
- 디자인: `DESIGN.md`(색·글꼴·배치·효과 규칙, 확정 화면 캡처는 `design/screens/`), 제품 맥락: `PRODUCT.md`. 결정은 `../hackforge-docs/decisions/016-fe-디자인-방향.md`
- 작업 중인 기능: `../hackforge-docs/specs/<기능>/tasks.md`
- API spec: `../hackforge-be/openapi.yaml`. 타입과 API client는 이 파일로 codegen하고 손으로 쓰지 않는다(`npm run api:sync`, 생성물은 `src/api/generated/`). API를 바꿔야 하면 백엔드 spec PR이 먼저다.
- API 호출은 생성된 SDK 함수와 TanStack Query로 한다. CSRF 헤더, 401, 오류 변환은 `src/api/client.ts`가 처리하므로 화면에서 다시 하지 않는다. 오류는 `ApiError`(`code`, 입력 칸별 `fieldErrors`)로 받는다

## 명령

- `npm run dev`: 개발 서버(`/api`는 개발 백엔드 `127.0.0.1:8080`으로 proxy)
- `npm run dev:mock`: 백엔드 없이 MSW 가짜 응답으로 띄움. 오른쪽 아래 패널에서 계정·실습 시나리오를 바꾼다. 새 API를 화면에서 쓰면 `src/mocks/handlers.ts`에 생성 타입으로 응답을 추가하고, 화면 상태별 확인과 PR 스크린샷은 이 모드로 한다
- `npm run api:sync`: 백엔드 `openapi.yaml`을 복사하고 생성물을 다시 만든다. 복사본과 생성물을 함께 커밋
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
- 새 화면은 `src/pages/`에 만들고 `src/routes.tsx`에 경로를 추가한다. 로그인이 필요하면 `RequireLogin`, 관리자만이면 `RequireAdmin`, 로그인 전 화면이면 `RequireLoggedOut` 아래에 둔다. 화면 테스트는 `src/test/app.tsx`의 `setupMockServer`와 `renderAt`으로 mock handler(`msw/node`)를 붙여 앱 전체를 띄운다(`src/routes.test.tsx`, `src/pages/auth-pages.test.tsx`).
- 입력 화면은 `src/components/form.tsx`의 `Field`(이름표, 칸별 오류, 도움말), `FormAlert`(폼 전체 안내), `PasswordRules`를 쓴다. form 라이브러리는 쓰지 않는다(ADR 018).
- 위험한 동작은 `src/components/dialog.tsx`의 `Dialog`로 확인 창을 거친다. 버튼은 `CancelButton`, `ActionButton`(사람을 막는 동작은 `danger`) 순서. 확인 창에서 실패하면 창을 닫고 안내를 보여 준다(열린 창 뒤의 안내는 보이지도 읽히지도 않음).
- 버튼 모양 링크는 `Button`이 아니라 `Link`에 `buttonVariants()`를 쓴다(Base UI `Button`은 `role="button"`을 붙여 링크 의미가 사라진다).

## Git

- GitHub Flow. `main`에서 짧은 브랜치(`feat/...`, `fix/...`)를 따서 PR로 머지하고, `main`에 직접 push하지 않는다.
- PR 하나에 `tasks.md` 작업 1~3개만 담는다. 본문은 PR 템플릿 섹션을 모두 채운다(근거에 이슈와 작업 번호).
- 커밋 접두어: `feat:` `fix:` `docs:` `chore:`
- 커밋 본문에는 diff로 알 수 없는 이유만 한두 줄 쓴다. 뻔한 변경은 제목 한 줄로 끝낸다.
- 라벨: `feature` `bug` `be` `fe` `infra`
- `suhodang/<이 저장소 이름>`은 `main`과 tag를 자동으로 덮어쓰는 read-only mirror다(`.github/workflows/mirror.yml`). 거기서 작업하지 않는다.
