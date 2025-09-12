"use client";

interface GenericHeroSectionProps {
  title: string | React.ReactNode;
  description: string;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  children?: React.ReactNode;
  titleTag?: "h1" | "h2" | "h3";
}

const GenericHeroSection = ({ 
  title, 
  description, 
  children,
  className = "py-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50",
  titleClassName = "text-3xl font-bold text-gray-900 mb-4",
  descriptionClassName = "text-lg text-gray-600 max-w-3xl mx-auto",
  titleTag = "h2"
}: GenericHeroSectionProps) => {
  const TitleTag = titleTag;
  
  return (
    <section className={className}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <TitleTag className={titleClassName}>
            {title}
          </TitleTag>
          <p className={descriptionClassName}>
            {description}
          </p>
        </div>
        {children && (
          <div className="mt-8">
            {children}
          </div>
        )}
      </div>
    </section>
  );
};

export default GenericHeroSection;