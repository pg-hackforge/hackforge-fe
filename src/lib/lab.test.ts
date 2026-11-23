import { describe, expect, it } from 'vitest'

import {
  clampFontSize,
  endNotice,
  fileTree,
  formatRemaining,
  hintTitle,
  labPollInterval,
  labRecords,
  lineChanges,
  languageOf,
  readFontSize,
  terminalCloseNotice,
  terminalUrl,
} from './lab'

describe('실습 화면 로직', () => {
  it('준비 중에는 자주, 실습 중에는 가끔, 끝나면 조회하지 않음', () => {
    expect(labPollInterval('CREATING')).toBe(2_500)
    expect(labPollInterval('TERMINATING')).toBe(2_500)
    expect(labPollInterval('READY')).toBe(10_000)
    expect(labPollInterval('DELETED')).toBe(false)
    expect(labPollInterval('FAILED')).toBe(false)
  })

  it('남은 시간은 분:초, 음수는 0:00', () => {
    expect(formatRemaining(27 * 60_000 + 40_000)).toBe('27:40')
    expect(formatRemaining(59_001)).toBe('1:00')
    expect(formatRemaining(-5)).toBe('0:00')
  })

  it('종료 사유별 안내. 완료 뒤 입력 없음은 완료로', () => {
    expect(endNotice({ status: 'DELETED', endReason: 'ADMIN', completedAt: null })[0]).toBe(
      '관리자가 실습을 종료했어요',
    )
    expect(
      endNotice({ status: 'DELETED', endReason: 'IDLE', completedAt: '2026-11-22T10:00:00Z' })[0],
    ).toBe('실습을 완료했어요')
    expect(endNotice({ status: 'DELETED', endReason: 'IDLE', completedAt: null })[0]).toBe(
      '입력이 없어 실습이 끝났어요',
    )
    expect(endNotice({ status: 'FAILED', endReason: null, completedAt: null })[0]).toBe(
      '실습 환경을 만들지 못했어요',
    )
  })

  it('터미널 주소와 닫힌 이유', () => {
    expect(terminalUrl(42, { protocol: 'http:', host: 'localhost:5173' })).toBe(
      'ws://localhost:5173/api/labs/42/terminal',
    )
    expect(terminalUrl(42, { protocol: 'https:', host: 'hf.example' })).toBe(
      'wss://hf.example/api/labs/42/terminal',
    )
    expect(terminalCloseNotice(4410).retry).toBe(false)
    expect(terminalCloseNotice(1006)).toEqual({ text: '터미널 연결이 끊겼어요.', retry: true })
  })

  it('글자 크기는 11~20, 저장값이 없거나 이상하면 13', () => {
    expect(clampFontSize(9)).toBe(11)
    expect(clampFontSize(24)).toBe(20)
    expect(readFontSize(null)).toBe(13)
    expect(readFontSize('abc')).toBe(13)
    expect(readFontSize('16')).toBe(16)
    expect(readFontSize('99')).toBe(20)
  })

  it('힌트 이름: 공격 힌트는 순서마다 무엇을 알려 주는지', () => {
    expect(hintTitle('ATTACK', 1)).toBe('공격 힌트 1 · 방향')
    expect(hintTitle('ATTACK', 3)).toBe('공격 힌트 3 · 공격 방법')
    expect(hintTitle('DEFENSE', 2)).toBe('방어 힌트 2')
  })

  it('기록은 검증과 힌트를 최근 순으로, 방어 검증은 번호', () => {
    const v = (
      id: number,
      type: 'ATTACK' | 'DEFENSE',
      status: 'PASS' | 'FAIL' | 'RUNNING',
      at: string,
    ) => ({
      id,
      type,
      status,
      message: status === 'RUNNING' ? null : `m${id}`,
      durationMs: status === 'RUNNING' ? null : 3_200,
      startedAt: at,
      finishedAt: null,
      securityPassed: null,
      functionalPassed: null,
      securityMessage: null,
      functionalMessage: null,
      defenseHintsRevealed: null,
      afterSolution: null,
    })
    const records = labRecords(
      [
        v(3, 'DEFENSE', 'RUNNING', '2026-11-23T05:20:00Z'),
        v(2, 'DEFENSE', 'FAIL', '2026-11-23T05:10:00Z'),
        v(1, 'ATTACK', 'PASS', '2026-11-23T05:00:00Z'),
      ],
      [{ stage: 'ATTACK', position: 1, content: '', revealedAt: '2026-11-23T04:55:00Z' }],
    )
    expect(records.map((r) => r.title)).toEqual([
      '방어 검증 02',
      '방어 검증 01',
      '공격 검증',
      '공격 힌트 1 · 방향 열람',
    ])
    expect(records[0]).toMatchObject({ status: 'RUNNING', detail: '검증 중' })
    expect(records[2]).toMatchObject({ status: 'PASS', detail: 'm1 · 3.2초' })
  })

  it('파일 목록은 폴더 먼저, 이름순 트리', () => {
    const entry = (path: string) => ({
      path,
      size: 1,
      readOnly: false,
      openable: true,
      modified: false,
    })
    const tree = fileTree([
      entry('web/src/index.php'),
      entry('compose.yaml'),
      entry('db/init.sql'),
      entry('web/Dockerfile'),
    ])
    expect(tree.map((n) => `${'  '.repeat(n.depth)}${n.name}${n.entry ? '' : '/'}`)).toEqual([
      'db/',
      '  init.sql',
      'web/',
      '  src/',
      '    index.php',
      '  Dockerfile',
      'compose.yaml',
    ])
    expect(tree[4]).toMatchObject({ path: 'web/src/index.php' })
  })

  it('확장자와 파일 이름으로 편집기 언어', () => {
    expect(languageOf('web/src/index.php')).toBe('php')
    expect(languageOf('web/Dockerfile')).toBe('dockerfile')
    expect(languageOf('web/Dockerfile.base')).toBe('dockerfile')
    expect(languageOf('compose.yaml')).toBe('yaml')
    expect(languageOf('db/init.sql')).toBe('sql')
    expect(languageOf('README')).toBe('plaintext')
  })

  it('기록에 재배포와 서비스 초기화도 넣고, 성공은 판정 표시 없음', () => {
    const redeploy = (
      id: number,
      kind: 'REDEPLOY' | 'RESET',
      status: 'SUCCESS' | 'FAIL',
      at: string,
    ) => ({
      id,
      kind,
      status,
      message: status === 'SUCCESS' ? '모든 서비스가 정상이에요' : '빌드에 실패했어요',
      log: null,
      durationMs: 4_100,
      startedAt: at,
      finishedAt: at,
    })
    const records = labRecords(
      [],
      [],
      [
        redeploy(2, 'RESET', 'SUCCESS', '2026-11-23T05:30:00Z'),
        redeploy(1, 'REDEPLOY', 'FAIL', '2026-11-23T05:20:00Z'),
      ],
    )
    expect(records.map((r) => [r.title, r.status])).toEqual([
      ['서비스 초기화', undefined],
      ['재배포', 'FAIL'],
    ])
    expect(records[1].detail).toBe('빌드에 실패했어요 · 4.1초')
  })

  it('원본과 줄 비교: 더한 줄, 바뀐 줄, 지운 자리와 수', () => {
    const original = ['a', 'b', 'c', 'd', 'e'].join('\n')
    // b를 고치고, c 뒤에 두 줄을 더하고, e를 지움
    const current = ['a', 'B', 'c', 'x', 'y', 'd'].join('\n')
    expect(lineChanges(original, current)).toEqual({
      added: 3,
      removed: 2,
      lines: [
        { line: 2, kind: 'modified' },
        { line: 4, kind: 'added' },
        { line: 5, kind: 'added' },
        { line: 6, kind: 'deleted' },
      ],
    })
    expect(lineChanges(original, original)).toEqual({ added: 0, removed: 0, lines: [] })
  })

  it('원본이 없는 파일은 모든 줄이 더한 줄', () => {
    expect(lineChanges(null, 'x\ny')).toEqual({
      added: 2,
      removed: 0,
      lines: [
        { line: 1, kind: 'added' },
        { line: 2, kind: 'added' },
      ],
    })
  })
})
