import React from 'react';

/**
 * Meet renders these routes inside a narrow side panel iframe or a main stage
 * tile, so they get their own chrome-free shell. The Navbar hides itself on
 * /meet paths.
 */
export default function MeetLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex flex-col min-h-0 w-full">{children}</div>;
}
