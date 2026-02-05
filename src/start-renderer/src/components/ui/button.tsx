import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-px",
        destructive:
          "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 hover:shadow-[0_0_15px_-3px_hsl(var(--destructive)/0.3)]",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-white/5 backdrop-blur-md border border-white/10 text-foreground shadow-sm hover:bg-white/10 hover:border-white/20 hover:shadow-md hover:-translate-y-px",
        ghost:
          "hover:bg-foreground/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        shiny:
          "relative overflow-hidden bg-primary text-primary-foreground border border-primary-foreground/20 shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)] hover:shadow-[0_8px_25px_-5px_hsl(var(--primary)/0.5)] hover:-translate-y-px hover:brightness-110 active:translate-y-0 active:shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.3)] font-bold tracking-wide",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
