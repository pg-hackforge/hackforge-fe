# hackforge-fe

Hackforge 프론트엔드. React + Vite SPA, TypeScript, Tailwind CSS + shadcn/ui다. 스택과 이유는 hackforge-docs `decisions/015-fe-스택.md`에 있다.

- 기획·spec: [hackforge-docs](../hackforge-docs)
- API spec: [hackforge-be/openapi.yaml](../hackforge-be/openapi.yaml)

## 실행

Node 26 LTS(`.nvmrc`)를 쓴다. Windows에서 Node 24는 경로에 한글이 있으면 `fs.rmSync`가 비정상 종료해서, 두 번째 `npm run build`부터 실패한다(Vite가 `dist/`를 비울 때). Node 26에서는 생기지 않는다.

```bash
npm install
npm run dev          # http://localhost:5173, 개발 백엔드에 붙음
npm run dev:mock     # 백엔드 없이 가짜 응답으로
```

개발 서버는 `/api` 요청을 개발 백엔드(`127.0.0.1:8080`)로 넘긴다(`vite.config.ts` proxy). 백엔드를 켜면 `GET /api/me` 결과에 따라 상단 줄(로그인 전후 메뉴)이 바뀌고, 꺼져 있으면 연결 실패 화면이 나온다.

`npm run dev:mock`은 백엔드 없이 띄운다. 브라우저의 `/api` 요청을 MSW service worker가 가짜 응답으로 바꾸고, 화면 오른쪽 아래 패널에서 계정(로그아웃 상태, 승인 대기, 거절, 학습자, 관리자)과 실습(없음, CREATING, READY, FAILED, 정원 초과) 상태를 고른다. 고른 값은 `localStorage`의 `hackforge.mock`에 남는다. 로그인 화면에서는 `forge_kim`(학습자), `newbie`(승인 대기), `denied`(거절), `admin`(관리자) 뒤에 `@example.com`을 붙인 이메일로 로그인하고(비밀번호는 아무거나), 그 밖의 이메일은 틀림, `locked@example.com`은 잠김이다. 회원가입하면 그 계정이 승인 대기 계정이 되고, 이미 있는 이메일·닉네임은 중복 오류가 난다. 내 정보의 비밀번호 변경은 현재 비밀번호가 `wrong`이면 틀림, `locked`이면 잠겨 로그아웃된다. mock 코드와 worker 파일은 이 모드에서만 들어가고 `npm run dev`와 배포 빌드에는 없다.

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run dev:mock` | 백엔드 없이 mock 응답으로 띄움(시나리오 패널) |
| `npm run build` | 타입 검사 후 `dist/`에 빌드 |
| `npm run preview` | 빌드 결과를 띄워 봄 |
| `npm run typecheck` | 타입 검사 |
| `npm run lint` | ESLint |
| `npm run format` / `format:check` | Prettier로 정리 / 확인 |
| `npm test` / `test:watch` | Vitest |
| `npm run api:sync` | `../hackforge-be/openapi.yaml`을 `openapi.yaml`로 복사하고 생성물을 다시 만듦. 복사본과 생성물을 함께 커밋 |
| `npm run api:gen` | `openapi.yaml` 복사본으로 `src/api/generated/`만 다시 만듦(CI가 커밋된 생성물과 같은지 확인) |
| `npm run audit:check` | 배포 의존성 audit(허용 목록 반영) |

CI(`.github/workflows/ci.yml`)는 PR과 `main` push마다 배포 의존성 audit(`npm run audit:check`), 생성물 일치 확인(`npm run api:gen` 뒤 `src/api/generated` diff), 타입 검사, lint, 포맷 확인, 테스트, 빌드를 한다.

audit은 배포 의존성에 높은 위험 이상 취약점이 있으면 실패한다. 패치가 없고 실제로 위험하지 않은 취약점만 `audit-allowlist.json`에 넣어 통과시키고, 항목마다 사유(`reason`)와 재검토 날짜(`until`)를 적는다. 날짜가 지나면 CI가 다시 실패하니, 그때 패치 여부를 확인해 의존성을 올리거나 날짜를 갱신한다.

## 구조

| 경로 | 내용 |
|---|---|
| `src/api/generated/` | `openapi.yaml`로 만든 타입, API 함수(SDK), TanStack Query 옵션. 손으로 고치지 않음(lint·Prettier 제외) |
| `src/api/` | API 공통 처리: `client.ts`(CSRF 헤더, 401 처리, 오류 변환), `errors.ts`(`ApiError`, 입력 칸별 오류 `fieldErrors`), `me.ts`(`useMe`, 로그인 안 했으면 `null`. 세션이 끝났을 때 화면 정리 `useEndSession`), `query.ts`(QueryClient와 기본 client 설정) |
| `src/mocks/` | mock 모드: `handlers.ts`(API별 가짜 응답, 생성 타입 사용), `scenario.ts`(시나리오와 저장), `mock-panel.tsx`(전환 패널), `browser.ts`(worker 시작) |
| `src/components/ui/` | shadcn/ui 컴포넌트 복사본. `npx shadcn@latest add <이름>`으로 추가 |
| `src/routes.tsx` | 경로 표. `/`(로그인 전 소개, 후 홈), 로그인 전 구간 `/login`·`/signup`(로그인했으면 원래 가려던 화면이나 홈으로), 로그인 필요 구간 `/problems`·`/records`·`/account`, 관리자 구간 `/admin`, 그 밖은 404 |
| `src/pages/` | 화면. `auth-pages.tsx`(로그인, 회원가입), `account-page.tsx`(내 정보: 기본 정보, 비밀번호 변경), `status-pages.tsx`(404, 403, 백엔드 연결 실패), `placeholder-pages.tsx`(기능별 이슈에서 채울 화면의 자리) |
| `src/components/` | 공통 컴포넌트: `form.tsx`(입력 칸, 칸별 오류, 폼 안내 상자, 비밀번호 규칙), `app-layout.tsx`(상단 줄, 주 메뉴, 승인 대기·거절 안내 띠), `user-menu.tsx`(첫 글자 원 버튼, 계정 정보, 내 정보, 테마, 로그아웃), `route-guards.tsx`(로그인 필요, 관리자만, 로그인 전 화면), 테마 provider와 전환, 로고 |
| `src/lib/` | 화면과 무관한 로직(`theme.ts`, `password.ts`), 권한·승인 상태의 화면 이름(`account.ts`), `cn` 등 유틸 |
| `src/test/` | 테스트 준비: `setup.ts`(jsdom 보충), `app.tsx`(mock 응답을 붙여 앱 전체를 띄우는 `setupMockServer`, `renderAt`) |
| `src/index.css` | Tailwind, shadcn/ui 테마 토큰(라이트·다크 색), 글꼴(Pretendard). shadcn의 `tailwind.css`는 `shadcn eject`로 이 파일에 넣었고 `shadcn` 패키지는 설치하지 않음(CLI 하위 의존성 취약점 경고 때문) |
| `components.json` | shadcn/ui 설정(Base UI, Nova 프리셋, lucide 아이콘) |

테마는 라이트, 다크, 시스템 기본값 중에 고르고(처음에는 다크) `localStorage`의 `hackforge-theme`에 저장한다. `index.html`의 인라인 스크립트가 React보다 먼저 적용해 첫 화면이 깜빡이지 않는다.
