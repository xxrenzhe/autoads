"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import React from "react";

export interface Step {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  content?: React.ReactNode;
}

export interface GenericStepsSectionProps {
  title: string;
  subtitle?: string;
  steps: Step[];
  className?: string;
  colorTheme?: "blue" | "green" | "purple" | "orange";
  layout?: "horizontal" | "vertical";
  showStepNumbers?: boolean;
}

const colorThemes = {
  blue: {
    from: "from-blue-500",
    to: "to-blue-600",
    icon: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  green: {
    from: "from-green-500",
    to: "to-green-600",
    icon: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  purple: {
    from: "from-purple-500",
    to: "to-purple-600",
    icon: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
  orange: {
    from: "from-orange-500",
    to: "to-orange-600",
    icon: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
  },
};

const GenericStepsSection = ({
  title,
  subtitle,
  steps,
  className = "py-8 bg-gradient-to-br from-green-50 via-white to-blue-50",
  colorTheme = "blue",
  layout = "horizontal",
  showStepNumbers = true,
}: GenericStepsSectionProps) => {
  const theme = colorThemes[colorTheme];
  const isHorizontal = layout === "horizontal";

  return (
    <section className={className}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
            {title}
          </h2>
          {subtitle && (
            <p className="text-base md:text-lg text-slate-600 max-w-4xl mx-auto">
              {subtitle}
            </p>
          )}
        </div>
        
        <div className={`max-w-6xl mx-auto grid ${
          isHorizontal ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"
        } gap-6`}>
          {steps.map((step) => (
            <Card
              key={step.number}
              className="w-full p-4 hover:shadow-md transition-all duration-300 border-0 bg-white/95 backdrop-blur-sm hover:scale-[1.02]"
            >
              <CardHeader className="text-center pb-3">
                <div className="flex items-center justify-center gap-2 mb-2">
                  {showStepNumbers && (
                    <div className={`w-10 h-10 bg-gradient-to-br ${theme.from} ${theme.to} rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                      {step.number}
                    </div>
                  )}
                  <div className={theme.icon}>
                    {step.icon && typeof step.icon === 'object' && 'type' in step.icon &&
                      React.cloneElement(step.icon as React.ReactElement, { className: "w-6 h-6" } as React.HTMLAttributes<HTMLSpanElement>)}
                  </div>
                </div>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  {step.title}
                </CardTitle>
                <CardDescription className="text-slate-600 text-sm">
                  {step.description}
                </CardDescription>
              </CardHeader>
              {step.content && (
                <CardContent className="pt-2">
                  <div className="flex flex-col gap-2">{step.content}</div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GenericStepsSection;