import { ChevronDown } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

// Select nativo del navegador con el estilo de los inputs. Se prefiere al de
// Radix porque es accesible por defecto, cómodo en móvil y fácil de probar.
//
// La flecha que dibuja el navegador queda pegada al borde y no obedece al
// `padding`. Por eso se oculta (`appearance-none`) y se dibuja la nuestra, con
// su propio margen. El `<select>` real sigue siendo el que recibe el foco y el
// teclado; la flecha es solo decoración (`pointer-events-none`).
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative w-full" data-slot="native-select-wrapper">
      <select
        data-slot="native-select"
        className={cn(
          // pr-8: deja sitio a la flecha para que el texto largo no la pise.
          'peer h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30 [&>option]:bg-background',
          className,
        )}
        {...props}
      />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground peer-disabled:opacity-50"
      />
    </div>
  )
}

export { NativeSelect }
