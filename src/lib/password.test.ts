import { describe, expect, it } from 'vitest'

import { passwordRules } from './password'

const passed = (password: string) =>
  passwordRules(password)
    .filter((rule) => rule.ok)
    .map((rule) => rule.label)

describe('비밀번호 규칙(백엔드 SignupRequest.PASSWORD와 같음)', () => {
  it('빈 값은 모두 아직', () => {
    expect(passed('')).toEqual([])
  })

  it('맞는 것부터 통과로 바뀜', () => {
    expect(passed('abc')).toEqual(['영문'])
    expect(passed('abc123')).toEqual(['영문', '숫자'])
    expect(passed('Passw0rd!')).toEqual(['8~64자', '영문', '숫자', '특수문자'])
  })

  it('64자를 넘으면 길이 규칙이 다시 아직', () => {
    expect(passed('a1!' + 'x'.repeat(62))).not.toContain('8~64자')
  })

  it('한글이나 공백은 특수문자로 치지 않음(백엔드가 ASCII 기호만 받음)', () => {
    expect(passed('가나다라마바사1a')).not.toContain('특수문자')
    expect(passed('pass word1')).not.toContain('특수문자')
  })
})
