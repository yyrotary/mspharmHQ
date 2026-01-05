'use client';

import BackButton from './BackButton';

interface PageHeaderProps {
  title: string;
  showBackButton?: boolean;
  backHref?: string;
  rightElement?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  showBackButton = true,
  backHref,
  rightElement,
  className = ''
}: PageHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-6 ${className}`}>
      {showBackButton ? (
        <BackButton href={backHref} />
      ) : (
        <div className="w-16"></div>
      )}
      
      <h1 className="text-lg font-semibold text-gray-900 text-center flex-1">
        {title}
      </h1>
      
      <div className="w-16 flex justify-end">
        {rightElement}
      </div>
    </div>
  );
}
