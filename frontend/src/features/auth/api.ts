import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, http } from '@/services/http'
import type { Me } from '@/types/api'

export const sessionKey = ['auth', 'me'] as const

/** Sessão atual. null = não autenticado (401), sem tratar como erro. */
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async () => {
      try {
        return await http.get<Me>('/auth/me')
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    staleTime: 5 * 60_000,
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { email: string; password: string }) => http.post<Me>('/auth/login', body),
    onSuccess: (me) => queryClient.setQueryData(sessionKey, me),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => http.post<void>('/auth/logout'),
    onSettled: () => {
      queryClient.clear()
      queryClient.setQueryData(sessionKey, null)
    },
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (body: { email: string }) => http.post<void>('/auth/password/forgot', body),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { token: string; newPassword: string }) => http.post<void>('/auth/password/reset', body),
  })
}
