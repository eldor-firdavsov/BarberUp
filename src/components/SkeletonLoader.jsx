import React from 'react';

const SkeletonLoader = ({ count = 6, type = 'card' }) => {
  return (
    <>
      <style>
        {`
          @keyframes skeleton-shimmer {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }
          .skeleton-shimmer {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0) 0%,
              rgba(243, 244, 246, 0.6) 50%,
              rgba(255, 255, 255, 0) 100%
            );
            animation: skeleton-shimmer 1.5s infinite ease-in-out;
            transform: translateX(-100%);
          }
        `}
      </style>
      
      {type === 'card' ? (
        <div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          aria-hidden="true"
        >
          {Array.from({ length: count }).map((_, index) => (
            <div key={index} className="flex flex-col gap-4">
              <div className="relative w-full aspect-[4/3] bg-gray-200 rounded-lg overflow-hidden">
                <div className="skeleton-shimmer" />
              </div>
              <div className="flex flex-col gap-3">
                <div className="relative h-6 w-3/4 bg-gray-200 rounded-lg overflow-hidden">
                  <div className="skeleton-shimmer" />
                </div>
                <div className="relative h-4 w-1/3 bg-gray-200 rounded-lg overflow-hidden">
                  <div className="skeleton-shimmer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div 
          className="flex flex-col gap-3"
          aria-hidden="true"
        >
          {Array.from({ length: count }).map((_, index) => (
            <div key={index} className="relative bg-white border border-gray-100 rounded-[24px] p-5 flex items-center gap-3.5 shadow-sm overflow-hidden">
              <div className="relative w-12 h-12 rounded-2xl bg-gray-200 overflow-hidden shrink-0">
                <div className="skeleton-shimmer" />
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <div className="relative h-4 w-1/2 bg-gray-200 rounded-md overflow-hidden">
                  <div className="skeleton-shimmer" />
                </div>
                <div className="relative h-3 w-1/3 bg-gray-200 rounded-md overflow-hidden">
                  <div className="skeleton-shimmer" />
                </div>
              </div>
              <div className="relative w-8 h-8 rounded-xl bg-gray-200 overflow-hidden shrink-0">
                 <div className="skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default SkeletonLoader;
