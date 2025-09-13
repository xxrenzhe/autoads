"use client";

import { Suspense, lazy, useEffect, useState } from "react";

// 懒加载的语言切换器
export const LazyLanguageSwitcher = lazy(() =>
  import("./LanguageSwitcher").then((module) => ({ default: module.default })),
);

// 懒加载的Google Analytics
export const LazyGoogleAnalytics = lazy(() =>
  import("./GoogleAnalytics").then((module) => ({ default: module.default })),
);

// 通用懒加载包装器
interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  delay?: number;
}

export function LazyWrapper({
  children,
  fallback = null,
  delay = 0,
}: .*Props) {
  return (
    <Suspense fallback={fallback}>
      {delay > 0 ? (
        <DelayedRender delay={delay}>{children}</DelayedRender>
      ) : (
        children
      )}
    </Suspense>
  );
}

// 延迟渲染组件
interface DelayedRenderProps {
  children: React.ReactNode;
  delay: number;
}

function DelayedRender({ children, delay }: .*Props) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldRender(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);
  
  return shouldRender ? <>{children}</> : null;
}

// 视口内懒加载组件
interface InViewLazyProps {
  children: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
  fallback?: React.ReactNode;
}

export function InViewLazy({
  children,
  threshold = 0.1,
  rootMargin = "50px",
  fallback = null,
}: .*Props) {
  const [isInView, setIsInView] = useState(false);
  const [ref, setRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) => {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin,
      },
    );

    observer.observe(ref);

    return () => observer.disconnect();
  }, [ref, fallback, children]);
  
  return <div ref={setRef}>{isInView ? children : fallback}</div>;
}
