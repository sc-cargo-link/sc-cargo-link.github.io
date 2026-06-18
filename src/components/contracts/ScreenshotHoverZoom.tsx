import { useState } from "react";

interface ScreenshotHoverZoomProps {
  src: string;
  alt: string;
  zoom?: number;
}

export function ScreenshotHoverZoom({ src, alt, zoom = 2 }: ScreenshotHoverZoomProps) {
  const [active, setActive] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setOrigin({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <div
      className="w-full overflow-hidden rounded-md border border-border bg-black/30 p-2 cursor-crosshair"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onMouseMove={handleMove}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="block h-auto w-full object-contain will-change-transform"
        style={{
          transform: active ? `scale(${zoom})` : "scale(1)",
          transformOrigin: `${origin.x}% ${origin.y}%`,
          transition: active ? "none" : "transform 0.2s ease-out",
        }}
      />
    </div>
  );
}
