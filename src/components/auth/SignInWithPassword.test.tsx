// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import i18n from 'i18next'
import en from '@/i18n/resources/en'
import { SignInWithPassword } from './SignInWithPassword'

const signIn = vi.fn()

vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({ signIn }),
}))

async function setupI18n() {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      resources: {
        en: {
          auth: en.auth,
          common: en.common,
        },
      },
      ns: ['auth', 'common'],
      defaultNS: 'auth',
      interpolation: { escapeValue: false },
    })
  } else {
    await i18n.changeLanguage('en')
  }
}

function renderForm(termsAccepted = true) {
  return render(
    <I18nextProvider i18n={i18n}>
      <SignInWithPassword termsAccepted={termsAccepted} redirectTo="/home" />
    </I18nextProvider>,
  )
}

describe('SignInWithPassword', () => {
  beforeEach(async () => {
    signIn.mockReset()
    signIn.mockResolvedValue(undefined)
    await setupI18n()
  })

  afterEach(() => {
    cleanup()
  })

  it('blocks submit when terms are not accepted', () => {
    renderForm(false)
    const button = screen.getByRole('button', {
      name: en.auth.signInWithPassword,
    })
    expect(button).toHaveProperty('disabled', true)
  })

  it('shows validation errors for invalid email', async () => {
    renderForm(true)
    fireEvent.change(screen.getByLabelText(en.auth.emailLabel), {
      target: { value: 'bad' },
    })
    fireEvent.change(screen.getByLabelText(en.auth.passwordLabel), {
      target: { value: 'secret123' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: en.auth.signInWithPassword }),
    )
    expect(await screen.findByText(en.auth.invalidEmail)).toBeTruthy()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('calls signIn with password flow and form data', async () => {
    renderForm(true)
    fireEvent.change(screen.getByLabelText(en.auth.emailLabel), {
      target: { value: ' teacher@school.edu ' },
    })
    fireEvent.change(screen.getByLabelText(en.auth.passwordLabel), {
      target: { value: 'secret123' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: en.auth.signInWithPassword }),
    )

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1))
    expect(signIn.mock.calls.length).toBeGreaterThan(0)
    const [provider, payload] = signIn.mock.calls[0] ?? []
    expect(provider).toBe('password')
    expect(payload).toBeInstanceOf(FormData)
    if (!(payload instanceof FormData)) throw new Error('expected FormData')
    expect(payload.get('email')).toBe('teacher@school.edu')
    expect(payload.get('password')).toBe('secret123')
    expect(payload.get('flow')).toBe('signIn')
  })

  it('switches to sign-up and sends signUp flow', async () => {
    renderForm(true)
    fireEvent.click(screen.getByRole('button', { name: en.auth.signUpInstead }))
    fireEvent.change(screen.getByLabelText(en.auth.emailLabel), {
      target: { value: 'new@school.edu' },
    })
    fireEvent.change(screen.getByLabelText(en.auth.passwordLabel), {
      target: { value: 'secret123' },
    })
    fireEvent.change(screen.getByLabelText(en.auth.confirmPasswordLabel), {
      target: { value: 'secret123' },
    })
    fireEvent.change(screen.getByLabelText(en.auth.nameLabel), {
      target: { value: 'Ada' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: en.auth.signUpWithPassword }),
    )

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1))
    const payload = signIn.mock.calls[0]?.[1]
    expect(payload).toBeInstanceOf(FormData)
    if (!(payload instanceof FormData)) throw new Error('expected FormData')
    expect(payload.get('flow')).toBe('signUp')
    expect(payload.get('name')).toBe('Ada')
  })

  it('shows authFailed when signIn rejects', async () => {
    signIn.mockRejectedValueOnce(new Error('nope'))
    renderForm(true)
    fireEvent.change(screen.getByLabelText(en.auth.emailLabel), {
      target: { value: 'teacher@school.edu' },
    })
    fireEvent.change(screen.getByLabelText(en.auth.passwordLabel), {
      target: { value: 'secret123' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: en.auth.signInWithPassword }),
    )
    expect(await screen.findByText(en.auth.authFailed)).toBeTruthy()
  })
})
