import * as React from 'react'
import { cn } from '@/lib/utils'

// Select nativo del navegador con el estilo de los inputs. Se prefiere al de
// Radix porque es accesible por defecto, cómodo en móvil y fácil de probar.
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30 [&>option]:bg-background',
        className,
      )}
      {...props}
    />
  )
}

export { NativeSelect }
