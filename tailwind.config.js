/**
 * DESIGN.md 토큰을 그대로 옮긴 것. 이 파일에 없는 색·간격·반경은 쓰지 않는다.
 * (DESIGN.md "Don't": 문서에 없는 강조색을 새로 만들지 않는다.)
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // 팔레트를 통째로 교체한다. Tailwind 기본 색(slate, blue…)은 쓸 수 없게 만든다.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      ink: '#000000',
      canvas: '#ffffff',
      'inverse-canvas': '#000000',
      'inverse-ink': '#ffffff',
      hairline: '#e6e6e6',
      'hairline-soft': '#f1f1f1',
      'surface-soft': '#f7f7f5',
      lime: '#dceeb1',
      lilac: '#c5b0f4',
      cream: '#f4ecd6',
      pink: '#efd4d4',
      mint: '#c8e6cd',
      coral: '#f3c9b6',
      navy: '#1f1d3d',
      magenta: '#ff3d8b',
      success: '#1ea64a',
    },
    borderRadius: {
      none: '0',
      xs: '2px',
      sm: '6px',
      md: '8px',
      lg: '24px',
      xl: '32px',
      pill: '50px',
      full: '9999px',
    },
    spacing: {
      0: '0px',
      hair: '1px',
      xxs: '4px',
      xs: '8px',
      sm: '12px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      xxl: '48px',
      section: '96px',
      // 레이아웃 계산용 보조값 (토큰 배수)
      10: '40px',
      14: '56px',
      18: '72px',
      30: '120px',
      full: '100%',
    },
    extend: {
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Pretendard Variable', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // DESIGN.md typography 스케일. [size, {lineHeight, letterSpacing, fontWeight}]
        'display-xl': ['86px', { lineHeight: '1.0', letterSpacing: '-1.72px', fontWeight: '340' }],
        'display-lg': ['64px', { lineHeight: '1.1', letterSpacing: '-0.96px', fontWeight: '340' }],
        headline: ['26px', { lineHeight: '1.35', letterSpacing: '-0.26px', fontWeight: '540' }],
        subhead: ['26px', { lineHeight: '1.35', letterSpacing: '-0.26px', fontWeight: '340' }],
        'card-title': ['24px', { lineHeight: '1.45', letterSpacing: '0px', fontWeight: '700' }],
        'body-lg': ['20px', { lineHeight: '1.4', letterSpacing: '-0.14px', fontWeight: '330' }],
        body: ['18px', { lineHeight: '1.45', letterSpacing: '-0.26px', fontWeight: '320' }],
        'body-sm': ['16px', { lineHeight: '1.45', letterSpacing: '-0.14px', fontWeight: '330' }],
        link: ['20px', { lineHeight: '1.4', letterSpacing: '-0.1px', fontWeight: '480' }],
        button: ['20px', { lineHeight: '1.4', letterSpacing: '-0.1px', fontWeight: '480' }],
        eyebrow: ['18px', { lineHeight: '1.3', letterSpacing: '0.54px', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '1.0', letterSpacing: '0.6px', fontWeight: '400' }],
      },
      maxWidth: { content: '1280px', column: '760px' },
      boxShadow: {
        // DESIGN.md Elevation: 색 블록이 그림자를 대신한다. 2단계만 허용.
        soft: '0 4px 16px rgba(0,0,0,0.06)',
        modal: '0 24px 64px rgba(0,0,0,0.24)',
      },
    },
  },
  plugins: [],
}
