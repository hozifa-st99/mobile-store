"use client";

import { useEffect, useState } from "react";

type Star = {
  id: number;
  left: string;
  top: string;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
};

export default function BranchesSceneBackground() {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    setStars(
      Array.from({ length: 48 }, (_, index) => ({
        id: index,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() * 2 + 1,
        duration: Math.random() * 12 + 10,
        delay: Math.random() * 8,
        opacity: Math.random() * 0.45 + 0.15,
      }))
    );
  }, []);

  return (
    <div className="branches-scene__bg" aria-hidden>
      <div className="branches-scene__mesh" />
      <div className="branches-scene__grid" />
      <div className="branches-scene__beam" />
      <div className="branches-scene__orb branches-scene__orb--1" />
      <div className="branches-scene__orb branches-scene__orb--2" />
      <div className="branches-scene__orb branches-scene__orb--3" />

      <div className="branches-scene__hero-glyphs">
        <span className="branches-scene__hero-glyph branches-scene__hero-glyph--map">🗺️</span>
        <span className="branches-scene__hero-glyph branches-scene__hero-glyph--map-alt">🗺️</span>
      </div>

      <div className="branches-scene__stars">
        {stars.map((star) => (
          <div
            key={star.id}
            className="branches-scene__star"
            style={{
              left: star.left,
              top: star.top,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
              opacity: star.opacity,
            }}
          />
        ))}
      </div>
    </div>
  );
}
