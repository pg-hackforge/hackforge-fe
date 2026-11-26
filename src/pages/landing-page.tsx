import '@fontsource-variable/geist'
import './landing.css'

import { MenuIcon } from 'lucide-react'
import { useEffect, useRef, type CSSProperties } from 'react'
import { Link } from 'react-router'

import labCode from '../../design/screens/landing-lab-code.webp'
import labRecords from '../../design/screens/landing-lab-records.webp'
import labTarget from '../../design/screens/landing-lab-target.webp'
import { LogoMark } from '@/components/logo'
import { startLandingEffects } from '@/pages/landing-effects'

/**
 * 제품 화면은 실제 앱을 mock 모드 다크로 찍은 캡처(시안은 iframe). 실제 문제의 공격 문자열이나 고친 코드가
 * 보이지 않게 mock의 가짜 코드와 빈 입력 칸으로 찍는다
 */
const SCREENS = {
  code: { src: labCode, alt: '방어 단계의 코드 편집기 화면' },
  target: { src: labTarget, alt: '공격 대상 화면' },
  records: { src: labRecords, alt: '방어 검증 결과 기록 화면' },
}

function Screen({ name, eager }: { name: keyof typeof SCREENS; eager?: boolean }) {
  const s = SCREENS[name]
  return <img src={s.src} alt={s.alt} loading={eager ? 'eager' : 'lazy'} />
}

const Check = () => (
  <svg className="ic" viewBox="0 0 24 24" aria-hidden>
    <path d="M5 12l5 5 9-10" />
  </svg>
)

