import type { MyActivity } from '@/lib/analysis'
import { cn } from '@/lib/utils'

const LEVEL = ['bg-muted', 'bg-primary/35', 'bg-primary/65', 'bg-primary']
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** 날짜별 실습 칸: 열이 한 주(일요일부터), 진할수록 그날 실습을 많이 함. 최근 `weeks`주 */
export function ActivityGrid({
  days,
  weeks,
  cell = 12,
}: {
  days: MyActivity['days']
  weeks: number
  cell?: number
}) {
  // 이번 주(오늘까지)와 그 앞 weeks - 1주. 첫 칸이 일요일이 된다
  const recent = days.slice(-((weeks - 1) * 7 + new Date(days.at(-1)!.date).getDay() + 1))
  const lead = new Date(recent[0].date).getDay()
  const cells = [...Array<null>(lead).fill(null), ...recent]
  const columns = Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) =>
    cells.slice(w * 7, w * 7 + 7),
  )
  const size = { width: cell, height: cell }
  return (
    <div>
      <div className="flex gap-[3px]">
        <div
          className="mr-1 grid gap-[3px] text-[10px] text-muted-foreground"
          style={{ gridTemplateRows: `repeat(7, ${cell}px)`, lineHeight: `${cell}px` }}
        >
          {WEEKDAY.map((d, i) => (
            <span key={d}>{i % 2 === 1 ? d : ''}</span>
          ))}
        </div>
        {columns.map((week, w) => (
          <div
            key={w}
            className="grid gap-[3px]"
            style={{ gridTemplateRows: `repeat(7, ${cell}px)` }}
          >
            {week.map((day, i) =>
              day ? (
                <span
                  key={day.date}
                  title={`${day.date} 실습 ${day.count}번`}
                  className={cn('rounded-[3px]', LEVEL[Math.min(day.count, 3)])}
                  style={size}
                />
              ) : (
                <span key={`blank${i}`} style={size} />
              ),
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
        적음
        {LEVEL.map((level) => (
          <span key={level} className={cn('size-2.5 rounded-[3px]', level)} />
        ))}
        많음
      </div>
    </div>
  )
}
