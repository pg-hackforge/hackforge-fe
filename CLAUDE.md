# hackforge-fe

Hackforge 프론트엔드. **스택 미정**이다. 정해지면 이 파일에 스택과 실행·테스트 명령을 적고, `.github/workflows/ci.yml`을 추가한다.

## 먼저 읽을 것

- 무엇을 왜 만드는지: `../hackforge-docs/product.md`, 결정은 `../hackforge-docs/decisions/`
- 작업 중인 기능: `../hackforge-docs/specs/<기능>/tasks.md`
- API 계약: `../hackforge-be/openapi.yaml`. 타입과 클라이언트는 이 파일로 자동 생성하고, 손으로 쓰지 않는다. API가 바뀌어야 하면 백엔드 명세 PR이 먼저다.

## 작업 규칙

- `tasks.md`의 `[fe]` 작업을 한 번에 하나씩 구현한다.
- API가 바뀌는 기능은 hackforge-be PR이 머지·배포된 뒤에 머지한다.

## Git

- GitHub Flow를 쓴다. `main`에서 짧은 브랜치(`feat/...`, `fix/...`)를 따고 PR로 머지한다. `main`에 직접 push하지 않는다.
- PR 하나에는 `tasks.md` 작업 1~3개만 담는다. 본문은 PR 템플릿 칸을 모두 채운다(근거에 이슈와 작업 번호).
- 커밋 접두어: `feat:` `fix:` `docs:` `chore:`
- 커밋 본문은 diff로 알 수 없는 이유만 한두 줄 쓴다. 뻔한 변경은 제목 한 줄로 끝낸다.
- 라벨: `feature` `bug` `be` `fe` `infra`
- `suhodang/<이 저장소 이름>`은 `main`과 태그를 자동으로 덮어쓰는 읽기 전용 사본이다(`.github/workflows/mirror.yml`). 거기서 작업하지 않는다.