const Cross = () => (
  <svg className="ic" viewBox="0 0 24 24" aria-hidden>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

const NAV: [string, string][] = [
  ['#how', '실습 방식'],
  ['#verify', '검증'],
  ['#env', '실습 환경'],
  ['#problems', '문제'],
]

/** 구간 구분선. 위는 달궈진 밀짚색, 아래로 갈수록 식은 파랑·회색(템퍼링 색). 화면에 들어오면 그려짐 */
function Divider({ from, to }: { from: string; to: string }) {
  return (
    <div className="w tdivw" aria-hidden>
      <div
        className="tdiv"
        style={{ background: `linear-gradient(90deg, var(--color-${from}), var(--color-${to}))` }}
      />
    </div>
  )
}

const STEPS = [
  {
    n: '01',
    title: '공격',
    text: '취약한 웹 서비스가 브라우저 안에서 실행돼요. 직접 요청을 보내고 터미널로 서버 안을 살피며 취약점을 찾아요.',
    points: ['웹 화면과 터미널을 함께 제공', '막히면 방향 → 위치 → 방법 순서의 힌트'],
    screen: 'target',
    caption: '공격 대상 화면',
  },
  {
    n: '02',
    title: '방어',
    text: '공격에 성공하면 코드가 열려요. 웹 편집기에서 원인이 된 코드를 고치고 재배포하면 고친 서비스가 다시 떠요.',
    points: ['편집 내용 자동 저장', '재배포, 언제든 처음 상태로 초기화'],
    screen: 'code',
    caption: '코드 편집기',
  },
  {
    n: '03',
    title: '방어 검증',
    text: '통했던 공격을 모두 다시 실행하고, 정상 기능이 그대로인지 함께 확인해요. 둘 다 만족해야 통과예요.',
    points: ['아직 통하는 공격과 깨진 기능을 결과로 확인', '통과하면 내 실습 기록에 남음'],
    screen: 'records',
    caption: '방어 검증 결과',
  },
] as const

/** 판정 카드의 처음 모습(FAIL). 효과가 돌면 한 줄씩 채워지고 다시 검증해 PASS가 된다 */
const VERDICT_ROWS: [string, boolean][] = [
  ['기존 공격 1', true],
  ['기존 공격 2', true],
  ['기존 공격 3', true],
  ['기존 공격 4', true],
  ['기존 공격 5', false],
  ['정상 기능 3개', true],
]

const CATEGORIES: [string, string][] = [
  ['SQL Injection', '쿼리 조작'],
  ['XSS', '스크립트 삽입'],
  ['접근 제어', 'IDOR·권한 우회'],
  ['인증·세션', '토큰·세션 탈취'],
  ['Command Injection', 'OS 명령 실행'],
  ['Path Traversal', '파일 경로 조작'],
  ['파일 업로드', '웹셸 업로드'],
  ['SSRF', '내부 요청 위조'],
  ['CSRF', '요청 위조'],
  ['XXE', 'XML 외부 개체'],
  ['역직렬화', '객체 주입'],
  ['정보 노출', '설정·오류 정보'],
]

const delay = (s: number, i?: number) =>
  ({ transitionDelay: `${s}s`, ...(i !== undefined && { '--i': i }) }) as CSSProperties

/**
 * `/` 로그인 전 소개 화면(hackforge-docs ADR 016, specs/landing). 구간 순서: 첫 화면, 미리 보기, 실습 방식, 검증,
 * 실습 환경, 문제, 마무리, 쇳물 글자, 맨 아래 줄. 반응형(1024px, 640px). 시연에 실제 공격 문자열은 쓰지 않는다.
 * 효과는 시안 스크립트를 옮긴 startLandingEffects가 붙이고, 화면을 떠나면 모두 걷어 낸다.
 * 앱 테마와 상관없이 다크로만 보인다(뿌리의 dark class로 앱 다크 토큰을 쓴다)
 */
export function LandingPage() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => startLandingEffects(root.current!), [])

  return (
    <div className="lp dark" ref={root}>
      <div className="smog s2" aria-hidden>
        <svg preserveAspectRatio="none" viewBox="0 0 800 400">
          <filter id="smk">
            <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves={4} seed={7}>
              <animate
                attributeName="baseFrequency"
                dur="30s"
                values="0.006 0.012;0.007 0.015;0.006 0.012"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feColorMatrix values="0 0 0 0 .78  0 0 0 0 .76  0 0 0 0 .74  0 0 0 1.4 -.55" />
          </filter>
          <rect width="800" height="400" filter="url(#smk)">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;-30 -18;0 0"
              dur="34s"
              repeatCount="indefinite"
            />
          </rect>
        </svg>
      </div>
      <div className="fx" aria-hidden />
      <div className="progress" aria-hidden />

      <div className="topbar">
        <header className="w top">
          <Link to="/" aria-label="Hackforge 홈" className="flex items-center gap-2 font-semibold">
            <LogoMark className="size-6.5" />
            Hackforge
          </Link>
          <nav aria-label="소개 구간">
            {NAV.map(([href, label]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
          <div className="sp" />
          <Link to="/login" className="btn ghost login">
            로그인
          </Link>
          <Link to="/signup" className="btn p">
            회원가입
          </Link>
          <details className="menu">
            <summary aria-label="메뉴">
              <MenuIcon className="size-4.5" aria-hidden />
            </summary>
            <div className="panel">
              {NAV.map(([href, label]) => (
                <a key={href} href={href}>
                  {label}
                </a>
              ))}
              <Link to="/login">로그인</Link>
            </div>
          </details>
        </header>
      </div>

      <div className="hero-wrap">
        <canvas className="embers" aria-hidden />
        <section className="w hero" aria-labelledby="hero-title">
          <h1 id="hero-title" className="shake">
            <span className="ln l1">
              Strike <span className="hot">hot</span>
            </span>
            <span className="mask">
              <span className="steel">Fix cold</span>
            </span>
          </h1>
          <p className="lead">
            실제로 취약한 웹 서비스가 나만 쓰는 격리된 환경에서 실행돼요. 공격에 성공하면 코드를
            고치고, 같은 공격이 막혔는지 정상 기능은 그대로인지 자동으로 검증해요.
          </p>
          <div className="cta">
            <Link to="/signup" className="btn p lg">
              회원가입
            </Link>
            <a className="btn lg" href="#how">
              실습 방식 보기
            </a>
          </div>
          <small>회원가입 뒤 관리자가 승인하면 바로 시작할 수 있어요</small>
          <div className="shot">
            <Screen name="code" eager />
          </div>
        </section>
      </div>

      <Divider from="temper-1" to="temper-2" />
      <section className="w sec" id="demo" aria-labelledby="demo-title">
        <div className="rv">
          <div className="k">미리 보기</div>
          <h2 id="demo-title">공격이 통하면, 고쳐서 막아요</h2>
          <p className="d">실제 실습 흐름을 그대로 줄였어요. 공격 문자열은 가려 두었어요.</p>
        </div>
        <div className="re">
          <div className="win">
            <div className="wb">
              <i />
              <i />
              <i />
              공격 대상 · 실습 환경의 웹 서비스
            </div>
            <div className="app" id="reApp">
              <div className="hotveil" />
              <div className="steelsheen" />
              <div className="login" id="reCard">
                <h4>회원 로그인</h4>
                <div className="in f" id="reU" aria-label="가린 공격 입력" />
                <div className="in">••••</div>
                <div className="go" id="reGo">
                  로그인
                </div>
              </div>
              <div className="verdict" id="reV" />
            </div>
          </div>
          <div className="win">
            <div className="wb">
              <i />
              <i />
              <i />
              index.php
            </div>
            <div className="code" id="reCode">
              <div className="l">
                <span>12</span>
                <span>$u = $_POST['username'];</span>
              </div>
              <div className="l" id="reDel">
                <span>13</span>
                <span>$sql = "SELECT ... WHERE user = '" . $u . "'";</span>
              </div>
              <div className="l add hide" id="reAdd1">
                <span>13</span>
                <span id="reT1" />
              </div>
              <div className="l add hide" id="reAdd2">
                <span>14</span>
                <span id="reT2" />
              </div>
              <div className="l">
                <span>15</span>
                <span>// 로그인 처리</span>
              </div>
            </div>
            <div className="build">
              <i id="reBuild" />
            </div>
          </div>
        </div>
        <div className="stage-tag" id="reTags">
          <span className="on">공격</span>
          <span>방어 · 코드 수정</span>
          <span>재배포</span>
          <span>방어 검증</span>
        </div>
      </section>

      <Divider from="temper-2" to="temper-3" />
      <section className="sec" id="how" aria-labelledby="how-title">
        <div className="w rv">
          <div className="k">실습 방식</div>
          <h2 id="how-title">
            한 문제를 공격부터 방어까지
            <br />
            끝까지 따라가요
          </h2>
          <p className="d">
            취약점을 설명으로만 배우지 않아요. 같은 서비스를 먼저 공격하고, 그 공격을 막는 코드를
            직접 써요.
          </p>
        </div>
        {/* 넓은 화면은 이 구간에서 화면을 고정하고, 스크롤에 따라 단계와 오른쪽 화면이 바뀐다 */}
        <div className="story-track">
          <div className="w story-sticky">
            <div>
              {STEPS.map((step, i) => (
                <div key={step.n} className={i === 0 ? 'stp on' : 'stp'}>
                  <i className="fill" />
                  <span className="n">{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                  <ul className="pts">
                    {step.points.map((point) => (
                      <li key={point}>
                        <Check />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <div className="mframe">
                    <Screen name={step.screen} />
                  </div>
                </div>
              ))}
            </div>
            <div className="story-frames">
              {STEPS.map((step, i) => (
                <div key={step.n} className={i === 0 ? 'frame on' : 'frame'}>
                  <span className="fcap">{step.caption}</span>
                  <Screen name={step.screen} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Divider from="temper-3" to="temper-4" />
      <section className="w sec" id="verify" aria-labelledby="verify-title">
        <div className="split">
          <div className="rv">
            <div className="k">검증</div>
            <h2 id="verify-title">
              통과 여부는 입력이 아니라
              <br />
              결과로 판정해요
            </h2>
            <p className="d">
              공격은 서비스에 남은 기록으로 확인해요. 방어는 통했던 공격을 다시 실행하고, 정상
              사용자의 동작까지 함께 테스트해요. 공격만 막고 서비스를 망가뜨린 수정은 통과하지
              못해요.
            </p>
          </div>
          <div className="rv" style={delay(0.12)}>
            <div className="card vcard" id="vcard" aria-label="방어 검증 결과 예시">
              <div className="rh">
                <span className="big badge f">FAIL</span>
                <h4>방어 검증 04</h4>
                <small>시도 4</small>
              </div>
              {VERDICT_ROWS.map(([name, ok]) => (
                <div key={name} className={ok ? 'row' : 'row no-row'}>
                  <span>{name}</span>
                  <span className={ok ? 'st ok' : 'st no'}>
                    {ok ? <Check /> : <Cross />}
                    {name.startsWith('정상') ? '정상' : ok ? '막힘' : '아직 통함'}
                  </span>
                </div>
              ))}
              <p className="cap">공격만 막고 정상 기능을 깨뜨린 수정은 통과하지 못해요.</p>
            </div>
          </div>
        </div>
      </section>

      <Divider from="temper-4" to="temper-5" />
      <section className="w sec" id="env" aria-labelledby="env-title">
        <div className="rv">
          <div className="k">실습 환경</div>
          <h2 id="env-title">마음껏 공격해도 되는 환경</h2>
          <p className="d">
            실습을 시작하면 나만 쓰는 환경이 새로 만들어지고, 끝나면 지워져요. 다른 사람의 실습이나
            외부에는 영향을 주지 않아요.
          </p>
        </div>
        <div className="facts" id="facts">
          <div className="fact rv" style={delay(0)}>
            <div className="viz" aria-hidden>
              <div className="boxes">
                <i />
                <i className="me" />
                <i />
                <i />
              </div>
            </div>
            <b>1인 1환경</b>
            <span>격리된 실습 환경</span>
            <p>웹 서버와 DB가 다른 학습자와 분리되어 실행돼요.</p>
          </div>
          <div className="fact rv" style={delay(0.08)}>
            <div className="viz" aria-hidden>
              <div className="src" />
              <i className="pkt" />
              <div className="wall" />
              <div className="net" />
            </div>
            <b>차단</b>
            <span>외부 인터넷</span>
            <p>실습 환경에서 밖으로 나가는 연결은 모두 막혀 있어요.</p>
          </div>
          <div className="fact rv" style={delay(0.16)}>
            <div className="viz" aria-hidden>
              <svg className="gauge" viewBox="0 0 44 44">
                <circle className="bg" cx="22" cy="22" r="20" />
                <circle className="arc" cx="22" cy="22" r="20" />
              </svg>
            </div>
            <b>
              약{' '}
              <em data-count="1" className="not-italic">
                1
              </em>
              분
            </b>
            <span>환경 준비</span>
            <p>문제를 고르면 1분 안팎으로 공격을 시작할 수 있어요.</p>
          </div>
          <div className="fact rv" style={delay(0.24)}>
            <div className="viz" aria-hidden>
              <span className="clock" data-clock>
                30:00
              </span>
            </div>
            <b>
              <em data-count="30" className="not-italic">
                30
              </em>
              분
            </b>
            <span>자동 종료</span>
            <p>입력이 없으면 실습이 끝나고 환경이 지워져요. 검증 기록은 남아요.</p>
          </div>
        </div>
      </section>

      <section className="dark-band" id="problems" aria-labelledby="problems-title">
        <div className="w">
          <div className="rv">
            <div className="k">문제</div>
            <h2 id="problems-title" className="h2d">
              웹 서비스에서 실제로 나오는 취약점을 분류별로
            </h2>
            <p className="d">
              문제마다 공격 힌트 3개, 방어 힌트 3개가 있고, 방어 검증 기회를 모두 쓰면 해답을 열 수
              있어요.
            </p>
          </div>
          <ul className="cats" id="cats" aria-label="취약점 분류">
            {CATEGORIES.map(([name, note], i) => (
              <li
                key={name}
                className="ct rv"
                style={delay((i % 4) * 0.06, (i % 4) + Math.floor(i / 4))}
              >
                <b>{name}</b>
                <span>{note}</span>
              </li>
            ))}
          </ul>
          <div className="more">
            <span>문제는 계속 추가돼요.</span>
            <Link to="/problems" className="btn">
              전체 문제 둘러보기
            </Link>
          </div>
        </div>
      </section>

      <Divider from="temper-6" to="temper-7" />
      <section className="w end rv" aria-labelledby="end-title">
        <h2 id="end-title">입문 문제부터 시작해 보세요</h2>
        <div className="btns">
          <Link to="/signup" className="btn p lg">
            회원가입
          </Link>
          <Link to="/login" className="btn lg">
            로그인
          </Link>
        </div>
      </section>

      <Wordmark />

      <footer className="w foot">
        <span className="brand">
          <LogoMark className="size-4.5" />
          Hackforge
        </span>
        <span>
          이 서비스의 실습 환경 밖에서 배운 기법을 쓰지 마세요. 허가받지 않은 시스템 공격은
          불법이에요.
        </span>
        <span className="credit">
          기획·개발<b>고성노</b> · <a href="mailto:rhtjdsh35@gmail.com">rhtjdsh35@gmail.com</a>
        </span>
      </footer>
    </div>
  )
}

/**
 * 쇳물 글자 HACKFORGE. 효과가 돌면 글자 모양 안에서 쇳물 표면이 꿀렁이며 차오르고(wmBody, wmSkin),
 * 효과가 없으면 다 차오른 모습으로 둔다
 */
function Wordmark() {
  return (
    <section className="w wm" id="wm" aria-label="Hackforge">
      <svg viewBox="0 0 1200 210" aria-hidden>
        <defs>
          <clipPath id="wmclip">
            <text x="600" y="186" textAnchor="middle">
              HACKFORGE
            </text>
          </clipPath>
          <linearGradient id="wmgrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="210">
            <stop offset="0" stopColor="#FFE7A3" />
            <stop offset=".05" stopColor="#FFB547" />
            <stop offset=".22" stopColor="#F26A12" />
            <stop offset=".6" stopColor="#B8321E" />
            <stop offset="1" stopColor="#6A1A12" />
          </linearGradient>
        </defs>
        <text className="wm-outline" x="600" y="186" textAnchor="middle">
          HACKFORGE
        </text>
        <g clipPath="url(#wmclip)" className="molten">
          <path id="wmBody" fill="url(#wmgrad)" d="M0 0 H1200 V210 H0 Z" />
          <path
            id="wmSkin"
            d=""
            fill="none"
            stroke="rgba(255,248,220,.85)"
            strokeWidth="2.2"
            style={{ filter: 'blur(0.6px)' }}
          />
        </g>
      </svg>
    </section>
  )
}
