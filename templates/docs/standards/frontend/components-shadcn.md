# Frontend — shadcn/ui 표준

**기준 버전**: shadcn/ui (2026-04 기준 최신 CLI) / Radix UI / Tailwind 4
**최종 갱신**: 2026-04

## shadcn 철학 이해

- **라이브러리가 아니라 코드 복사** — CLI로 소스를 프로젝트에 가져와 직접 편집
- 장점: 완전한 제어, 번들 최적, 원하는 대로 커스터마이즈
- 단점: 업데이트 자동 안 됨, 팀이 "손대지 마"로 관리해야 함

## 설치·설정

```bash
pnpm dlx shadcn@latest init
```

선택지:
- Style: **New York** (권장, 더 다듬어짐) 또는 Default
- Base color: `neutral` 또는 `zinc` 권장
- CSS variables: **Yes** (테마 변경 용이)

## 디렉터리 구조

```
components/
├── ui/                     # shadcn 컴포넌트 (손대지 말기 or 신중하게)
│   ├── button.tsx
│   ├── dialog.tsx
│   └── ...
└── features/               # 비즈니스 컴포넌트 (ui 조합)
    ├── user-card.tsx
    └── product-grid.tsx
```

- `components/ui/` 는 **빌딩 블록** — 생으로 쓰지 말고 features/에서 조합

## 컴포넌트 추가

```bash
pnpm dlx shadcn@latest add button dialog dropdown-menu
```

여러 컴포넌트 동시 추가 가능. 이미 있는 건 덮어쓸지 물어봄.

## 테마 (CSS 변수)

```css
/* app/globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --radius: 0.5rem;
    /* ... */
  }
  
  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    /* ... */
  }
}
```

- **HSL 값만** (컴마 없이) — Tailwind가 `hsl(var(--primary))` 로 래핑
- 브랜드 색 변경 시 여기만 수정 → 모든 컴포넌트 적용

## 컴포넌트 커스터마이즈 원칙

### 작은 변경 → 직접 수정

```tsx
// components/ui/button.tsx (shadcn 생성본)
const buttonVariants = cva(
  "inline-flex items-center...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        // 🆕 브랜드 variant 추가
        brand: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
        // ...
      },
    },
  }
);
```

### 큰 변경 → 래퍼 컴포넌트

```tsx
// components/features/loading-button.tsx
'use client';
import { Button, ButtonProps } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
}

export function LoadingButton({ loading, children, ...props }: LoadingButtonProps) {
  return (
    <Button disabled={loading} {...props}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
```

## 자주 쓰는 컴포넌트 패턴

### Dialog (모달)

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

<Dialog>
  <DialogTrigger asChild>
    <Button>열기</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>제목</DialogTitle>
    </DialogHeader>
    {/* 본문 */}
  </DialogContent>
</Dialog>
```

- **`asChild`** 패턴 — 래퍼 없이 트리거 요소 스타일 유지
- 접근성 자동 (ESC 닫기, 포커스 트랩, aria)

### Form + react-hook-form + zod

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export function LoginForm() {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>이메일</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* ... */}
      </form>
    </Form>
  );
}
```

- shadcn Form은 react-hook-form + Radix Label을 묶은 thin wrapper
- `FormMessage` 가 자동 에러 표시

### Data Table

- shadcn `data-table` + **TanStack Table** 조합
- 페이지네이션·정렬·필터 모두 제공
- 대용량은 서버사이드 처리 (TanStack Table headless)

### Toast / Sonner

```bash
pnpm dlx shadcn@latest add sonner
```

```tsx
import { toast } from 'sonner';

toast.success('저장 완료');
toast.error('저장 실패', { description: err.message });
```

- 기존 `toast` 컴포넌트는 deprecated → Sonner 권장

## 접근성 (Radix 기반)

shadcn 대부분 **Radix UI** 기반 — 기본 a11y 잘 됨:
- 포커스 트랩 (Dialog, Popover)
- 키보드 네비게이션 (Menu, Combobox)
- ARIA 속성 자동

하지만 **직접 조립**하는 경우 주의:
- `Button` 대신 `div onClick` 금지
- 커스텀 토글은 `role="switch"` + `aria-checked`
- 색상만으로 상태 표현 금지 (아이콘·텍스트 병행)

## 업데이트 전략

shadcn 컴포넌트는 자동 업데이트 X → **주기적 수동 검토**:

1. 분기에 한 번 `shadcn diff <component>` 로 업스트림 변경 확인
2. 우리가 커스터마이즈한 부분은 보존하며 병합
3. 큰 breaking 변경은 점진적 적용

## 라이선스

- MIT — 상업용 OK
- 복사한 컴포넌트에 shadcn 크레딧 필수 아님

## 자주 쓰는 shadcn 컴포넌트

| 카테고리 | 컴포넌트 |
|---------|---------|
| 입력 | Input, Textarea, Select, Checkbox, Switch, Radio Group |
| 피드백 | Alert, Toast(Sonner), Skeleton, Progress |
| 오버레이 | Dialog, Sheet, Popover, Tooltip, HoverCard |
| 네비 | NavigationMenu, Tabs, Breadcrumb, Pagination |
| 데이터 | Table, DataTable, Card, Badge, Avatar |
| 액션 | Button, DropdownMenu, ContextMenu |

## 금지 사항

- `components/ui/` 를 건드린 뒤 기록 안 함 — 업데이트 시 혼란
- shadcn과 Chakra·MUI 같은 다른 UI 라이브러리 혼용 — 테마 충돌
- Radix 기반 기능(포커스·ARIA)을 덮어써 접근성 깨기
- 모든 Radix primitive에 직접 의존 — shadcn 래퍼 경유 권장
- CSS 변수 이름 임의 변경 — 컴포넌트 전부 깨짐
