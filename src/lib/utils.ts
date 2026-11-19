export { cn } from 'cn'

/** form 입력값을 문자열로. 없으면 빈 문자열 */
export const formText = (form: FormData, name: string) => String(form.get(name) ?? '')
