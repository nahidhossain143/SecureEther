import React, { useRef, useEffect } from "react";
import * as THREE from "three";

const NODE_COUNT    = 22;
const EDGE_COUNT    = 32;
const SPHERE_RADIUS = 2.8;

function buildGraph() {
  const nodes = Array.from({ length: NODE_COUNT }, (_, i) => {
    const phi   = Math.acos(1 - (2 * (i + 0.5)) / NODE_COUNT);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const r     = SPHERE_RADIUS * (0.55 + Math.random() * 0.45);
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );
  });

  const edgeSet = new Set();
  const edges   = [];
  for (let i = 0; i < NODE_COUNT - 1; i++) {
    edgeSet.add(`${i}-${i + 1}`);
    edges.push([i, i + 1]);
  }
  let tries = 0;
  while (edges.length < EDGE_COUNT && tries++ < 1000) {
    const a = Math.floor(Math.random() * NODE_COUNT);
    const b = Math.floor(Math.random() * NODE_COUNT);
    if (a === b) continue;
    const k = `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (edgeSet.has(k)) continue;
    edgeSet.add(k);
    edges.push([a, b]);
  }

  const packets = edges.map(() => ({
    t:     Math.random(),
    speed: 0.003 + Math.random() * 0.007,
  }));

  return { nodes, edges, packets };
}

export default function BlockchainGraph3D({ isFraud, probability = 0 }) {
  const mountRef = useRef(null);
  const stateRef = useRef({ isFraud, probability });

  useEffect(() => { stateRef.current = { isFraud, probability }; }, [isFraud, probability]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = mount.clientWidth;
    const H = mount.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
    camera.position.set(0, 0, 9);

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const graph = buildGraph();

    const nodeGeo    = new THREE.SphereGeometry(0.12, 16, 16);
    const nodeMeshes = graph.nodes.map((pos, i) => {
      const mat  = new THREE.MeshStandardMaterial({
        color: 0x00ff88, emissive: 0x00ff88,
        emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.3,
      });
      const mesh = new THREE.Mesh(nodeGeo, mat);
      mesh.position.copy(pos);
      scene.add(mesh);
      return mesh;
    });
    nodeMeshes[0].scale.setScalar(1.8);
    nodeMeshes[0].material = nodeMeshes[0].material.clone();

    const edgeMeshes = graph.edges.map(([a, b]) => {
      const geo  = new THREE.BufferGeometry().setFromPoints([graph.nodes[a], graph.nodes[b]]);
      const mat  = new THREE.LineBasicMaterial({ color: 0x003d22, linewidth: 1 });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      return line;
    });

    const packetGeo    = new THREE.SphereGeometry(0.055, 8, 8);
    const packetMeshes = graph.packets.map(() => {
      const mat  = new THREE.MeshStandardMaterial({
        color: 0x88ffcc, emissive: 0x88ffcc, emissiveIntensity: 1.2,
      });
      const mesh = new THREE.Mesh(packetGeo, mat);
      scene.add(mesh);
      return mesh;
    });

    const pointLight = new THREE.PointLight(0x00ff88, 3, 12);
    pointLight.position.set(0, 0, 5);
    scene.add(pointLight);

    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(600 * 3);
    for (let i = 0; i < 600 * 3; i++) starPos[i] = (Math.random() - 0.5) * 80;
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.04, sizeAttenuation: true })
    );
    scene.add(stars);

    let mouseX = 0, mouseY = 0;
    const onMouseMove = (e) => {
      const rect = mount.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
      mouseY = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
    };
    mount.addEventListener('mousemove', onMouseMove);

    const colorTarget  = { node: new THREE.Color(0x00ff88), edge: new THREE.Color(0x003d22), packet: new THREE.Color(0x88ffcc), light: new THREE.Color(0x00ff88) };
    const colorCurrent = { node: new THREE.Color(0x1a4a6b), edge: new THREE.Color(0x0d2a3d), packet: new THREE.Color(0x00c8ff), light: new THREE.Color(0x1a4a6b) };

    const resizeObs = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resizeObs.observe(mount);

    let frame = 0, rafId;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      frame++;
      const { isFraud: fraud, probability: prob } = stateRef.current;
      const t = frame * 0.01;

      if (prob === 0) {
        colorTarget.node.set(0x1a6b9a); colorTarget.edge.set(0x0d2a3d);
        colorTarget.packet.set(0x00c8ff); colorTarget.light.set(0x1a6b9a);
      } else if (fraud) {
        colorTarget.node.set(0xff0055); colorTarget.edge.set(0x4a0018);
        colorTarget.packet.set(0xff6688); colorTarget.light.set(0xff0055);
      } else {
        colorTarget.node.set(0x00ff88); colorTarget.edge.set(0x003d22);
        colorTarget.packet.set(0x88ffcc); colorTarget.light.set(0x00ff88);
      }

      const ls = 0.03;
      colorCurrent.node.lerp(colorTarget.node, ls);
      colorCurrent.edge.lerp(colorTarget.edge, ls);
      colorCurrent.packet.lerp(colorTarget.packet, ls);
      colorCurrent.light.lerp(colorTarget.light, ls);

      const speedMult = prob === 0 ? 0.5 : fraud ? 1.5 + prob * 2.5 : 0.7 + prob * 0.4;

      const targetRotY = t * 0.18 + mouseX * 0.4;
      const targetRotX = mouseY * 0.25;
      scene.rotation.y += (targetRotY - scene.rotation.y) * 0.04;
      scene.rotation.x += (targetRotX - scene.rotation.x) * 0.04;

      nodeMeshes.forEach((mesh, i) => {
        const isSource = i === 0 && prob > 0;
        const pulse    = Math.sin(t * 2.5 * speedMult + i * 0.7) * 0.5 + 0.5;
        mesh.scale.setScalar((isSource ? 1.8 : 1.0) * (0.85 + pulse * 0.3));
        const c = isSource ? colorTarget.node : colorCurrent.node;
        mesh.material.color.copy(c);
        mesh.material.emissive.copy(c);
        mesh.material.emissiveIntensity = isSource ? 0.8 + pulse * 0.8 : 0.3 + pulse * 0.4;
      });

      edgeMeshes.forEach(line => line.material.color.copy(colorCurrent.edge));

      graph.packets.forEach((p, i) => {
        p.t += p.speed * speedMult;
        if (p.t > 1) p.t = 0;
        const [a, b] = graph.edges[i];
        packetMeshes[i].position.lerpVectors(graph.nodes[a], graph.nodes[b], p.t);
        const pp = Math.sin(t * 4 + i) * 0.5 + 0.5;
        packetMeshes[i].material.color.copy(colorCurrent.packet);
        packetMeshes[i].material.emissive.copy(colorCurrent.packet);
        packetMeshes[i].material.emissiveIntensity = 0.8 + pp * 0.8;
        packetMeshes[i].scale.setScalar(0.8 + pp * 0.5);
      });

      pointLight.color.copy(colorCurrent.light);
      pointLight.intensity = prob === 0 ? 1.5 + Math.sin(t * 1.2) * 0.5
        : fraud ? 3 + Math.sin(t * 8) * 2
        : 2.5 + Math.sin(t * 2) * 0.5;

      stars.rotation.y = t * 0.02;
      stars.rotation.x = t * 0.01;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObs.disconnect();
      mount.removeEventListener('mousemove', onMouseMove);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
      nodeGeo.dispose(); packetGeo.dispose(); starGeo.dispose();
      nodeMeshes.forEach(m => m.material.dispose());
      edgeMeshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
      packetMeshes.forEach(m => m.material.dispose());
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="w-full h-full block cursor-crosshair"
    />
  );
}