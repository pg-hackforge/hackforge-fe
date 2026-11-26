import '@fontsource-variable/geist'
import './landing.css'

import { MenuIcon } from 'lucide-react'
import { Link } from 'react-router'

import labCodeDark from '../../design/screens/lab-code-dark.webp'
import labCodeLight from '../../design/screens/lab-code-light.webp'
import labRecordsDark from '../../design/screens/lab-records-dark.webp'
import labRecordsLight from '../../design/screens/lab-records-light.webp'
import labTargetDark from '../../design/screens/lab-target-dark.webp'
import labTargetLight from '../../design/screens/lab-target-light.webp'
import { LogoMark } from '@/components/logo'

/** 제품 화면은 확정 캡처(design/screens)를 테마에 맞춰 보여 준다 */
const SCREENS = {
  code: { light: labCodeLight, dark: labCodeDark, alt: '방어 단계의 코드 편집기 화면' },
  target: { light: labTargetLight, dark: labTargetDark, alt: '공격 대상 화면' },
  records: { light: labRecordsLight, dark: labRecordsDark, alt: '방어 검증 결과 기록 화면' },
}

function Screen({ name, eager }: { name: keyof typeof SCREENS; eager?: boolean }) {
  const s = SCREENS[name]
  const loading = eager ? 'eager' : 'lazy'
  return (
    <>
      <img src={s.light} alt={s.alt} loading={loading} className="dark:hidden" />
      <img src={s.dark} alt={s.alt} loading={loading} className="hidden dark:block" />
    </>
  )
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

/** 구간 구분선의 색. 위는 달궈진 밀짚색, 아래로 갈수록 식은 파랑·회색(템퍼링 색) */
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
    text: '취약한 웹 서비스가 브라우저 안에서 실행됩니다. 직접 요청을 보내고 터미널로 서버 안을 살피며 취약점을 찾습니다.',
    points: ['웹 화면과 터미널을 함께 제공', '막히면 방향 → 위치 → 방법 순서의 힌트'],
    screen: 'target',
    caption: '공격 대상 화면',
  },
  {
    n: '02',
    title: '방어',
    text: '공격에 성공하면 코드가 열립니다. 웹 편집기에서 원인이 된 코드를 고치고 재배포하면 고친 서비스가 다시 뜹니다.',
    points: ['편집 내용 자동 저장', '재배포, 언제든 처음 상태로 초기화'],
    screen: 'code',
    caption: '웹 IDE',
  },
  {
    n: '03',
    title: '방어 검증',
    text: '통했던 공격을 모두 다시 실행하고, 정상 기능이 그대로인지 함께 확인합니다. 둘 다 만족해야 통과입니다.',
    points: ['무엇이 아직 통하는지 단계적으로 공개', '통과하면 기록에 각인'],
    screen: 'records',
    caption: '방어 검증 결과',
  },
] as const

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
  ['기타', '설정·정보 노출'],
]

/**
 * `/` 로그인 전 소개 화면(hackforge-docs ADR 016, specs/landing). 구간 순서: 첫 화면, 미리 보기, 실습 방식, 검증,
 * 실습 환경, 문제, 마무리, 쇳물 글자, 맨 아래 줄. 반응형(1024px, 640px). 시연에 실제 공격 문자열은 쓰지 않는다
 */
