/**
 * 소개 화면 효과(hackforge-docs ADR 016, DESIGN.md "소개 화면 효과"). 시안 01-landing.html의 스크립트를 옮겼다.
 * 소개 화면 뿌리(.lp) 안에서만 찾고, 반환하는 함수를 부르면 이벤트·관찰·타이머·반복을 모두 걷어 낸다.
 * 움직임 줄이기를 켠 사람에게는 효과 없이 끝난 모습을 보인다(R). 시안에 있던 소리는 2026-11-18 결정으로 뺐다
 */

const SEAL_SVG = `<svg class="seal" viewBox="0 0 200 200" aria-hidden="true"><defs><path id="sealc" d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0"/><filter id="ink"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.2"/></filter></defs><g filter="url(#ink)"><circle cx="100" cy="100" r="96" stroke-width="2.5"/><circle cx="100" cy="100" r="90" stroke-width="1"/><circle cx="100" cy="100" r="57" stroke-width="1"/><text class="seal-ring"><textPath href="#sealc" textLength="462" lengthAdjust="spacing">HACKFORGE ✦ DEFENSE VERIFIED ✦ MMXXVI ✦</textPath></text><text x="100" y="106" class="core" text-anchor="middle">Tempered</text><text x="100" y="128" class="sub" text-anchor="middle">PASSED</text></g></svg>`
const CHECK =
  '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>'
const CROSS =
  '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>'

const ROWS: [string, boolean][] = [
  ['기존 공격 1', true],
  ['기존 공격 2', true],
  ['기존 공격 3', true],
  ['기존 공격 4', true],
  ['기존 공격 5', false],
  ['정상 기능 3개', true],
]

/** 달군 쇠 색: 1 흰빛 → 노랑 → 주황 → 체리빛 → 0 식음 */
const RAMP: [number, number[]][] = [
  [0, [74, 64, 62]],
  [0.3, [200, 50, 30]],
  [0.55, [255, 122, 26]],
  [0.8, [255, 210, 90]],
  [1, [255, 246, 213]],
]

const clamp = (v: number) => Math.max(0, Math.min(1, v))

