import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Html } from "@react-three/drei";

export default function EthGlobe({ isFraud, probability = 0 }) {
  const meshRef  = useRef();
  const lightRef = useRef();

  const safeColor   = "#00ff88";
  const dangerColor = "#ff0055";
  const idleColor   = "#1a4a6b";
  
  // Color: red if fraud, green if safe, blue if no scan yet
  const activeColor = probability === 0
    ? idleColor
    : isFraud ? dangerColor : safeColor;

  // UPGRADE: distortion scales with risk probability (more distorted = more suspicious)
  const distortAmount = 0.15 + probability * 0.65;

  // UPGRADE: rotation speed scales with probability
  const rotSpeed = 0.3 + probability * 0.5;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = t * rotSpeed;
      meshRef.current.rotation.x = t * 0.1;
    }

    // UPGRADE: Pulse the point light intensity when fraud is detected
    if (lightRef.current) {
      if (isFraud) {
        // Rapid pulse on fraud
        lightRef.current.intensity = 2.5 + Math.sin(t * 6) * 1.5;
      } else if (probability > 0) {
        // Gentle glow for safe
        lightRef.current.intensity = 2.5 + Math.sin(t * 1.5) * 0.5;
      } else {
        // Idle — slow ambient breathe
        lightRef.current.intensity = 1 + Math.sin(t * 0.8) * 0.4;
      }
    }
  });

  const riskLabel = probability === 0
    ? "AWAITING SCAN"
    : `RISK: ${(probability * 100).toFixed(1)}%`;

  return (
    <group>
      {/* Core Sphere */}
      <Sphere ref={meshRef} args={[1.8, 64, 64]}>
        <MeshDistortMaterial
          color={activeColor}
          attach="material"
          distort={distortAmount}
          speed={isFraud ? 4 : 2}
          roughness={0.15}
          metalness={0.9}
          wireframe={true}
        />
      </Sphere>

      {/* Inner Glow — pulsing on fraud */}
      <pointLight
        ref={lightRef}
        position={[0, 0, 0]}
        intensity={1.5}
        color={activeColor}
        distance={6}
      />

      {/* Outer ambient fill */}
      <pointLight
        position={[3, 3, 3]}
        intensity={0.4}
        color={activeColor}
        distance={10}
      />

      {/* Floating HUD Label */}
      <Html position={[0, 2.5, 0]} center>
        <div style={{
          color: activeColor,
          background: "rgba(0,0,0,0.85)",
          padding: "5px 12px",
          border: `1px solid ${activeColor}`,
          fontFamily: "Orbitron, monospace",
          fontSize: "11px",
          letterSpacing: "1px",
          whiteSpace: "nowrap",
          // UPGRADE: glow shadow matches state color
          boxShadow: `0 0 8px ${activeColor}44`,
          transition: "all 0.5s ease"
        }}>
          {riskLabel}
        </div>
      </Html>

      {/* UPGRADE: Second label showing FRAUD/SAFE status below */}
      {probability > 0 && (
        <Html position={[0, -2.5, 0]} center>
          <div style={{
            color: activeColor,
            background: "rgba(0,0,0,0.85)",
            padding: "4px 10px",
            border: `1px solid ${activeColor}55`,
            fontFamily: "Orbitron, monospace",
            fontSize: "10px",
            letterSpacing: "2px",
            opacity: 0.9
          }}>
            {isFraud ? "⚠ FRAUD" : "✓ SAFE"}
          </div>
        </Html>
      )}
    </group>
  );
}