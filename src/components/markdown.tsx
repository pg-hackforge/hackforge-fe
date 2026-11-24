import ReactMarkdown from 'react-markdown'

import { cn } from '@/lib/utils'

/**
 * 문제 설명, 힌트, 해답(Markdown). 문제 내용의 HTML이 플랫폼 화면에서 실행되지 않게 날 HTML은 버린다(ADR 027).
 * 링크는 새 탭으로 연다
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        'space-y-3 text-[15px] leading-relaxed text-foreground',
        '[&_h1]:mt-6 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold',
        '[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px]',
        '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-terminal [&_pre]:p-3 [&_pre]:text-terminal-foreground [&_pre]:scheme-dark [&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold',
        '[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        className,
      )}
    >
      <ReactMarkdown
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