export function startLandingEffects(root: HTMLElement): () => void {
  // 효과에 필요한 브라우저 기능이 없으면(테스트의 jsdom 등) 효과 없이 끝난 모습을 둔다
  if (typeof IntersectionObserver === 'undefined' || !('animate' in root) || !window.matchMedia)
    return () => {}
  const R = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let stopped = false
  const cleanups: (() => void)[] = []
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => !stopped && fn(), ms)
    cleanups.push(() => clearTimeout(id))
  }
  const listen = (
    target: Window | Document,
    type: string,
    fn: (e: Event) => void,
    opts?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, fn, opts)
    cleanups.push(() => target.removeEventListener(type, fn, opts))
  }
  const watch = (cb: IntersectionObserverCallback, opts: IntersectionObserverInit) => {
    const o = new IntersectionObserver(cb, opts)
    cleanups.push(() => o.disconnect())
    return o
  }
  const once = (el: Element | null, fn: () => void, threshold = 0.35) => {
    if (!el) return
    const o = watch(
      (es) => {
        if (es[0].isIntersecting) {
          o.disconnect()
          fn()
        }
      },
      { threshold },
    )
    o.observe(el)
  }
  const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)
  const qa = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll<T>(sel)]
  /** CSS 애니메이션을 처음부터 다시 */
  const replay = (el: HTMLElement, cls?: string) => {
    if (cls) el.classList.remove(cls)
    else el.style.animation = 'none'
    void el.offsetWidth
    if (cls) el.classList.add(cls)
    else el.style.animation = ''
  }

  // 효과가 도는 동안만 처음 숨김(.rv 등)을 쓴다. 스크립트가 없으면 CSS가 다 보이게 둔다
  root.classList.add('js')
  cleanups.push(() => root.classList.remove('js'))

  // 화면에 들어오면 떠오르기
  const reveal = watch(
    (es) =>
      es.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          reveal.unobserve(e.target)
        }
      }),
    { threshold: 0.15 },
  )
  qa('.rv').forEach((el) => (R ? el.classList.add('in') : reveal.observe(el)))

  // 첫 화면 제품 화면 기울기, 실습 방식 화면 고정과 단계 전환, 진행선, 상단 줄
  const shot = q('.shot')!
  const track = q('.story-track')!
  const steps = qa('.stp')
  const frames = qa('.frame')
  const progress = q('.progress')
  const topbar = q('.topbar')
  const restamp = (s: HTMLElement) =>
    [s.querySelector<HTMLElement>('.n'), s.querySelector<HTMLElement>('h3')].forEach(
      (x) => x && replay(x),
    )
  function update() {
    const vh = window.innerHeight
    if (!R) {
      const r = shot.getBoundingClientRect()
      shot.style.setProperty('--t', clamp((r.top - vh * 0.12) / (vh * 0.55)).toFixed(3))
    }
    const t = track.getBoundingClientRect()
    const p = clamp(-t.top / (t.height - vh))
    const i = Math.min(2, Math.floor(p * 3))
    const f = p * 3 - i
    steps.forEach((s, k) => {
      const was = s.classList.contains('on')
      s.classList.toggle('on', k === i)
      s.style.setProperty('--f', `${k < i ? 100 : k === i ? f * 100 : 0}%`)
      s.style.setProperty('--head', k === i && f > 0.02 && f < 0.98 ? '1' : '0')
      if (!was && k === i) restamp(s)
    })
    frames.forEach((s, k) => s.classList.toggle('on', k === i))
    const scrollable = document.documentElement.scrollHeight - vh
    progress?.style.setProperty('--p', `${clamp(window.scrollY / scrollable) * 100}%`)
    topbar?.classList.toggle('scrolled', window.scrollY > 8)
  }
  let ticking = false
  listen(
    window,
    'scroll',
    () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        if (!stopped) update()
      })
    },
    { passive: true },
  )
  listen(window, 'resize', update)
  update()

  // 실습 방식에 다시 들어오면 머리와 단계 각인을 다시 보인다
  const how = q('#how')
  if (how && !R) {
    const heads = [...how.querySelectorAll<HTMLElement>('.rv')]
    watch(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            heads.forEach((x) => x.classList.add('in'))
            const on = how.querySelector<HTMLElement>('.stp.on')
            if (on) restamp(on)
          } else heads.forEach((x) => x.classList.remove('in'))
        }),
      { threshold: 0 },
    ).observe(how)
  }

  // 불티: host 안에서 el 위치를 중심으로 흩어짐
  function sparks(host: HTMLElement, el: Element, n = 14, yk = 0.6, reach = [40, 90]) {
    if (R) return
    const r = el.getBoundingClientRect()
    const hr = host.getBoundingClientRect()
    for (let i = 0; i < n; i++) {
      const d = document.createElement('i')
      d.className = 'spark'
      const a = ((-170 + Math.random() * 160) * Math.PI) / 180
      const len = reach[0] + Math.random() * reach[1]
      const rot = (a * 180) / Math.PI + 90
      d.style.left = `${r.left - hr.left + r.width * (0.2 + Math.random() * 0.6)}px`
      d.style.top = `${r.top - hr.top + r.height * yk}px`
      host.appendChild(d)
      d.animate(
        [
          { opacity: 1, transform: `rotate(${rot}deg)` },
          {
            opacity: 0,
            transform: `translate(${Math.cos(a) * len}px,${Math.sin(a) * len + 30}px) rotate(${rot}deg) scaleY(.3)`,
          },
        ],
        { duration: 450 + Math.random() * 350, easing: 'cubic-bezier(.2,.7,.3,1)' },
      ).onfinish = () => d.remove()
    }
  }

  // 첫 화면: hot이 망치 3박자로 달아오르고 스크롤하면 식음, 뒤로 불티
  const hot = q('.hero .hot')!
  const wrap = q('.hero-wrap')!
  let heat = 1
  let beatHeat = 0
  const REST = 0.82
  function heatColor(h: number) {
    const ramp = RAMP
    for (let i = 1; i < ramp.length; i++) {
      if (h <= ramp[i][0]) {
        const [a, ca] = ramp[i - 1]
        const [b, cb] = ramp[i]
        const k = (h - a) / (b - a)
        return ca.map((v, j) => Math.round(v + (cb[j] - v) * k))
      }
    }
    return ramp[ramp.length - 1][1]
  }
  function paintHot() {
    const h = Math.max(0, beatHeat * heat)
    const g = Math.round(6 + h * 34)
    hot.style.color = `rgb(${heatColor(h).join(',')})`
    hot.style.textShadow =
      h > 0.05
        ? `0 0 ${g}px rgba(${heatColor(Math.min(1, h + 0.1)).join(',')},${0.25 + h * 0.5})`
        : 'none'
  }
  const cooling = () => {
    heat = clamp(1 - window.scrollY / (window.innerHeight * 0.6))
    paintHot()
  }
  listen(window, 'scroll', () => requestAnimationFrame(() => !stopped && cooling()), {
    passive: true,
  })
  cooling()
  later(() => sparks(wrap, hot, 18, 0.5, [70, 120]), 580)

  const fx = q('.fx')!
  function burst(x: number, y: number, n = 22, len = 150) {
    if (R) return
    for (let i = 0; i < n; i++) {
      const d = document.createElement('i')
      d.className = 'spark'
      const a = ((-180 + Math.random() * 180) * Math.PI) / 180
      const l = len * (0.4 + Math.random() * 0.8)
      const rot = (a * 180) / Math.PI + 90
      d.style.left = `${x}px`
      d.style.top = `${y}px`
      fx.appendChild(d)
      d.animate(
        [
          { opacity: 1, transform: `rotate(${rot}deg)` },
          {
            opacity: 0,
            transform: `translate(${Math.cos(a) * l}px,${Math.sin(a) * l + 50}px) rotate(${rot + 40}deg) scaleY(.3)`,
          },
        ],
        { duration: 500 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' },
      ).onfinish = () => d.remove()
    }
  }
  const h1 = q('.hero h1')!
  const l1 = q('.hero .l1')!
  const stages = [0.45, 0.75, 1]
  ;[580, 1000, 1420].forEach((ms, i) =>
    later(
      () => {
        beatHeat = stages[i]
        paintHot()
        if (i > 0 && !R) {
          replay(l1, 'beat')
          const r = hot.getBoundingClientRect()
          burst(
            r.left + r.width * (0.3 + Math.random() * 0.4),
            r.top + r.height * 0.5,
            10 + i * 6,
            80 + i * 30,
          )
          h1.classList.remove('shake')
        }
        if (i === 2)
          later(() => {
            beatHeat = REST
            paintHot()
          }, 700)
      },
      R ? 0 : ms,
    ),
  )

  // 불씨: 첫 화면 뒤로 떠오르는 작은 불티(캔버스). 첫 화면을 벗어나면 그리지 않는다
  const canvas = q<HTMLCanvasElement>('.hero-wrap canvas')
  if (canvas && !R) {
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    let W = 0
    let H = 0
    const probe = document.createElement('i')
    probe.style.color = 'var(--acc)'
    probe.hidden = true
    root.appendChild(probe)
    cleanups.push(() => probe.remove())
    const rgb = () =>
      (getComputedStyle(probe).color.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']).slice(0, 3).join(',')
    const size = () => {
      W = canvas.width = canvas.clientWidth * dpr
      H = canvas.height = canvas.clientHeight * dpr
    }
    size()
    listen(window, 'resize', size)
    type P = { x: number; y: number; r: number; v: number; w: number; t: number }
    const make = (y?: number): P => ({
      x: W * (0.1 + Math.random() * 0.8),
      y: y ?? H + Math.random() * H * 0.3,
      r: (0.6 + Math.random() * 1.6) * dpr,
      v: (0.25 + Math.random() * 0.6) * dpr,
      w: Math.random() * 6.28,
      t: 0,
    })
    const ps = Array.from({ length: 26 }, () => make(Math.random() * H))
    let visible = true
    watch((es) => (visible = es[0].isIntersecting), { threshold: 0 }).observe(wrap)
    let raf = 0
    const tick = () => {
      if (stopped || !ctx) return
      raf = requestAnimationFrame(tick)
      if (!visible) return
      ctx.clearRect(0, 0, W, H)
      if (heat <= 0) return
      const c = rgb()
      for (const p of ps) {
        p.y -= p.v
        p.w += 0.02
        p.x += Math.sin(p.w) * 0.35 * dpr
        p.t++
        const a = 0.7 * heat * clamp(p.y / H) * (0.6 + 0.4 * Math.sin(p.t * 0.15))
        ctx.beginPath()
        ctx.fillStyle = `rgba(${c},${a})`
        ctx.shadowColor = `rgba(${c},${a})`
        ctx.shadowBlur = 8 * dpr
        ctx.arc(p.x, p.y, p.r, 0, 7)
        ctx.fill()
        if (p.y < -10) Object.assign(p, make())
      }
    }
    tick()
    cleanups.push(() => cancelAnimationFrame(raf))
  }

  // 주 버튼을 누르면 작은 불티, 얇은 충격파, 버튼이 달았다 식음, 살짝 흔들림
  listen(document, 'click', (e) => {
    const b = (e.target as Element | null)?.closest<HTMLElement>('.lp .btn.p')
    if (!b || R) return
    const { clientX: x, clientY: y } = e as MouseEvent
    const ring = document.createElement('i')
    ring.className = 'shock'
    ring.style.left = `${x}px`
    ring.style.top = `${y}px`
    ring.style.borderWidth = '1.5px'
    fx.appendChild(ring)
    ring.animate(
      [
        { transform: 'scale(1)', opacity: 0.7 },
        { transform: 'scale(6)', opacity: 0 },
      ],
      { duration: 520, easing: 'cubic-bezier(.1,.7,.3,1)' },
    ).onfinish = () => ring.remove()
    burst(x, y, 6, 45)
    const br = b.getBoundingClientRect()
    const glow = document.createElement('i')
    glow.className = 'heat'
    glow.style.left = `${x - br.left}px`
    glow.style.top = `${y - br.top}px`
    let layer = b.querySelector<HTMLElement>(':scope > .heatlayer')
    if (!layer) {
      layer = document.createElement('span')
      layer.className = 'heatlayer'
      b.appendChild(layer)
    }
    layer.appendChild(glow)
    glow.animate(
      [
        { opacity: 1, transform: 'scale(.4)' },
        { opacity: 0.8, transform: 'scale(1.6)', offset: 0.3 },
        { opacity: 0, transform: 'scale(2.4)' },
      ],
      { duration: 900, easing: 'ease-out' },
    ).onfinish = () => glow.remove()
    replay(b, 'dent')
    b.parentElement?.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: 'translate(-1.5px,1px)' },
        { transform: 'translate(1.5px,-1px)' },
        { transform: 'translate(-1px,0)' },
        { transform: 'translate(0,0)' },
      ],
      { duration: 240 },
    )
  })

  // 구간 구분선이 화면에 들어오면 그려짐
  qa('.tdiv').forEach((d) => (R ? d.classList.add('in') : once(d, () => d.classList.add('in'), 1)))

  // 검증: 판정 카드가 한 줄씩 채워져 FAIL → 다시 검증해 PASS와 통과 각인
  const vc = q('#vcard')
  function card(pass: boolean, done?: () => void) {
    if (!vc) return
    vc.innerHTML =
      `<div class="rh"><span class="big badge ${pass ? '' : 'f'}">${pass ? 'PASS' : 'FAIL'}</span><h4>방어 검증 ${pass ? '05' : '04'}</h4><small>${pass ? '시도 5' : '시도 4'}</small></div>` +
      ROWS.map(([name, ok]) => {
        const o = pass || ok
        return `<div class="row ${o ? '' : 'no-row'}"><span>${name}</span><span class="st ${o ? 'ok' : 'no'}">${o ? CHECK : CROSS}${name.startsWith('정상') ? '정상' : o ? '막힘' : '아직 통함'}</span></div>`
      }).join('') +
      '<p class="cap">공격만 막고 정상 기능을 깨뜨린 수정은 통과하지 못해요.</p>' +
      (pass ? SEAL_SVG : '')
    const rows = [...vc.querySelectorAll('.row')]
    rows.forEach((r, i) => later(() => r.classList.add('in'), R ? 0 : 200 + i * 230))
    later(
      () => {
        vc.querySelector('.badge')?.classList.add('in')
        if (pass)
          later(
            () => {
              const seal = vc.querySelector('.seal')
              seal?.classList.add('in')
              vc.classList.add('thud')
              if (seal) later(() => sparks(vc, seal, 18, 0.5), 260)
            },
            R ? 0 : 380,
          )
        if (done) later(done, R ? 0 : 1800)
      },
      R ? 0 : 200 + rows.length * 230 + 120,
    )
  }
  once(vc, () => card(false, () => later(() => card(true), R ? 0 : 900)))

  // 실습 환경: 카드가 차례로 떠오르고 숫자가 올라가고, 정리 시계가 흘러감
  const facts = q('#facts')
  once(
    facts,
    () => {
      facts!.classList.add('play')
      facts!.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
        const to = Number(el.dataset.count)
        const t0 = performance.now()
        const step = (t: number) => {
          if (stopped) return
          const k = Math.min(1, (t - t0) / 1200)
          el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))))
          if (k < 1 && !R) requestAnimationFrame(step)
        }
        step(t0)
      })
      const clock = facts!.querySelector<HTMLElement>('[data-clock]')
      if (clock && !R) {
        let sec = 1800
        const id = window.setInterval(() => {
          sec = sec > 1795 ? sec - 1 : 1800
          clock.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
        }, 1000)
        cleanups.push(() => clearInterval(id))
      }
    },
    0.3,
  )

  // 문제: 분류 타일이 숯불처럼 한 번 달아올랐다 식음
  const cats = q('#cats')
  once(cats, () => cats!.classList.add('play'), 0.3)

  // 미리 보기: 공격 → 코드 수정 → 재배포 → 같은 공격이 막힘을 반복. 화면에 보일 때만 돈다
  const app = q('#reApp')
  if (app) {
    const cardEl = q('#reCard')!
    const u = q('#reU')!
    const go = q('#reGo')!
    const v = q('#reV')!
    const del = q('#reDel')!
    const a1 = q('#reAdd1')!
    const a2 = q('#reAdd2')!
    const t1 = q('#reT1')!
    const t2 = q('#reT2')!
    const build = q('#reBuild')!
    const tags = qa('#reTags span')
    const sheen = app.querySelector<HTMLElement>('.steelsheen')!
    let live = false
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(resolve, R ? Math.min(ms, 30) : ms)
        cleanups.push(() => clearTimeout(id))
      })
    const tag = (i: number) => tags.forEach((x, k) => x.classList.toggle('on', k === i))
    const verdict = (text: string, cls: string) => {
      v.textContent = text
      v.className = `verdict ${cls}${text ? ' in' : ''}`
    }
    async function typeAttack() {
      u.textContent = 'admin'
      for (let i = 0; i < 7; i++) {
        await wait(95)
        u.insertAdjacentHTML('beforeend', '<span class="redact"></span>')
      }
    }
    function press() {
      go.style.transform = 'scale(.95)'
      later(() => (go.style.transform = ''), 120)
    }
    function attackLands() {
      cardEl.querySelector('.heatedge')?.remove()
      const edge = document.createElement('i')
      edge.className = 'heatedge'
      cardEl.appendChild(edge)
      edge.animate(
        [
          { opacity: 0 },
          { opacity: 1, offset: 0.25 },
          { opacity: 0.85, offset: 0.7 },
          { opacity: 0.25 },
        ],
        { duration: R ? 1 : 2600, fill: 'forwards' },
      )
      cardEl.animate(
        [
          { transform: 'translateY(0)' },
          { transform: 'translateY(2px)' },
          { transform: 'translateY(0)' },
        ],
        { duration: R ? 1 : 220 },
      )
    }
    function attackBlocked() {
      sheen.animate([{ transform: 'translateX(-100%)' }, { transform: 'translateX(100%)' }], {
        duration: R ? 1 : 900,
        easing: 'cubic-bezier(.4,0,.2,1)',
      })
      cardEl.animate(
        [
          { transform: 'translateY(0)' },
          { transform: 'translateY(-3px)' },
          { transform: 'translateY(0)' },
        ],
        { duration: 260 },
      )
    }
    async function typeLine(el: HTMLElement, text: string) {
      el.innerHTML = '<span class="tcur"></span>'
      for (const ch of text) {
        await wait(28)
        if (stopped) return
        el.insertBefore(document.createTextNode(ch), el.lastChild)
      }
      el.querySelector('.tcur')?.remove()
    }
    async function loop() {
      while (!stopped) {
        if (!live) {
          await wait(400)
          continue
        }
        tag(0)
        verdict('', '')
        cardEl.querySelector('.heatedge')?.remove()
        del.className = 'l'
        a1.classList.add('hide')
        a2.classList.add('hide')
        t1.textContent = ''
        t2.textContent = ''
        build.style.width = '0'
        u.textContent = ''
        await wait(700)
        await typeAttack()
        await wait(380)
        press()
        await wait(140)
        attackLands()
        verdict('관리자(admin)로 로그인됨 · 뚫림', 'bad')
        await wait(2200)
        tag(1)
        del.classList.add('glitch')
        await wait(600)
        del.className = 'l del'
        await wait(600)
        a1.classList.remove('hide')
        await typeLine(t1, '$stmt = $db->prepare("... WHERE user = ?");')
        a2.classList.remove('hide')
        await typeLine(t2, "$stmt->bind_param('s', $u);")
        await wait(300)
        del.classList.add('hide')
        await wait(700)
        tag(2)
        verdict('재배포 중…', 'mid')
        build.animate([{ width: '0%' }, { width: '100%' }], {
          duration: R ? 1 : 1500,
          easing: 'ease-in-out',
          fill: 'forwards',
        })
        await wait(1600)
        verdict('', '')
        u.textContent = ''
        tag(3)
        await wait(400)
        await typeAttack()
        await wait(380)
        press()
        await wait(140)
        attackBlocked()
        verdict('로그인 실패 · 막힘', 'good')
        await wait(3200)
      }
    }
    watch((es) => (live = es[0].isIntersecting), { threshold: 0.35 }).observe(app)
    void loop()
  }

  // 쇳물 글자: 표면이 느리게 꿀렁이며 고르지 않게 약 2초에 차오름
  const wm = q('#wm')
  const body = q<SVGPathElement>('#wmBody')
  const skin = q<SVGPathElement>('#wmSkin')
  const grad = q<SVGLinearGradientElement>('#wmgrad')
  if (wm && body && skin && grad && !R) {
    const W = 1200
    const H = 210
    const TOP = 14
    body.setAttribute('d', '')
    const lumps = Array.from({ length: 6 }, (_, i) => ({
      x: 80 + i * 210 + Math.random() * 100,
      w: 90 + Math.random() * 120,
      a: 13 + Math.random() * 12,
      ph: Math.random() * 6.28,
      sp: (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.07),
    }))
    const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
    const level = (t: number) => {
      const k = Math.min(1, t / 2200)
      return ease(k) + Math.sin(k * Math.PI * 2) * 0.025 * (1 - k)
    }
    let start: number | null = null
    let raf = 0
    const frame = (ts: number) => {
      if (stopped) return
      if (start === null) start = ts
      const t = ts - start
      const y0 = H - (H - TOP + 12) * level(t)
      const pts: string[] = []
      for (let x = 0; x <= W; x += 16) {
        let y = y0 + Math.sin(x * 0.0065 + t * 0.00045) * 6 + Math.sin(x * 0.017 - t * 0.0007) * 2.6
        for (const L of lumps) {
          const dx = x - L.x
          y -=
            L.a * Math.exp(-(dx * dx) / (2 * L.w * L.w)) * (0.6 + 0.4 * Math.sin(t * 0.0005 + L.ph))
        }
        pts.push(`${x} ${y.toFixed(1)}`)
      }
      body.setAttribute('d', `M0 ${H} L${pts.join(' L')} L${W} ${H} Z`)
      skin.setAttribute('d', `M${pts.join(' L')}`)
      for (const L of lumps) {
        L.x += L.sp
        if (L.x < 60 || L.x > W - 60) L.sp *= -1
      }
      grad.setAttribute('y1', String(Math.max(0, y0 - 4)))
      grad.setAttribute('y2', String(y0 + H * 0.9))
      if (t < 8000) raf = requestAnimationFrame(frame)
    }
    once(wm, () => (raf = requestAnimationFrame(frame)), 0.5)
    cleanups.push(() => cancelAnimationFrame(raf))
  }

  return () => {
    stopped = true
    cleanups.forEach((fn) => fn())
  }
}
