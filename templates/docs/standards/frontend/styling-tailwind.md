# Frontend — Tailwind CSS 표준

**기준 버전**: Tailwind CSS 4.x
**최종 갱신**: 2026-04

## 기본 철학

- **유틸리티 퍼스트** — 커스텀 CSS 클래스 만들기 전에 유틸 조합 먼저
- **디자인 토큰은 `tailwind.config`** 또는 CSS 변수에 집중 관리 — 하드코딩 색상 금지
- `@apply` 남용 금지 — 유틸 그대로 읽는 게 디버깅 유리

## 클래스 정렬

**Prettier + `prettier-plugin-tailwindcss`** 필수 — 공식 권장 순서로 자동 정렬

```json
{
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

정렬 순서: layout → spacing → sizing → typography → background → border → effect → state

## 디자인 토큰

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  /* 색상 */
  --color-brand: oklch(62% 0.18 252);
  --color-brand-foreground: oklch(98% 0 0);
  
  /* 반경 */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
}
```

- **OKLCH 색상 공간** 권장 (지각적 균일, HDR 대응)
- shadcn/ui 사용 시 그 쪽 토큰 체계와 통합

## 반응형

- **모바일 우선**: 기본 스타일은 모바일, `md:`, `lg:` 로 확장
- 브레이크포인트: `sm 640` `md 768` `lg 1024` `xl 1280` `2xl 1536`
- **임의 값 남발 금지**: `w-[547px]` 같은 건 정말 예외 상황만

```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
```

## 다크모드

```tsx
<div className="bg-white text-black dark:bg-zinc-900 dark:text-zinc-100">
```

- `html` 에 `class="dark"` 토글 (next-themes 라이브러리 추천)
- **대비 비율** 준수 (WCAG AA 4.5:1 이상)

## 조건부 클래스

### clsx / cn 유틸

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- **`cn()` 사용 이유**: 충돌하는 유틸 자동 병합 (`p-4` + `p-2` → `p-2`)

```tsx
<button className={cn(
  "rounded-md px-4 py-2",
  variant === 'primary' && "bg-brand text-white",
  variant === 'secondary' && "bg-zinc-200 text-zinc-900",
  disabled && "opacity-50 cursor-not-allowed",
)}>
```

## 변형 관리: CVA (class-variance-authority)

반복되는 버튼·배지 등은 CVA로:

```typescript
// components/ui/button.tsx
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-brand text-brand-foreground hover:bg-brand/90",
        outline: "border border-input hover:bg-accent",
        ghost: "hover:bg-accent",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);

export interface ButtonProps 
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}
```

## 간격(spacing) 일관성

- **8px 기반** (Tailwind 기본 4단위 → `gap-2 = 8px`)
- 자주 쓰는 간격: `2`, `4`, `6`, `8`, `12`, `16`
- 임의 값 (`gap-[13px]`) 금지 — 디자인 시스템 일관성 깨짐

## 접근성

- **`focus-visible:`** 사용 — 키보드 포커스에만 링 표시
- `sr-only` 로 스크린리더 전용 텍스트
- 충분한 대비 확보 (`text-zinc-600` 대신 `text-zinc-700` 고려)

```tsx
<button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
  <span className="sr-only">메뉴 열기</span>
  <MenuIcon className="h-5 w-5" />
</button>
```

## 애니메이션

- Tailwind 내장: `animate-spin`, `animate-pulse`, `transition-*`, `duration-*`
- 복잡한 건 **framer-motion** 또는 **motion.dev**
- **모션 감소 선호 사용자** 대응:
  ```tsx
  <div className="motion-reduce:transition-none motion-reduce:animate-none">
  ```

## 재사용 가능한 컴포넌트 vs 인라인

기준:
- **2번 쓰면 허용** (DRY 의 "세 번 규칙")
- **3번 이상 쓰면 반드시 컴포넌트화**
- 추상화 비용이 구체성 이득보다 작을 때만

## `@apply` 사용 기준

다음 경우만 허용:
- 복잡한 선택자 (`.prose h2`) — 마크다운 콘텐츠
- 서드파티 라이브러리 스타일 override

```css
.prose h2 {
  @apply mt-8 text-2xl font-bold;
}
```

**컴포넌트 재사용은 `@apply` 말고 React 컴포넌트 + CVA로**.

## 플러그인

| 플러그인 | 용도 |
|---------|------|
| `@tailwindcss/typography` | 블로그·마크다운 `prose` |
| `@tailwindcss/forms` | 폼 요소 기본 스타일 (shadcn 쓰면 불필요) |
| `tailwindcss-animate` | shadcn과 함께 기본 애니메이션 |

## 금지 사항

- **하드코딩 색상** (`bg-[#ff0000]`) — 토큰 사용
- **중복된 유틸 조합을 복붙** — CVA 또는 컴포넌트
- `!important` (`!bg-red-500`) 남용
- 클래스 문자열을 런타임 동적 생성 — JIT 이 감지 못함
  ```tsx
  // ❌ 
  const color = 'red-500';
  <div className={`bg-${color}`}>
  
  // ✅
  const cls = isError ? 'bg-red-500' : 'bg-green-500';
  ```
- `style={{...}}` 인라인 스타일 — Tailwind 유틸이나 CSS 변수로
