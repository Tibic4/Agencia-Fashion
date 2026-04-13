"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ChevronsLeftRight } from "lucide-react";

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
}

export default function BeforeAfterSlider({ beforeImage, afterImage }: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - left, width));
    const percent = Math.max(0, Math.min((x / width) * 100, 100));
    setSliderPosition(percent);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchend", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-[4/5] sm:aspect-[3/4] max-w-md mx-auto rounded-2xl overflow-hidden cursor-ew-resize select-none shadow-2xl glass"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onMouseDown={(e) => {
        setIsDragging(true);
        handleMove(e.clientX);
      }}
      onTouchStart={(e) => {
        setIsDragging(true);
        handleMove(e.touches[0].clientX);
      }}
    >
      {/* After Image (Renderizada) */}
      <div className="absolute inset-0 w-full h-full bg-surface">
        {afterImage ? (
          <Image src={afterImage} alt="Resultado IA" fill sizes="(max-width: 768px) 100vw, 448px" className="object-cover" priority />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-brand-100 text-brand-700">Resultado 3D</div>
        )}
      </div>

      {/* Before Image (Manequim) - Clip path applied dynamically */}
      <div 
        className="absolute inset-0 w-full h-full bg-gray-100"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        {beforeImage ? (
          <Image src={beforeImage} alt="Foto Original" fill sizes="(max-width: 768px) 100vw, 448px" className="object-cover" priority />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500">Manequim</div>
        )}
        <div className="absolute inset-0 bg-black/5" /> {/* subtle overlay on before image */}
      </div>

      {/* Slider Line & Thumb */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)]"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-[0_4px_10px_rgba(0,0,0,0.3)] border border-gray-200">
          <ChevronsLeftRight className="w-5 h-5 text-gray-700" />
        </div>
      </div>
      
      {/* Labels */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full z-10" style={{ opacity: sliderPosition > 20 ? 1 : 0, transition: 'opacity 0.2s' }}>
        Sua Foto
      </div>
      <div className="absolute top-4 right-4 bg-brand-600/90 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(217,70,239,0.5)] z-10" style={{ opacity: sliderPosition < 80 ? 1 : 0, transition: 'opacity 0.2s' }}>
        Nossa IA
      </div>
    </div>
  );
}
