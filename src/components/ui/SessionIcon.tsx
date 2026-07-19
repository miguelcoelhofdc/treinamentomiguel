import {
  Barbell,
  MoonStars,
  PersonSimple,
  PersonSimpleRun,
  Pulse,
  type IconProps,
} from '@phosphor-icons/react'

interface SessionIconProps extends IconProps {
  type: string
}

export default function SessionIcon({ type, ...props }: SessionIconProps) {
  if (type.startsWith('forca')) return <Barbell {...props} />
  if (type === 'calistenia') return <PersonSimple {...props} />
  if (type === 'qualidade' || type === 'longa' || type === 'corrida') return <PersonSimpleRun {...props} />
  if (type === 'descanso') return <MoonStars {...props} />
  return <Pulse {...props} />
}
