"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    // This page is a trigger for the modal. 
    // We append a query param to the current URL (or the home page) to show the modal.
    // The actual UI is handled by the root layout which includes the modal component.
    const currentPath = window.sessionStorage.getItem('currentPathForModal') || '/';
    router.replace(`${currentPath}?subscribe=true`);
    // Clean up the stored path
    window.sessionStorage.removeItem('currentPathForModal');
  }, [router]);

  return null; // This page doesn't render any UI itself
}
