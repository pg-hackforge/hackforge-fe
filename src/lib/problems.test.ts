import { describe, expect, it } from 'vitest'

import { pageItems, readProblemQuery, writeProblemQuery } from './problems'

describe('문제 목록 조건', () => {
  it('주소에서 읽고 모르는 값은 버린다', () => {
    const query = readProblemQuery(
      new URLSearchParams(
        'q=sql&category=sqli&category=xss&difficulty=INTRO&difficulty=NOPE&myStatus=COMPLETED&sort=TIME&page=3',
      ),
    )
    expect(query).toEqual({
      q: 'sql',
      categories: ['sqli', 'xss'],
      difficulties: ['INTRO'],
      myStatuses: ['COMPLETED'],
      sort: 'TIME',
      page: 3,
    })
    expect(readProblemQuery(new URLSearchParams('sort=NOPE&page=0'))).toMatchObject({
      sort: 'NEWEST',
      page: 1,
    })
    expect(readProblemQuery(new URLSearchParams('page=1.5')).page).toBe(1)
  })

  it('기본값은 주소에 넣지 않는다', () => {
    const empty = readProblemQuery(new URLSearchParams())
    expect(writeProblemQuery(empty).toString()).toBe('')
    expect(
      writeProblemQuery({ ...empty, q: '  xss ', categories: ['xss'], page: 2 }).toString(),
    ).toBe('q=xss&category=xss&page=2')
  })
})

describe('페이지 번호', () => {
  it('처음, 끝, 지금 주변을 보여 주고 사이는 줄인다', () => {
    expect(pageItems(1, 1)).toEqual([1])
    expect(pageItems(1, 7)).toEqual([1, 2, null, 7])
    expect(pageItems(4, 7)).toEqual([1, null, 3, 4, 5, null, 7])
    expect(pageItems(7, 7)).toEqual([1, null, 6, 7])
    expect(pageItems(2, 3)).toEqual([1, 2, 3])
  })
})
