import { useState } from 'react'

/**
 * LazyImage — image component with native lazy loading, skeleton shimmer placeholder,
 * and error fallback.
 */
export default function LazyImage({
  src,
  alt = 'Image',
  className = '',
  skeletonClassName = '',
  fallbackSrc = '/guns/pistol.svg',
  onClick,
  ...props
}) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const effectiveSrc = error ? fallbackSrc : src || fallbackSrc

  return (
    <div
      className={`lazy-img-wrapper relative overflow-hidden ${className}`}
      onClick={onClick}
      style={{ position: 'relative' }}
    >
      {/* Shimmer / Skeleton Placeholder */}
      {!loaded && !error && (
        <div
          className={`skeleton-shimmer absolute inset-0 ${skeletonClassName}`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, #1f242d 25%, #2a313d 50%, #1f242d 75%)',
            backgroundSize: '200% 100%',
            animation: 'skeleton-pulse 1.5s infinite',
            zIndex: 1,
          }}
        />
      )}

      {/* Image with native lazy loading */}
      <img
        src={effectiveSrc}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setError(true)
          setLoaded(true)
        }}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
        }}
        {...props}
      />
    </div>
  )
}
