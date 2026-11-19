/**
 * 비밀번호 규칙을 입력하는 동안 보여 주려고 하나씩 검사한다.
 * 백엔드 `SignupRequest.PASSWORD`와 같은 규칙이고, 최종 판단은 백엔드 응답으로 한다(ADR 018).
 */
export function passwordRules(password: string) {
  return [
    { label: '8~64자', ok: password.length >= 8 && password.length <= 64 },
    { label: '영문', ok: /[A-Za-z]/.test(password) },
    { label: '숫자', ok: /[0-9]/.test(password) },
    // ASCII 기호만(공백 제외). 한글처럼 ASCII가 아닌 글자는 백엔드가 받지 않는다
    { label: '특수문자', ok: /[!-/:-@[-`{-~]/.test(password) },
  ]
}
