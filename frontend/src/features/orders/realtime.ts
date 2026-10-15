import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { create } from 'zustand'
import { toast } from 'sonner'

export type RealtimeStatus = 'connecting' | 'live' | 'offline'

interface RealtimeState {
  status: RealtimeStatus
  soundEnabled: boolean
  setStatus: (s: RealtimeStatus) => void
  setSoundEnabled: (v: boolean) => void
}

const SOUND_KEY = 'onecore.sound'

function readSound() {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

/** Estado global da conexão em tempo real e da preferência de som (por aparelho). */
export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: 'connecting',
  soundEnabled: readSound(),
  setStatus: (status) => set({ status }),
  setSoundEnabled: (soundEnabled) => {
    try {
      localStorage.setItem(SOUND_KEY, soundEnabled ? 'on' : 'off')
    } catch {
      // armazenamento indisponível: vale só para esta aba
    }
    set({ soundEnabled })
  },
}))

let audio: AudioContext | null = null

/** Libera o áudio a partir de um gesto do usuário (exigência dos navegadores). */
export function unlockAudio() {
  try {
    audio ??= new AudioContext()
    void audio.resume()
  } catch {
    // navegador sem Web Audio
  }
}

/** Alerta curto em dois tons. "urgent" (chamado de mesa) usa tons mais agudos. */
export function playAlert(urgent = false) {
  if (!useRealtimeStore.getState().soundEnabled) return
  try {
    audio ??= new AudioContext()
    const now = audio.currentTime
    const tones = urgent ? [988, 1319] : [784, 1047]
    tones.forEach((freq, i) => {
      const osc = audio!.createOscillator()
      const gain = audio!.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = now + i * 0.18
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
      osc.connect(gain).connect(audio!.destination)
      osc.start(start)
      osc.stop(start + 0.18)
    })
  } catch {
    // sem áudio disponível
  }
}

interface EventData {
  type: string
  number?: number
  tableLabel?: string
  status?: string
  requestType?: string
}

/**
 * Conecta ao fluxo de eventos do restaurante (SSE). O EventSource reconecta sozinho; a cada (re)conexão o painel
 * recarrega os dados pela API, então nada se perde em quedas de internet. Os eventos só avisam que algo mudou.
 */
export function useRealtime(enabled: boolean) {
  const queryClient = useQueryClient()
  const setStatus = useRealtimeStore((s) => s.setStatus)

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return
    const source = new EventSource('/api/restaurant/events', { withCredentials: true })
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    // Vários eventos em sequência viram uma única recarga.
    const refresh = () => {
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => queryClient.invalidateQueries({ queryKey: ['restaurant'] }), 150)
    }
    const parse = (e: MessageEvent): EventData | null => {
      try {
        return JSON.parse(e.data) as EventData
      } catch {
        return null
      }
    }

    source.addEventListener('ready', () => {
      setStatus('live')
      refresh()
    })
    source.addEventListener('order.created', (e) => {
      const data = parse(e as MessageEvent)
      refresh()
      playAlert()
      if (data) toast(`Novo pedido #${String(data.number).padStart(4, '0')}`, { description: `Mesa ${data.tableLabel}` })
    })
    source.addEventListener('order.updated', refresh)
    source.addEventListener('table.updated', refresh)
    source.addEventListener('request.resolved', refresh)
    source.addEventListener('request.created', (e) => {
      const data = parse(e as MessageEvent)
      refresh()
      playAlert(true)
      if (data) toast(`Mesa ${data.tableLabel}`, { description: data.requestType === 'REQUEST_BILL' ? 'Pediu a conta' : 'Chamou o garçom' })
    })
    source.onerror = () => setStatus(source.readyState === EventSource.CLOSED ? 'offline' : 'connecting')

    return () => {
      clearTimeout(refreshTimer)
      source.close()
      setStatus('connecting')
    }
  }, [enabled, queryClient, setStatus])
}
