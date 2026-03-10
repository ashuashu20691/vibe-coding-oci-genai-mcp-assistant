import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-accent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-sm",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
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
  ({ className, variant, size, asChild = false, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const buttonRef = React.useRef<HTMLButtonElement>(null)
    
    // Merge refs
    React.useImperativeHandle(ref, () => buttonRef.current as HTMLButtonElement)
    
    const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
      const button = buttonRef.current
      if (!button) return
      
      const circle = document.createElement("span")
      const diameter = Math.max(button.clientWidth, button.clientHeight)
      const radius = diameter / 2
      
      const rect = button.getBoundingClientRect()
      circle.style.width = circle.style.height = `${diameter}px`
      circle.style.left = `${event.clientX - rect.left - radius}px`
      circle.style.top = `${event.clientY - rect.top - radius}px`
      circle.classList.add("ripple")
      
      const ripple = button.getElementsByClassName("ripple")[0]
      if (ripple) {
        ripple.remove()
      }
      
      button.appendChild(circle)
      
      // Remove ripple after animation
      setTimeout(() => {
        circle.remove()
      }, 600)
    }
    
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      createRipple(event)
      onClick?.(event)
    }
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={buttonRef}
        onClick={handleClick}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
