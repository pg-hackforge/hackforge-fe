import { setupWorker } from 'msw/browser'

import { handlers } from './handlers'

/** mock 모드(npm run dev:mock)에서만 불린다. 브라우저의 /api 요청을 service worker가 가짜 응답으로 바꾼다 */
export async function startMocking() {
  // 실제 백엔드는 첫 GET에서 CSRF cookie를 주지만, mock은 cookie를 만들지 않으므로 미리 둔다
  document.cookie = 'XSRF-TOKEN=mock; path=/'
  await setupWorker(...handlers).start({
    // 페이지·파일 요청은 그대로 보내고, handler가 없는 API 요청만 경고한다
    onUnhandledFrame({ frame, defaults }) {
      const data = frame.data as { request?: Request }
      if (data.request && new URL(data.request.url).pathname.startsWith('/api/')) defaults.warn()
    },
  })
}
