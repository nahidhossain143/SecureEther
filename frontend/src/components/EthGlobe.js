import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Html } from "@react-three/drei";

export default function EthGlobe({ isFraud, probability }) {
  const meshRef = useRef();

  // Rotate the globe continuously
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (meshRef.current) {
        meshRef.current.rotation.y = t * 0.4;
        meshRef.current.rotation.x = t * 0.1;
    }
  });

  // Dynamic Colors
  const safeColor = "#00ff88"; // Neon Green
  const dangerColor = "#ff0055"; // Neon Red
  const activeColor = isFraud ? dangerColor : safeColor;

  return (
    <group>
        {/* The Core Sphere */}
        <Sphere ref={meshRef} args={[1.8, 64, 64]}>
            <MeshDistortMaterial
                color={activeColor}
                attach="material"
                distort={0.5} // Glitch effect
                speed={2}
                roughness={0.2}
                metalness={0.8}
                wireframe={true} // Cyberpunk wireframe look
            />
        </Sphere>
        
        {/* Inner Glow Light */}
        <pointLight position={[0, 0, 0]} intensity={3} color={activeColor} distance={5} />

        {/* Floating Label */}
        <Html position={[0, 2.5, 0]} center>
            <div style={{ 
                color: activeColor, 
                background: "rgba(0,0,0,0.8)", 
                padding: "5px 10px", 
                border: `1px solid ${activeColor}`,
                fontFamily: "Orbitron",
                fontSize: "12px"
            }}>
                RISK: {(probability * 100).toFixed(1)}%
            </div>
        </Html>
    </group>
  );
}