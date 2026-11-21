import PageHeader from '@/components/ui/PageHeader'
import { useTracking } from '@/hooks/useTracking'
import DailyRegisterGrid from '@/components/tracking/DailyRegisterGrid'
import { TrackingError, TrackingLoading } from '@/components/tracking/TrackingState'

export default function Recorder() {
  const data = useTracking()
  return (
    <main className="page-content dashboard-page page-enter">
      <PageHeader
        title="Registrar"
        description="Escolha um dia e avalie seus hábitos."
      />
      {!data.loaded ? <TrackingLoading /> : data.error ? <TrackingError retry={data.retry} /> : (
        <DailyRegisterGrid data={data} />
      )}
    </main>
  )
}
