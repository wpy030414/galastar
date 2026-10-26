import { cva, type VariantProps } from 'class-variance-authority'
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

/* ---------------------------------- 按钮 ---------------------------------- */

const buttonStyles = cva(
  'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-[0_8px_24px_-12px_hsl(var(--primary))] hover:brightness-110 active:brightness-95',
        secondary:
          'border border-border/80 bg-raised text-foreground hover:border-border hover:bg-raised/70',
        ghost: 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground',
        outline: 'border border-border/80 text-foreground hover:bg-white/[0.05]',
        danger: 'border border-destruct/40 bg-destruct/10 text-destruct hover:bg-destruct/20',
        star: 'border border-star/40 bg-star/10 text-star hover:bg-star/20',
      },
      size: {
        sm: 'h-8 px-2.5 text-xs',
        md: 'h-9 px-3.5',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'h-8 w-8',
        'icon-sm': 'h-7 w-7',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonStyles({ variant, size }), className)} {...props} />
}

/* ---------------------------------- 表单 ---------------------------------- */

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-md border border-border/80 bg-raised/50 px-3 text-sm text-foreground placeholder:text-muted-foreground/60',
        'transition-colors focus:border-primary/60 focus:bg-raised/80 focus:outline-none focus:ring-2 focus:ring-primary/15',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-md border border-border/80 bg-raised/50 px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60',
        'transition-colors focus:border-primary/60 focus:bg-raised/80 focus:outline-none focus:ring-2 focus:ring-primary/15',
        className,
      )}
      {...props}
    />
  )
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'h-9 w-full appearance-none rounded-md border border-border/80 bg-raised/50 pl-3 pr-8 text-sm text-foreground',
          'transition-colors focus:border-primary/60 focus:bg-raised/80 focus:outline-none focus:ring-2 focus:ring-primary/15',
          '[&>option]:bg-panel [&>option]:text-foreground',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
  className,
  action,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {action}
      </div>
      {children}
      {hint ? <p className="text-[11px] leading-relaxed text-muted-foreground/60">{hint}</p> : null}
    </div>
  )
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
        checked ? 'border-primary/60 bg-primary/80' : 'border-border bg-raised',
        disabled && 'opacity-40',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all',
          checked ? 'left-[18px]' : 'left-0.5 bg-muted-foreground',
        )}
      />
    </button>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  className,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  className?: string
}) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-[hsl(var(--primary))]',
        '[&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white',
        className,
      )}
    />
  )
}

/* ---------------------------------- 分段控件 ---------------------------------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-border/70 bg-raised/40 p-0.5',
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors',
            value === opt.value
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------------------------- 弹层 ---------------------------------- */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    const timer = window.setTimeout(() => ref.current?.focus(), 20)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(timer)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full overflow-hidden rounded-xl border border-border/70 bg-panel shadow-[0_40px_120px_-40px_#000] animate-scale-in focus:outline-none',
          width,
        )}
      >
        <div className="flex items-start justify-between gap-6 border-b border-border/60 px-6 py-5">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
            {description ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="关闭">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </Button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-raised/30 px-6 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

export function Menu({
  trigger,
  children,
  align = 'end',
  className,
}: {
  trigger: ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: 'start' | 'end'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={boxRef}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open ? (
        <div
          className={cn(
            'absolute z-40 mt-1.5 min-w-[168px] overflow-hidden rounded-lg border border-border/80 bg-panel p-1 shadow-[0_24px_60px_-24px_#000] animate-scale-in',
            align === 'end' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      ) : null}
    </div>
  )
}

export function MenuItem({
  children,
  onClick,
  danger,
  icon,
}: {
  children: ReactNode
  onClick?: () => void
  danger?: boolean
  icon?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors',
        danger
          ? 'text-destruct hover:bg-destruct/10'
          : 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

/* ---------------------------------- 杂项 ---------------------------------- */

export function Chip({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode
  tone?: 'default' | 'primary' | 'star' | 'muted' | 'green'
  className?: string
}) {
  const tones = {
    default: 'border-border/70 bg-raised/60 text-muted-foreground',
    primary: 'border-primary/30 bg-primary/10 text-primary',
    star: 'border-star/30 bg-star/10 text-star',
    muted: 'border-transparent bg-white/[0.04] text-muted-foreground/80',
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none tracking-wide',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('panel', className)}>{children}</div>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pb-2 pt-3">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
        {children}
      </span>
      {action}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-10 text-center',
        className,
      )}
    >
      {icon ? <div className="text-muted-foreground/40">{icon}</div> : null}
      <div>
        <p className="text-sm font-medium text-foreground/85">{title}</p>
        {hint ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground/70">{hint}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

/* ---------------------------------- Toast ---------------------------------- */

type ToastItem = { id: string; message: string; tone: 'default' | 'success' | 'error' }
type ToastFn = (message: string, tone?: ToastItem['tone']) => void

const ToastContext = createContext<ToastFn>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const push: ToastFn = (message, tone = 'default') => {
    const id = `t${counter.current++}`
    setItems((prev) => [...prev, { id, message, tone }])
    window.setTimeout(() => setItems((prev) => prev.filter((it) => it.id !== id)), 3200)
  }

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'animate-slide-in rounded-lg border px-4 py-2.5 text-[13px] shadow-[0_20px_50px_-20px_#000] backdrop-blur',
              item.tone === 'error'
                ? 'border-destruct/40 bg-destruct/15 text-destruct'
                : item.tone === 'success'
                  ? 'border-emerald-500/30 bg-emerald-950/80 text-emerald-300'
                  : 'border-border/80 bg-panel/95 text-foreground',
            )}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

/* ---------------------------------- Tabs ---------------------------------- */

export function Tabs<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: Array<{ value: T; label: string; icon?: ReactNode }>
  onChange: (value: T) => void
  className?: string
}) {
  const id = useId()
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg border border-border/60 bg-raised/30 p-1',
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-selected={value === opt.value}
          aria-controls={id}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
            value === opt.value
              ? 'bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  )
}
