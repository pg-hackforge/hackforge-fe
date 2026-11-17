// 배포 의존성(dependencies) audit. 높은 위험 이상 취약점이 있으면 실패하되, audit-allowlist.json에
// 사유와 재검토 날짜를 적은 취약점은 그 날짜까지만 통과시킨다. 날짜가 지나면 다시 실패해 패치 여부를 확인하게 한다.
// 실행: npm run audit:check (CI에서도 같은 명령)
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BLOCKING = new Set(['high', 'critical'])

/** npm audit JSON에서 막을 취약점을 고른다. today, until은 YYYY-MM-DD 문자열 */
export function evaluate(report, allowlist, today) {
  const advisories = new Map()
  for (const vuln of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      // 문자열 via는 다른 패키지를 거쳐 걸린 것이라, 원래 취약점(객체 via)만 센다
      if (typeof via !== 'object' || !BLOCKING.has(via.severity)) continue
      const id = String(via.url ?? via.source)
        .split('/')
        .pop()
      advisories.set(id, { id, package: via.name, title: via.title, severity: via.severity })
    }
  }
  const failures = []
  const allowed = []
  for (const adv of advisories.values()) {
    const entry = allowlist.find((a) => a.id === adv.id)
    if (entry && today <= entry.until)
      allowed.push({ ...adv, reason: entry.reason, until: entry.until })
    else failures.push({ ...adv, expired: Boolean(entry) })
  }
  return { failures, allowed }
}

function main() {
  let raw
  try {
    raw = execSync('npm audit --omit=dev --json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    })
  } catch (e) {
    raw = e.stdout // 취약점이 있으면 npm audit이 0이 아닌 코드로 끝나지만 JSON은 그대로 나온다
  }
  const allowlist = JSON.parse(
    readFileSync(new URL('../audit-allowlist.json', import.meta.url), 'utf8'),
  )
  const today = new Date().toISOString().slice(0, 10)
  const { failures, allowed } = evaluate(JSON.parse(raw), allowlist, today)

  for (const a of allowed)
    console.log(`허용(${a.until}까지): ${a.id} ${a.package} ${a.severity} - ${a.reason}`)
  for (const f of failures) {
    const why = f.expired
      ? '허용 목록의 재검토 날짜가 지남. 패치를 확인하고 목록을 갱신할 것'
      : '허용 목록에 없음'
    console.error(`실패: ${f.id} ${f.package} ${f.severity} "${f.title}" (${why})`)
  }
  if (failures.length) process.exit(1)
  console.log('배포 의존성 audit 통과')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
