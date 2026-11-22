import type {
  ChallengeDifficulty,
  ChallengeMyStatus,
  ChallengeSort,
  ListChallengesData,
} from '@/api/generated/types.gen'

export const DIFFICULTY_LABEL: Record<ChallengeDifficulty, string> = {
  INTRO: '입문',
  BEGINNER: '초급',
  INTERMEDIATE: '중급',
  ADVANCED: '고급',
}

/** 난이도 점 세 개 중 채우는 수 */
export const DIFFICULTY_DOTS: Record<ChallengeDifficulty, number> = {
  INTRO: 1,
  BEGINNER: 2,
  INTERMEDIATE: 2,
  ADVANCED: 3,
}

export const MY_STATUS_LABEL: Record<ChallengeMyStatus, string> = {
  NOT_STARTED: '시작 전',
  UNFINISHED: '끝내지 못함',
  COMPLETED: '완료',
}

export const SORT_LABEL: Record<ChallengeSort, string> = {
  NEWEST: '새로 추가된 순',
  DIFFICULTY: '쉬운 순',
  TIME: '짧은 순',
}

const SORTS = Object.keys(SORT_LABEL) as ChallengeSort[]
const DIFFICULTIES = Object.keys(DIFFICULTY_LABEL) as ChallengeDifficulty[]
const MY_STATUSES = Object.keys(MY_STATUS_LABEL) as ChallengeMyStatus[]

/** 문제 목록 화면의 조건. 주소(검색 매개변수)에 둬서 새로 고침·뒤로 가기·공유에도 그대로다 */
export type ProblemQuery = {
  q: string
  categories: string[]
  difficulties: ChallengeDifficulty[]
  myStatuses: ChallengeMyStatus[]
  sort: ChallengeSort
  page: number
}

/** 주소의 값을 읽는다. 모르는 값은 버리고, 페이지는 1 이상 정수만 */
export function readProblemQuery(params: URLSearchParams): ProblemQuery {
  const page = Number(params.get('page'))
  const sort = params.get('sort') as ChallengeSort
  return {
    q: params.get('q') ?? '',
    categories: params.getAll('category'),
    difficulties: params
      .getAll('difficulty')
      .filter((d): d is ChallengeDifficulty => (DIFFICULTIES as string[]).includes(d)),
    myStatuses: params
      .getAll('myStatus')
      .filter((s): s is ChallengeMyStatus => (MY_STATUSES as string[]).includes(s)),
    sort: SORTS.includes(sort) ? sort : 'NEWEST',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

/** 주소로 쓴다. 기본값(빈 검색어, 새로 추가된 순, 1쪽)은 주소에 넣지 않는다 */
export function writeProblemQuery(query: ProblemQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.q.trim()) params.set('q', query.q.trim())
  query.categories.forEach((c) => params.append('category', c))
  query.difficulties.forEach((d) => params.append('difficulty', d))
  query.myStatuses.forEach((s) => params.append('myStatus', s))
  if (query.sort !== 'NEWEST') params.set('sort', query.sort)
  if (query.page > 1) params.set('page', String(query.page))
  return params
}

/** 문제 목록 API의 query */
export function toApiQuery(query: ProblemQuery): NonNullable<ListChallengesData['query']> {
  return {
    q: query.q.trim() || undefined,
    category: query.categories,
    difficulty: query.difficulties,
    myStatus: query.myStatuses,
    sort: query.sort,
    page: query.page,
  }
}

/** 페이지 번호 줄: 처음, 끝, 지금 주변 하나씩. 사이가 비면 null(…) */
export function pageItems(page: number, totalPages: number): (number | null)[] {
  const shown = new Set([1, totalPages, page - 1, page, page + 1])
  const pages = [...shown].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  return pages.flatMap((p, i) => (i > 0 && p - pages[i - 1] > 1 ? [null, p] : [p]))
}
