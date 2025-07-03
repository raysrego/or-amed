import React from 'react';

interface AdminRouteProps {
  children: React.ReactNode;
}

// AdminRoute component is now just a passthrough since all users have access
export default function AdminRoute({ children }: AdminRouteProps) {
  return <>{children}</>;
}