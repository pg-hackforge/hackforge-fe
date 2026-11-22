import type {
  ChallengeDetailResponse,
  ChallengeDifficulty,
  ChallengeMyStatus,
  ChallengePageResponse,
  ChallengeResponse,
  ChallengeSort,
  MyProgressResponse,
} from '@/api/generated/types.gen'

/** 백엔드 V8 seed와 같은 분류와 표시 순서 */
export const CATEGORIES: [key: string, name: string][] = [
  ['sqli', 'SQL Injection'],
  ['xss', 'XSS'],
  ['access-control', '접근 제어'],
  ['auth-session', '인증·세션'],
  ['command-injection', 'Command Injection'],
  ['path-traversal', 'Path Traversal'],
  ['file-upload', '파일 업로드'],
  ['ssrf', 'SSRF'],
  ['csrf', 'CSRF'],
  ['xxe', 'XXE'],
  ['deserialization', '역직렬화'],
  ['info-disclosure', '정보 노출'],
]

const DIFFICULTIES: ChallengeDifficulty[] = ['INTRO', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED']
const MY_STATUSES: ChallengeMyStatus[] = ['NOT_STARTED', 'UNFINISHED', 'COMPLETED']

type Fixture = [
  id: number,
  slug: string,
  title: string,
  summary: string,
  category: string,
  difficulty: ChallengeDifficulty,
  minutes: number,
  daysAgo: number,
  myStatus: ChallengeMyStatus,
]

/** mock 문제. id가 클수록 나중에 추가한 문제이고, 날짜(며칠 전 추가)는 새 문제 표시에만 쓴다. 진행 중 실습(시나리오)은 sqli-login(id 12) */
const FIXTURES: Fixture[] = [
  [
    128,
    'idor-orders',
    '주문 내역 IDOR',
    '다른 사용자의 주문 번호로 주문 내역을 조회하고, 소유자 검사를 넣어 막아요',
    'access-control',
    'INTRO',
    25,
    1,
    'NOT_STARTED',
  ],
  [
    127,
    'ssrf-image',
    '이미지 변환 SSRF',
    '이미지 URL 가져오기 기능으로 내부 관리 페이지에 요청을 보내고, 허용 목록으로 막아요',
    'ssrf',
    'INTERMEDIATE',
    40,
    3,
    'NOT_STARTED',
  ],
  [
    126,
    'sqli-union',
    '검색 결과 UNION 추출',
    '상품 검색 쿼리로 다른 테이블의 데이터를 꺼내고, 쿼리를 매개변수화해 막아요',
    'sqli',
    'INTERMEDIATE',
    35,
    6,
    'UNFINISHED',
  ],
  [
    125,
    'upload-webshell',
    '프로필 사진 웹셸 업로드',
    '확장자 검사를 우회해 실행 가능한 파일을 올리고, 저장 방식을 고쳐 막아요',
    'file-upload',
    'ADVANCED',
    50,
    20,
    'NOT_STARTED',
  ],
  [
    121,
    'cmdi-ping',
    '핑 테스트 명령 주입',
    '네트워크 점검 기능에 명령을 이어 붙이고, 인자 처리를 고쳐 막아요',
    'command-injection',
    'INTRO',
    25,
    30,
    'COMPLETED',
  ],
  [
    118,
    'reset-token',
    '비밀번호 재설정 토큰 추측',
    '예측 가능한 토큰으로 다른 계정의 비밀번호를 바꾸고, 토큰 생성을 고쳐요',
    'auth-session',
    'INTERMEDIATE',
    40,
    34,
    'UNFINISHED',
  ],
  [
    112,
    'xss-stored',
    '게시판 저장형 XSS',
    '게시글에 스크립트를 심어 다른 사용자 화면에서 실행시키고, 출력 처리를 고쳐요',
    'xss',
    'INTERMEDIATE',
    40,
    40,
    'COMPLETED',
  ],
  [
    104,
    'xss-dom',
    '댓글 미리보기 DOM XSS',
    '미리보기 스크립트가 입력을 그대로 넣는 지점을 찾아 실행시키고 고쳐요',
    'xss',
    'INTERMEDIATE',
    35,
    45,
    'COMPLETED',
  ],
  [
    97,
    'path-view',
    '파일 보기 경로 조작',
    '허용되지 않은 폴더의 파일을 웹으로 읽고, 경로 검사를 고쳐 막아요',
    'path-traversal',
    'INTERMEDIATE',
    30,
    50,
    'NOT_STARTED',
  ],
  [
    12,
    'sqli-login',
    'SQL Injection 로그인 우회',
    '관리자 비밀번호 없이 관리자로 로그인하고, 로그인 코드를 고쳐 막아요',
    'sqli',
    'INTRO',
    30,
    60,
    'UNFINISHED',
  ],
  [
    95,
    'csrf-transfer',
    '송금 요청 위조',
    '다른 사이트에서 송금 요청을 보내게 만들고, 요청 검증을 넣어 막아요',
    'csrf',
    'BEGINNER',
    30,
    62,
    'NOT_STARTED',
  ],
  [
    90,
    'xxe-import',
    '설정 가져오기 XXE',
    'XML 가져오기 기능으로 서버 파일을 읽고, 파서 설정을 고쳐 막아요',
    'xxe',
    'ADVANCED',
    45,
    66,
    'NOT_STARTED',
  ],
  [
    86,
    'deser-session',
    '세션 쿠키 역직렬화',
    '직렬화된 세션 값을 바꿔 서버에서 코드를 실행시키고, 형식을 바꿔 막아요',
    'deserialization',
    'ADVANCED',
    55,
    70,
    'NOT_STARTED',
  ],
  [
    81,
    'debug-page',
    '열린 디버그 페이지',
    '운영 서버에 남은 디버그 페이지에서 비밀 값을 찾고, 설정을 고쳐 숨겨요',
    'info-disclosure',
    'INTRO',
    15,
    74,
    'COMPLETED',
  ],
  [
    77,
    'idor-profile',
    '남의 프로필 수정',
    '사용자 번호를 바꿔 다른 사람의 프로필을 고치고, 권한 확인을 넣어요',
    'access-control',
    'BEGINNER',
    25,
    80,
    'NOT_STARTED',
  ],
  [
    73,
    'session-fixation',
    '세션 고정',
    '로그인 전 세션 ID를 고정해 다른 사람의 로그인을 가로채고, 세션을 새로 발급해요',
    'auth-session',
    'INTERMEDIATE',
    35,
    84,
    'NOT_STARTED',
  ],
  [
    69,
    'sqli-blind',
    '응답 시간으로 알아내는 SQL Injection',
    '응답 시간 차이로 비밀번호를 한 글자씩 알아내고, 쿼리를 고쳐 막아요',
    'sqli',
    'ADVANCED',
    50,
    88,
    'NOT_STARTED',
  ],
  [
    64,
    'xss-reflected',
    '검색어 반사형 XSS',
    '검색어가 그대로 출력되는 페이지에서 스크립트를 실행시키고 고쳐요',
    'xss',
    'INTRO',
    20,
    92,
    'COMPLETED',
  ],
  [
    60,
    'cmdi-backup',
    '백업 파일 이름 명령 주입',
    '백업 파일 이름에 명령을 넣어 실행시키고, 셸을 거치지 않게 고쳐요',
    'command-injection',
    'INTERMEDIATE',
    35,
    96,
    'NOT_STARTED',
  ],
  [
    55,
    'path-zip',
    '압축 해제 경로 조작',
    '압축 파일 안의 경로로 서버의 다른 폴더에 파일을 쓰고, 해제 경로를 검사해요',
    'path-traversal',
    'ADVANCED',
    45,
    100,
    'NOT_STARTED',
  ],
  [
    51,
    'upload-svg',
    'SVG 업로드 스크립트',
    'SVG 파일에 스크립트를 넣어 올리고, 저장과 응답 방식을 고쳐 막아요',
    'file-upload',
    'INTERMEDIATE',
    35,
    104,
    'NOT_STARTED',
  ],
  [
    47,
    'ssrf-webhook',
    '웹훅 주소 SSRF',
    '웹훅 주소로 클라우드 메타데이터에 접근하고, 주소 검사를 넣어 막아요',
    'ssrf',
    'ADVANCED',
    45,
    108,
    'NOT_STARTED',
  ],
  [
    43,
    'csrf-email',
    '이메일 변경 요청 위조',
    '피해자의 이메일을 바꾸는 요청을 보내게 만들고, 토큰 검사로 막아요',
    'csrf',
    'INTRO',
    20,
    112,
    'NOT_STARTED',
  ],
]

const DESCRIPTION = `회원 로그인 페이지예요. 관리자 비밀번호를 모르는 상태에서 **관리자(admin)로 로그인**해 보세요.

## 할 일

1. 공격 대상 화면에서 로그인 폼을 살펴보고, 입력이 쿼리에 어떻게 들어가는지 추측해요
2. 관리자로 로그인한 뒤 [공격 검증 요청]을 눌러요
3. 방어 단계에서 \`web/src/index.php\`를 고치고 재배포해요
4. [방어 검증 요청]으로 같은 공격이 막히고 정상 로그인이 되는지 확인해요

## 참고

- 정상 계정 \`guest\` / \`guest1234\`로 로그인할 수 있어요
- 이름에 따옴표가 들어간 계정도 정상적으로 로그인돼야 해요`

function item([
  id,
  slug,
  title,
  summary,
  category,
  difficulty,
  minutes,
  ago,
  myStatus,
]: Fixture): ChallengeResponse {
  const [, name] = CATEGORIES.find(([key]) => key === category)!
  return {
    id,
    slug,
    title,
    summary,
    category: { key: category, name },
    difficulty,
    estimatedMinutes: minutes,
    isNew: ago <= 14,
    myStatus,
  }
}

const ITEMS = FIXTURES.map(item)

export const PAGE_SIZE = 20

/** 문제 목록 API와 같은 규칙: 같은 조건은 또는, 다른 조건은 그리고, facet은 자기 조건만 빼고 센다 */
export function listChallenges(params: URLSearchParams): ChallengePageResponse {
  const q = params.get('q')?.trim().toLowerCase() ?? ''
  const categories = params.getAll('category')
  const difficulties = params.getAll('difficulty')
  const myStatuses = params.getAll('myStatus')
  const sort = (params.get('sort') ?? 'NEWEST') as ChallengeSort
  const page = Number(params.get('page') ?? '1')

  const match = (c: ChallengeResponse, skip?: 'category' | 'difficulty' | 'myStatus') =>
    (!q || [c.title, c.summary, c.category.name].some((text) => text.toLowerCase().includes(q))) &&
    (skip === 'category' || categories.length === 0 || categories.includes(c.category.key)) &&
    (skip === 'difficulty' || difficulties.length === 0 || difficulties.includes(c.difficulty)) &&
    (skip === 'myStatus' || myStatuses.length === 0 || myStatuses.includes(c.myStatus))

  const newest = (a: ChallengeResponse, b: ChallengeResponse) => b.id - a.id
  const order = {
    NEWEST: newest,
    DIFFICULTY: (a: ChallengeResponse, b: ChallengeResponse) =>
      DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty) || newest(a, b),
    TIME: (a: ChallengeResponse, b: ChallengeResponse) =>
      a.estimatedMinutes - b.estimatedMinutes || newest(a, b),
  }[sort]
  const matched = ITEMS.filter((c) => match(c)).sort(order)
  const count = (
    skip: 'category' | 'difficulty' | 'myStatus',
    pick: (c: ChallengeResponse) => string,
    value: string,
  ) => ITEMS.filter((c) => match(c, skip) && pick(c) === value).length

  return {
    items: matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    page,
    size: PAGE_SIZE,
    totalItems: matched.length,
    totalPages: Math.ceil(matched.length / PAGE_SIZE),
    facets: {
      categories: CATEGORIES.map(([key, name]) => ({
        key,
        name,
        count: count('category', (c) => c.category.key, key),
      })),
      difficulties: DIFFICULTIES.map((difficulty) => ({
        difficulty,
        count: count('difficulty', (c) => c.difficulty, difficulty),
      })),
      myStatuses: MY_STATUSES.map((myStatus) => ({
        myStatus,
        count: count('myStatus', (c) => c.myStatus, myStatus),
      })),
    },
  }
}

export function challengeDetail(id: number): ChallengeDetailResponse | undefined {
  const found = ITEMS.find((c) => c.id === id)
  return found && { ...found, description: DESCRIPTION }
}

export function myProgress(): MyProgressResponse {
  const of = (status: ChallengeMyStatus) => ITEMS.filter((c) => c.myStatus === status).length
  return {
    totalChallenges: ITEMS.length,
    completed: of('COMPLETED'),
    unfinished: of('UNFINISHED'),
    categories: CATEGORIES.map(([key, name]) => {
      const inCategory = ITEMS.filter((c) => c.category.key === key)
      return {
        key,
        name,
        total: inCategory.length,
        completed: inCategory.filter((c) => c.myStatus === 'COMPLETED').length,
      }
    }),
  }
}

/** 진행 중 실습(시나리오)의 문제 */
export const LAB_CHALLENGE = ITEMS.find((c) => c.slug === 'sqli-login')!
