# hackforge-fe

Hackforge 프론트엔드. React + Vite SPA, TypeScript, Tailwind CSS + shadcn/ui다. 스택과 이유는 hackforge-docs `decisions/015-fe-스택.md`에 있다.

- 기획·spec: [hackforge-docs](../hackforge-docs)
- API spec: [hackforge-be/openapi.yaml](../hackforge-be/openapi.yaml)

## 실행

Node 26 LTS(`.nvmrc`)를 쓴다. Windows에서 Node 24는 경로에 한글이 있으면 `fs.rmSync`가 비정상 종료해서, 두 번째 `npm run build`부터 실패한다(Vite가 `dist/`를 비울 때). Node 26에서는 생기지 않는다.

```bash
npm install
npm run dev          # http://localhost:5173
```

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 후 `dist/`에 빌드 |
| `npm run preview` | 빌드 결과를 띄워 봄 |
| `npm run typecheck` | 타입 검사 |
| `npm run lint` | ESLint |
| `npm run format` / `format:check` | Prettier로 정리 / 확인 |
| `npm test` / `test:watch` | Vitest |

CI(`.github/workflows/ci.yml`)는 PR과 `main` push마다 타입 검사, lint, 포맷 확인, 테스트, 빌드를 한다.

## 구조

| 경로 | 내용 |
|---|---|
| `src/components/ui/` | shadcn/ui 컴포넌트 복사본. `npx shadcn@latest add <이름>`으로 추가 |
| `src/components/` | 공통 컴포넌트(테마 provider, 테마 전환) |
| `src/lib/` | 화면과 무관한 로직(`theme.ts`)과 `cn` 등 유틸 |
| `src/index.css` | Tailwind, shadcn/ui 테마 토큰(라이트·다크 색), 글꼴(Pretendard) |
| `components.json` | shadcn/ui 설정(Base UI, Nova 프리셋, lucide 아이콘) |

테마는 라이트, 다크, 시스템 설정 중에 고르고 `localStorage`의 `hackforge-theme`에 저장한다. `index.html`의 인라인 스크립트가 React보다 먼저 적용해 첫 화면이 깜빡이지 않는다.
