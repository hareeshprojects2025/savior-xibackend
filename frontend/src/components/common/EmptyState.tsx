import type { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  footnote?: string
}

export function EmptyState({ icon: Icon, title, description, footnote }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <div className="size-16 rounded-2xl bg-muted-bg flex items-center justify-center mb-4">
        <Icon className="size-7 text-muted" />
      </div>
      <h3 className="text-base font-semibold text-text">{title}</h3>
      <p className="text-sm text-text-secondary mt-1 text-center max-w-xs">{description}</p>
      {footnote && (
        <p className="text-xs text-text-muted mt-4 text-center">{footnote}</p>
      )}
    </div>
  )
}
