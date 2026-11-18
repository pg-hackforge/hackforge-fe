// hackforge-be의 openapi.yaml을 복사하고 타입·API 함수를 다시 만든다. 실행: npm run api:sync
// 복사본(openapi.yaml)과 생성물(src/api/generated)은 함께 커밋한다(ADR 015). 백엔드 저장소는 ../hackforge-be에 있어야 한다
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const source = new URL('../../hackforge-be/openapi.yaml', import.meta.url)
const target = new URL('../openapi.yaml', import.meta.url)

if (!existsSync(source)) {
  console.error(
    '../hackforge-be/openapi.yaml이 없습니다. hackforge-be를 hackforge-fe 옆에 clone하고 원하는 브랜치로 맞춘 뒤 다시 실행하세요',
  )
  process.exit(1)
}
// Windows에서 clone한 백엔드 저장소는 CRLF일 수 있어 LF로 맞춘다(CI는 LF로 다시 생성해 비교)
writeFileSync(target, readFileSync(source, 'utf8').replaceAll('\r\n', '\n'))
console.log('openapi.yaml 복사함')
execSync('npm run api:gen', { stdio: 'inherit' })
