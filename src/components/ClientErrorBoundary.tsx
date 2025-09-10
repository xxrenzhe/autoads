'use client';

import dynamic from "next/dynamic";

const ErrorBoundary = dynamic(() => import("@/components/ErrorBoundary"), { ssr: false });
interface ClientErrorBoundaryProps {
  children: React.ReactNode;
}

export default function ClientErrorBoundary({ children }: ClientErrorBoundaryProps) {
  return <ErrorBoundary context="client" showHomeButton={true}>{children}</ErrorBoundary>;
}