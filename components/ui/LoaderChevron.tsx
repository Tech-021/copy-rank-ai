'use client';

import Image from 'next/image';

export function LoaderChevron() {
  return (
    <div className="flex items-center justify-center bg-transparent">
      <Image 
        src="/loader2.gif" 
        alt="Loading..." 
        width={93} 
        height={93}
        unoptimized
      />
    </div>
  );
}
