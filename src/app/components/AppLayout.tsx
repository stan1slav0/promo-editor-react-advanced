import type { PropsWithChildren } from 'react'
import { useLocation } from 'react-router-dom'
import { getBackgroundClass } from '../config'
import BackgroundCanvas from './BackgroundCanvas'

export function AppLayout({ children }: PropsWithChildren) {
  const location = useLocation()

  return (
    <div className={`main-wrapper ${getBackgroundClass(location.pathname)}`}>
      <div className="canvas-pattern">
        <BackgroundCanvas />
      </div>
      {children}
    </div>
  )
}
