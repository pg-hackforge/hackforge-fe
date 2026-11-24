import type { LabFileEntry } from '@/api/generated/types.gen'

/**
 * mock 실습의 `/app` 파일. 화면 확인용 가짜 코드이고 실제 문제 코드가 아니다.
 * 읽기 전용은 ADR 024의 기본 목록(compose.yaml, Dockerfile, Dockerfile.base, .sql)
 */
export const ORIGINAL_FILES: Record<string, string> = {
  'compose.yaml': `services:
  web:
    build: ./web
    ports: ["8080:80"]
    depends_on:
      db:
        condition: service_healthy
  db:
    image: mariadb:11
    volumes: ["./db:/docker-entrypoint-initdb.d"]
`,
  'db/init.sql': `CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL
);
`,
  'web/Dockerfile': `FROM hackforge/sqli-login-web-base
COPY src/ /var/www/html/
RUN php -l /var/www/html/index.php
`,
  'web/Dockerfile.base': `FROM php:8.3-apache
RUN docker-php-ext-install mysqli
`,
  'web/src/index.php': `<?php
// mock 파일: 화면 확인용 가짜 코드예요. 실제 문제 코드가 아니에요.
$message = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = $_POST['username'] ?? '';
    $db = new mysqli('db', 'app', 'app', 'app');
    $row = find_user($db, $username);
    $message = $row ? '환영합니다' : '아이디 또는 비밀번호가 맞지 않습니다';
}
?>
<!doctype html>
<h1>회원 로그인</h1>
<p><?= htmlspecialchars($message) ?></p>
`,
}

/** 목록에만 보이고 열 수 없는 파일(바이너리) */
const BINARY = { path: 'web/src/logo.png', size: 18_204 }

const READ_ONLY = /(^|\/)(compose\.yaml|Dockerfile(\.base)?)$|\.sql$/

export const isReadOnly = (path: string) => READ_ONLY.test(path)

/** 파일 목록. `edited`는 학습자가 고친 내용(경로별)이고, 원본과 다르면 modified */
export function fileEntries(edited: Record<string, string> = {}): LabFileEntry[] {
  return [
    ...Object.entries(ORIGINAL_FILES).map(([path, original]) => {
      const content = edited[path] ?? original
      return {
        path,
        size: new TextEncoder().encode(content).length,
        readOnly: isReadOnly(path),
        openable: true,
        modified: content !== original,
      }
    }),
    { ...BINARY, readOnly: false, openable: false, modified: false },
  ].sort((a, b) => a.path.localeCompare(b.path))
}

/** mock용 내용 해시. 실제 서버는 SHA-256 hex */
export function hashOf(content: string): string {
  let h = 5381
  for (let i = 0; i < content.length; i++) h = (h * 33) ^ content.charCodeAt(i)
  return (h >>> 0).toString(16).padStart(8, '0').repeat(8)
}
