'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        `
        peer inline-flex
        h-[18px] w-[34px]
        shrink-0 items-center
        rounded-full

        border border-[#53F870]
        bg-[#020D05]

        data-[state=checked]:bg-[#020D05]
        data-[state=unchecked]:bg-[#020D05]

        transition-colors
        outline-none
        focus-visible:ring-0
        focus-visible:ring-offset-0

        disabled:cursor-not-allowed
        disabled:opacity-50
        `,
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className="
          pointer-events-none
          block h-[12px] w-[12px]
          rounded-full
          bg-[#53F870]

          translate-x-[3px]
          transition-transform

          data-[state=checked]:translate-x-[19px]
        "
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
