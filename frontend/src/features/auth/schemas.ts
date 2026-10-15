import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail').email('Digite um e-mail válido'),
  password: z.string().min(1, 'Informe sua senha'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const forgotSchema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail').email('Digite um e-mail válido'),
})
export type ForgotValues = z.infer<typeof forgotSchema>

export const resetSchema = z
  .object({
    newPassword: z
      .string()
      .min(10, 'Use pelo menos 10 caracteres')
      .max(128, 'Use no máximo 128 caracteres')
      .regex(/[A-Za-z]/, 'Inclua pelo menos uma letra')
      .regex(/\d/, 'Inclua pelo menos um número'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { message: 'As senhas não conferem', path: ['confirm'] })
export type ResetValues = z.infer<typeof resetSchema>
