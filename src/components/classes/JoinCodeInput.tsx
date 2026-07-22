import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { JOIN_CODE_LENGTH, normalizeJoinCode } from '@/lib/joinCode'
import { cn } from '@/lib/utils'

type JoinCodeInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  disabled?: boolean
  autoFocus?: boolean
  id?: string
  'aria-invalid'?: boolean
  className?: string
}

export function JoinCodeInput({
  value,
  onChange,
  onSubmit,
  disabled,
  autoFocus,
  id,
  'aria-invalid': ariaInvalid,
  className,
}: JoinCodeInputProps) {
  return (
    <InputOTP
      id={id}
      maxLength={JOIN_CODE_LENGTH}
      value={value}
      onChange={(next) => {
        onChange(normalizeJoinCode(next).slice(0, JOIN_CODE_LENGTH))
      }}
      onComplete={() => {
        onSubmit?.()
      }}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-invalid={ariaInvalid}
      containerClassName={cn('justify-center gap-2', className)}
      inputMode="text"
      autoCapitalize="characters"
      pattern="^[A-Za-z0-9]+$"
    >
      <InputOTPGroup aria-invalid={ariaInvalid}>
        <InputOTPSlot
          index={0}
          aria-invalid={ariaInvalid}
          className="font-mono"
        />
        <InputOTPSlot
          index={1}
          aria-invalid={ariaInvalid}
          className="font-mono"
        />
        <InputOTPSlot
          index={2}
          aria-invalid={ariaInvalid}
          className="font-mono"
        />
        <InputOTPSlot
          index={3}
          aria-invalid={ariaInvalid}
          className="font-mono"
        />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup aria-invalid={ariaInvalid}>
        <InputOTPSlot
          index={4}
          aria-invalid={ariaInvalid}
          className="font-mono"
        />
        <InputOTPSlot
          index={5}
          aria-invalid={ariaInvalid}
          className="font-mono"
        />
        <InputOTPSlot
          index={6}
          aria-invalid={ariaInvalid}
          className="font-mono"
        />
        <InputOTPSlot
          index={7}
          aria-invalid={ariaInvalid}
          className="font-mono"
        />
      </InputOTPGroup>
    </InputOTP>
  )
}
