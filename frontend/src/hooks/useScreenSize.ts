'use client'
import { useEffect, useState } from 'react'

interface ScreenSize {
  width:    number
  height:   number
  isMobile: boolean   // < 640px
  isTablet: boolean   // 640–1023px
  isSmall:  boolean   // < 1024px (mobile OR tablet)
}

const DEFAULT: ScreenSize = { width: 1200, height: 900, isMobile: false, isTablet: false, isSmall: false }

export function useScreenSize(): ScreenSize {
  const [size, setSize] = useState<ScreenSize>(DEFAULT)

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      setSize({
        width:    w,
        height:   h,
        isMobile: w < 640,
        isTablet: w >= 640 && w < 1024,
        isSmall:  w < 1024,
      })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return size
}
