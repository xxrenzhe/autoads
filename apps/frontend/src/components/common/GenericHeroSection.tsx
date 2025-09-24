import type { ReactNode } from 'react'

type GenericHeroSectionProps = {
  title: string
  subtitle?: string
  description?: string
  className?: string
  titleClassName?: string
  descriptionClassName?: string
  titleTag?: keyof JSX.IntrinsicElements
  children?: ReactNode
}

export function GenericHeroSection({
  title,
  subtitle,
  description,
  className,
  titleClassName,
  descriptionClassName,
  titleTag = 'h1',
  children,
}: GenericHeroSectionProps) {
  const TitleTag = titleTag as any
  return (
    <section className={`py-12 text-center bg-white sm:py-16 lg:py-20 ${className || ''}`}>
      <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <TitleTag className={titleClassName || 'text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl'}>
          {title}
        </TitleTag>
        {(description || subtitle) && (
          <p className={descriptionClassName || 'mt-6 text-xl text-gray-600'}>
            {description || subtitle}
          </p>
        )}
        {children}
      </div>
    </section>
  )
}
