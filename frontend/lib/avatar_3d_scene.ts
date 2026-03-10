import * as THREE from "three";

import type { AvatarConfig } from "./avatar_contract";
import type { Avatar3DRig } from "./avatar_3d_runtime";

export type Avatar3DSceneHandle = Avatar3DRig & {
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  dispose: () => void;
};

export function createAvatar3DScene(container: HTMLDivElement, config: AvatarConfig): Avatar3DSceneHandle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 3);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = config.enable_shadows ?? true;
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
  mainLight.position.set(2, 4, 3);
  mainLight.castShadow = true;
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
  fillLight.position.set(-2, 2, -2);
  scene.add(fillLight);

  const avatar = new THREE.Group();
  scene.add(avatar);

  const headGroup = new THREE.Group();
  headGroup.position.y = 1.6;
  avatar.add(headGroup);

  const headGeometry = new THREE.SphereGeometry(0.25, 32, 32);
  const headMaterial = new THREE.MeshStandardMaterial({
    color: 0xffdbac,
    roughness: 0.8,
    metalness: 0.1,
  });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.castShadow = true;
  headGroup.add(head);

  const eyeGeometry = new THREE.SphereGeometry(0.04, 16, 16);
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const pupilGeometry = new THREE.SphereGeometry(0.02, 16, 16);
  const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });

  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.08, 0.05, 0.22);
  headGroup.add(leftEye);
  const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  leftPupil.position.z = 0.03;
  leftEye.add(leftPupil);

  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.08, 0.05, 0.22);
  headGroup.add(rightEye);
  const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  rightPupil.position.z = 0.03;
  rightEye.add(rightPupil);

  const browGeometry = new THREE.BoxGeometry(0.08, 0.015, 0.015);
  const browMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3728 });

  const leftBrow = new THREE.Mesh(browGeometry, browMaterial);
  leftBrow.position.set(-0.08, 0.12, 0.23);
  headGroup.add(leftBrow);

  const rightBrow = new THREE.Mesh(browGeometry, browMaterial);
  rightBrow.position.set(0.08, 0.12, 0.23);
  headGroup.add(rightBrow);

  const noseGeometry = new THREE.ConeGeometry(0.03, 0.08, 8);
  const noseMaterial = new THREE.MeshStandardMaterial({ color: 0xf0c8a0 });
  const nose = new THREE.Mesh(noseGeometry, noseMaterial);
  nose.position.set(0, 0, 0.25);
  nose.rotation.x = Math.PI / 2;
  headGroup.add(nose);

  const mouthGeometry = new THREE.SphereGeometry(0.06, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const mouthMaterial = new THREE.MeshStandardMaterial({ color: 0xcc6666 });
  const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
  mouth.position.set(0, -0.08, 0.22);
  mouth.rotation.x = Math.PI;
  mouth.scale.set(1, 0.3, 1);
  headGroup.add(mouth);

  const bodyGeometry = new THREE.CapsuleGeometry(0.2, 0.8, 8, 16);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.6 });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.5;
  body.castShadow = true;
  avatar.add(body);

  const floorGeometry = new THREE.CircleGeometry(2, 32);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a4a, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };

  const onMouseDown = (event: MouseEvent) => {
    isDragging = true;
    previousMousePosition = { x: event.clientX, y: event.clientY };
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!isDragging) {
      return;
    }

    const deltaMove = {
      x: event.clientX - previousMousePosition.x,
      y: event.clientY - previousMousePosition.y,
    };
    avatar.rotation.y += deltaMove.x * 0.01;
    headGroup.rotation.x += deltaMove.y * 0.01;
    previousMousePosition = { x: event.clientX, y: event.clientY };
  };

  const onMouseUp = () => {
    isDragging = false;
  };

  renderer.domElement.addEventListener("mousedown", onMouseDown);
  renderer.domElement.addEventListener("mousemove", onMouseMove);
  renderer.domElement.addEventListener("mouseup", onMouseUp);

  const handleResize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  window.addEventListener("resize", handleResize);

  return {
    avatar,
    camera,
    dispose: () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("mouseup", onMouseUp);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    },
    headGroup,
    mouth,
    renderer,
    scene,
  };
}
