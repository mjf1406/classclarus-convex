import { useEffect, useState } from 'react'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FontAwesomeIconFromId } from '@/components/icons/FontAwesomeIconFromId'
import { FontAwesomeIconPickerLazy } from '@/components/icons/FontAwesomeIconPickerLazy'
import {
  iconDefinitionToId,
  resolveIconId,
} from '@/components/icons/fontawesome-icon-catalog'
import { Button } from '@/components/ui/button'
import { UsersRound } from 'lucide-react'

type IconFieldProps = {
  value: string | null
  onChange: (iconId: string | null) => void
  disabled?: boolean
}

export function GroupIconField({ value, onChange, disabled }: IconFieldProps) {
  const { t } = useTranslation('classes')
  const [definition, setDefinition] = useState<IconDefinition | null>(null)

  useEffect(() => {
    if (!value) {
      setDefinition(null)
      return
    }
    let cancelled = false
    void resolveIconId(value).then((resolved) => {
      if (!cancelled) setDefinition(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [value])

  return (
    <div className="flex items-center gap-2">
      <FontAwesomeIconPickerLazy
        value={definition}
        disabled={disabled}
        placeholder={t('pickIcon')}
        onChange={(icon) => {
          setDefinition(icon)
          onChange(iconDefinitionToId(icon))
        }}
      />
      {value ? (
        <div className="flex items-center gap-1 text-muted-foreground">
          <FontAwesomeIconFromId
            id={value}
            className="size-4"
            fallback={<UsersRound className="size-4" />}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={disabled}
            onClick={() => onChange(null)}
            aria-label={t('clearIcon')}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
