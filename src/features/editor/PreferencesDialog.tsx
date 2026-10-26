import { Check } from 'lucide-react'
import { Button, Dialog } from '@/components/ui'
import { usePrefs, type Locale, type ThemeMode } from '@/store/prefs'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * 首选项：只改编辑器自己的外观与语言，
 * 作品皮肤与玩家看到的文案在「项目设置」里，两者刻意分开。
 */
export function PreferencesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { prefs, setTheme, setLocale } = usePrefs()
  const { t } = useI18n()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('prefs.title')}
      description={t('prefs.description')}
      width="max-w-xl"
      footer={
        <Button variant="primary" onClick={onClose}>
          {t('common.done')}
        </Button>
      }
    >
      <div className="space-y-6">
        <section>
          <h3 className="section-label mb-2">{t('prefs.appearance')}</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <ThemeCard
              theme="dark"
              label={t('prefs.theme.dark')}
              hint={t('prefs.theme.darkHint')}
              active={prefs.theme === 'dark'}
              onSelect={() => setTheme('dark')}
            />
            <ThemeCard
              theme="light"
              label={t('prefs.theme.light')}
              hint={t('prefs.theme.lightHint')}
              active={prefs.theme === 'light'}
              onSelect={() => setTheme('light')}
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/60">
            {t('prefs.themeHint')}
          </p>
        </section>

        <section>
          <h3 className="section-label mb-2">{t('prefs.language')}</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {LOCALE_CHOICES.map((choice) => (
              <button
                key={choice.value}
                onClick={() => setLocale(choice.value)}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors',
                  prefs.locale === choice.value
                    ? 'border-primary/60 bg-primary/[0.08]'
                    : 'border-border/60 hover:border-border',
                )}
              >
                <span>
                  <span className="block text-[13px] font-medium">{choice.label}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground/50">
                    {choice.code}
                  </span>
                </span>
                {prefs.locale === choice.value ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : null}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-border/60 bg-raised/25 p-3">
            <span className="mt-[3px] shrink-0 rounded border border-border/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground/50">
              {t('prefs.language.preview')}
            </span>
            <p className="text-[12px] leading-relaxed text-foreground/80">
              {t('prefs.language.previewText')}
            </p>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/60">
            {t('prefs.languageHint')}
          </p>
        </section>
      </div>
    </Dialog>
  )
}

const LOCALE_CHOICES: Array<{ value: Locale; label: string; code: string }> = [
  { value: 'zh-CN', label: '简体中文', code: 'zh-CN' },
  { value: 'en', label: 'English', code: 'en' },
]

/** 主题缩略：只用色块暗示布局，不复制真实界面 */
function ThemeCard({
  theme,
  label,
  hint,
  active,
  onSelect,
}: {
  theme: ThemeMode
  label: string
  hint: string
  active: boolean
  onSelect: () => void
}) {
  const ink = theme === 'dark' ? 'rgba(255,255,255,' : 'rgba(17,15,32,'
  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'group overflow-hidden rounded-lg border text-left transition-all',
        active ? 'border-primary/70 bg-primary/[0.07]' : 'border-border/60 hover:border-border',
      )}
    >
      <div
        className="relative h-[88px] w-full overflow-hidden"
        style={{ background: theme === 'dark' ? '#09080f' : '#f7f6fd' }}
      >
        <div
          className="absolute inset-x-0 top-0 h-5"
          style={{ background: theme === 'dark' ? '#14121f' : '#ffffff' }}
        />
        <div
          className="absolute left-0 top-5 h-full w-9"
          style={{ background: theme === 'dark' ? '#0e0c17' : '#f1effa' }}
        />
        <div className="absolute left-12 top-9 space-y-1.5">
          {[64, 96, 78].map((w) => (
            <span
              key={w}
              className="block h-[4px] rounded-full"
              style={{ width: w, background: `${ink}0.22)` }}
            />
          ))}
          <span
            className="mt-2 block h-[10px] w-16 rounded"
            style={{ background: theme === 'dark' ? '#9d8cff' : '#6b4cf0' }}
          />
        </div>
        <span
          className="absolute right-3 top-[30px] h-9 w-16 rounded"
          style={{
            background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(17,15,32,0.04)',
          }}
        />
      </div>
      <div className="px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium">
          {label}
          {active ? <Check className="h-3 w-3 text-primary" /> : null}
        </p>
        <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground/60">{hint}</p>
      </div>
    </button>
  )
}
