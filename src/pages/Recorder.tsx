import PageHeader from '@/components/ui/PageHeader'
import { useTracking } from '@/hooks/useTracking'
import DailyRegisterGrid from '@/components/tracking/DailyRegisterGrid'
import { TrackingError, TrackingLoading } from '@/components/tracking/TrackingState'

export default function Recorder() {
  const data = useTracking()
  const ready = data.loaded && !data.error

  return (
    <main className={`page-content tracking-entry page-enter${ready ? ' is-daily-grid' : ''}`}>
      <PageHeader
        title="Registrar"
        description="Registre hábitos dia a dia com carinhas."
      />
      {!data.loaded ? <TrackingLoading /> : data.error ? <TrackingError retry={data.retry} /> : (
        <DailyRegisterGrid data={data} />
      )}
    </main>
  )
}
