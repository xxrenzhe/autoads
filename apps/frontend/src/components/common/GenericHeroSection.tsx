type GenericHeroSectionProps = {
  title: string;
  subtitle: string;
};

export function GenericHeroSection({ title, subtitle }: GenericHeroSectionProps) {
  return (
    <section className="py-12 text-center bg-white sm:py-16 lg:py-20">
      <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="mt-6 text-xl text-gray-600">
          {subtitle}
        </p>
      </div>
    </section>
  );
}
