interface ServerTimeResponse {
  utcDateTime: string
}

const resyncIntervalMs = 60_000
const clockTickMs = 1_000

export const useServerTime = async () => {
  const serverEpoch = useState<number | null>('server-time-epoch', () => null)
  const sampledClientEpoch = useState<number | null>('server-time-client-sample', () => null)
  const clientNow = ref(Date.now())
  let timer: number | undefined

  const { data } = await useFetch<ServerTimeResponse>('/api/time', {
    key: 'server-utc-time'
  })

  const applyServerTime = (utcDateTime: string) => {
    const parsedTime = Date.parse(utcDateTime)
    if (Number.isNaN(parsedTime)) return

    const now = Date.now()
    serverEpoch.value = parsedTime
    sampledClientEpoch.value = now
    clientNow.value = now
  }

  if (data.value && serverEpoch.value === null) applyServerTime(data.value.utcDateTime)

  const currentTime = computed(() => {
    if (serverEpoch.value === null || sampledClientEpoch.value === null) return clientNow.value
    return serverEpoch.value + (clientNow.value - sampledClientEpoch.value)
  })

  onMounted(() => {
    let resyncing = false
    let lastResync = Date.now()

    timer = window.setInterval(async () => {
      clientNow.value = Date.now()
      if (resyncing || clientNow.value - lastResync < resyncIntervalMs) return

      resyncing = true
      try {
        const response = await $fetch<ServerTimeResponse>('/api/time')
        applyServerTime(response.utcDateTime)
        lastResync = Date.now()
      } catch {
        lastResync = Date.now()
      } finally {
        resyncing = false
      }
    }, clockTickMs)

  })

  onUnmounted(() => {
    if (timer !== undefined) window.clearInterval(timer)
  })

  return { currentTime: readonly(currentTime) }
}