export function LandingPage() {
  return (
    <div className="lp">
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
            가입 신청
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

      <section className="w hero" aria-labelledby="hero-title">
        <h1 id="hero-title">
          <span className="ln">
            Strike <span className="hot">hot</span>
          </span>
          <span className="steel">Fix cold</span>
        </h1>
        <p className="lead">
          실제로 취약한 웹 서비스가 나만 쓰는 격리된 환경에서 실행됩니다. 공격에 성공하면 코드를
          고치고, 같은 공격이 막혔는지 정상 기능은 그대로인지 자동으로 검증합니다.
        </p>
        <div className="cta">
          <Link to="/signup" className="btn p lg">
            가입 신청
          </Link>
          <a className="btn lg" href="#how">
            실습 방식 보기
          </a>
        </div>
        <small>가입 신청 뒤 관리자가 승인하면 바로 시작할 수 있습니다</small>
        <div className="shot">
          <Screen name="code" eager />
        </div>
      </section>

      <Divider from="temper-1" to="temper-2" />
      <section className="w sec" id="demo" aria-labelledby="demo-title">
        <div className="k">미리 보기</div>
        <h2 id="demo-title">공격이 통하면, 고쳐서 막습니다</h2>
        <p className="d">실제 실습 흐름을 그대로 줄였습니다. 공격 문자열은 가려 두었습니다.</p>
        <div className="re">
          <div className="win">
            <div className="wb">
              <i />
              <i />
              <i />
              공격 대상 · 실습 환경의 웹 서비스
            </div>
            <div className="app">
              <div className="login">
                <h4>회원 로그인</h4>
                <div className="in f" aria-label="가린 공격 입력">
                  admin
                  {Array.from({ length: 6 }, (_, i) => (
                    <i key={i} className="redact" />
                  ))}
                </div>
                <div className="in">••••</div>
                <div className="go">로그인</div>
              </div>
              <div className="verdict">관리자(admin)로 로그인됨 · 통함</div>
            </div>
          </div>
          <div className="win">
            <div className="wb">
              <i />
              <i />
              <i />
              index.php
            </div>
            <div className="code">
              <div className="l">
                <span>12</span>
                <span>$u = $_POST['username'];</span>
              </div>
              <div className="l">
                <span>13</span>
                <span>$sql = "SELECT ... WHERE user = '" . $u . "'";</span>
              </div>
              <div className="l">
                <span>15</span>
                <span>// 로그인 처리</span>
              </div>
            </div>
            <div className="build" />
          </div>
        </div>
        <div className="stage-tag">
          <span className="on">공격</span>
          <span>방어 · 코드 수정</span>
          <span>재배포</span>
          <span>방어 검증</span>
        </div>
      </section>

      <Divider from="temper-2" to="temper-3" />
      <section className="sec" id="how" aria-labelledby="how-title">
        <div className="w">
          <div className="k">실습 방식</div>
          <h2 id="how-title">
            한 문제를 공격부터 방어까지
            <br />
            끝까지 따라갑니다
          </h2>
          <p className="d">
            취약점을 설명으로만 배우지 않습니다. 같은 서비스를 먼저 공격하고, 그 공격을 막는 코드를
            직접 씁니다.
          </p>
          <div className="story">
            <div>
              {STEPS.map((step, i) => (
                <div key={step.n} className={i === 0 ? 'stp on' : 'stp'}>
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
              <div className="frame">
                <span className="fcap">{STEPS[0].caption}</span>
                <Screen name={STEPS[0].screen} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Divider from="temper-3" to="temper-4" />
      <section className="w sec" id="verify" aria-labelledby="verify-title">
        <div className="split">
          <div>
            <div className="k">검증</div>
            <h2 id="verify-title">
              통과 여부는 입력이 아니라
              <br />
              결과로 판정합니다
            </h2>
            <p className="d">
              공격은 서비스에 남은 기록으로 확인합니다. 방어는 통했던 공격을 다시 실행하고, 정상
              사용자의 동작까지 함께 테스트합니다. 공격만 막고 서비스를 망가뜨린 수정은 통과하지
              못합니다.
            </p>
          </div>
          <div className="card" aria-label="방어 검증 결과 예시">
            <div className="rh">
              <span className="big f">FAIL</span>
              <h4>방어 검증 04</h4>
              <small>남은 시도 4 / 5</small>
            </div>
            {VERDICT_ROWS.map(([name, ok]) => (
              <div key={name} className="row">
                <span>{name}</span>
                <span className={ok ? 'st' : 'st no'}>
                  {ok ? <Check /> : <Cross />}
                  {name.startsWith('정상') ? '정상' : ok ? '막힘' : '아직 통함'}
                </span>
              </div>
            ))}
            <p className="cap">공격만 막고 정상 기능을 깨뜨린 수정은 통과하지 못합니다.</p>
          </div>
        </div>
      </section>

      <Divider from="temper-4" to="temper-5" />
      <section className="w sec" id="env" aria-labelledby="env-title">
        <div className="k">실습 환경</div>
        <h2 id="env-title">마음껏 공격해도 되는 환경</h2>
        <p className="d">
          실습을 시작하면 나만 쓰는 환경이 새로 만들어지고, 끝나면 지워집니다. 다른 사람의 실습이나
          외부에는 영향을 주지 않습니다.
        </p>
        <div className="facts">
          <div className="fact">
            <div className="viz" aria-hidden>
              <div className="boxes">
                <i />
                <i className="me" />
                <i />
                <i />
              </div>
            </div>
            <b>1인 1환경</b>
            <span className="t">격리된 실습 환경</span>
            <p>웹 서버와 DB가 다른 학습자와 분리되어 실행됩니다.</p>
          </div>
          <div className="fact">
            <div className="viz" aria-hidden>
              <div className="src" />
              <div className="wall" />
              <div className="net" />
            </div>
            <b>차단</b>
            <span className="t">외부 인터넷</span>
            <p>실습 환경에서 밖으로 나가는 연결은 모두 막혀 있습니다.</p>
          </div>
          <div className="fact">
            <div className="viz" aria-hidden>
              <svg className="ring" viewBox="0 0 44 44">
                <circle className="bg" cx="22" cy="22" r="20" />
                <circle className="arc" cx="22" cy="22" r="20" />
              </svg>
            </div>
            <b>약 1분</b>
            <span className="t">환경 준비</span>
            <p>문제를 고르면 1분 안팎으로 공격을 시작할 수 있습니다.</p>
          </div>
          <div className="fact">
            <div className="viz" aria-hidden>
              <span className="clock">30:00</span>
            </div>
            <b>30분</b>
            <span className="t">자동 정리</span>
            <p>입력이 없으면 환경을 정리합니다. 검증 기록은 남습니다.</p>
          </div>
        </div>
      </section>

      <section className="dark-band" id="problems" aria-labelledby="problems-title">
        <div className="w">
          <div className="k">문제</div>
          <h2 id="problems-title" className="h2d">
            웹 서비스에서 실제로 나오는 취약점을 분류별로
          </h2>
          <p className="d">
            문제마다 공격 힌트 3개, 방어 힌트 3개가 있고, 방어 검증 기회를 모두 쓰면 해답이
            열립니다.
          </p>
          <ul className="cats">
            {CATEGORIES.map(([name, note]) => (
              <li key={name} className="ct">
                <b>{name}</b>
                <span>{note}</span>
              </li>
            ))}
          </ul>
          <div className="more">
            <span>문제는 계속 추가됩니다.</span>
            <Link to="/problems" className="btn">
              전체 문제 둘러보기
            </Link>
          </div>
        </div>
      </section>

      <Divider from="temper-6" to="temper-7" />
      <section className="w end" aria-labelledby="end-title">
        <h2 id="end-title">입문 문제부터 시작해 보세요</h2>
        <ol className="flow">
          <li>
            <span>
              <b>1</b>가입 신청
            </span>
          </li>
          <li aria-hidden>→</li>
          <li>
            <span>
              <b>2</b>관리자 승인
            </span>
          </li>
          <li aria-hidden>→</li>
          <li>
            <span>
              <b>3</b>문제 골라 시작
            </span>
          </li>
        </ol>
        <div className="btns">
          <Link to="/signup" className="btn p lg">
            가입 신청
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
          불법입니다.
        </span>
        <span className="credit">
          기획·개발<b>고성노</b> · <a href="mailto:rhtjdsh35@gmail.com">rhtjdsh35@gmail.com</a>
        </span>
      </footer>
    </div>
  )
}

/** 쇳물 글자 HACKFORGE: 다 차오른 모습. 위는 밝은 쇳물, 아래로 갈수록 식은 붉은색 */
function Wordmark() {
  return (
    <section className="w wm" aria-label="Hackforge">
      <svg viewBox="0 0 1200 210" aria-hidden>
        <defs>
          <linearGradient id="wmgrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="210">
            <stop offset="0" stopColor="#FFE7A3" />
            <stop offset=".05" stopColor="#FFB547" />
            <stop offset=".22" stopColor="#F26A12" />
            <stop offset=".6" stopColor="#B8321E" />
            <stop offset="1" stopColor="#6A1A12" />
          </linearGradient>
          {/* 쇳물 빛. 기본 필터 영역이면 빛이 글자 양 끝에서 잘려 세로 줄이 생겨 영역을 넓힌다 */}
          <filter id="wmglow" x="-10%" y="-40%" width="120%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#FF7A1A" floodOpacity=".45" />
          </filter>
        </defs>
        <text
          className="molten"
          x="600"
          y="186"
          textAnchor="middle"
          fill="url(#wmgrad)"
          filter="url(#wmglow)"
        >
          HACKFORGE
        </text>
      </svg>
    </section>
  )
}
