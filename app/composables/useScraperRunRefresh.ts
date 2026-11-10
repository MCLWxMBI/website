export function useScraperRunRefresh(refresh: () => Promise<unknown>, enabled: () => boolean) {
  let timer: ReturnType<typeof setInterval> | undefined
  let refreshing = false
  async function tick() {
    if (refreshing || document.visibilityState !== 'visible' || !enabled()) return
    refreshing = true
    try { await refresh() } catch { /* The view retains the last successful data and exposes retry. */ }
    finally { refreshing = false }
  }
  onMounted(() => {
    timer = setInterval(tick, 15_000)
    document.addEventListener('visibilitychange', tick)
  })
  onBeforeUnmount(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', tick)
  })
}
