import * as THREE from "three";

import type { Avatar3DAsset } from "./avatar_asset_loader";
import type { AvatarConfig } from "./avatar_contract";
import type { Avatar3DRig } from "./avatar_3d_runtime";

export type Avatar3DSceneHandle = Avatar3DRig & {
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  dispose: () => void;
};

function addAccessory(headGroup: THREE.Group, asset: Avatar3DAsset): void {
  if (asset.appearance.accessory === "none") {
    return;
  }

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: asset.appearance.accentColor,
    metalness: 0.28,
    roughness: 0.44,
  });

  if (asset.appearance.accessory === "antenna") {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.18, 8), accentMaterial);
    stem.position.set(0, 0.28, 0);
    headGroup.add(stem);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), accentMaterial);
    bulb.position.set(0, 0.39, 0);
    headGroup.add(bulb);
    return;
  }

  if (asset.appearance.accessory === "wizard-hat") {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.025, 24), accentMaterial);
    brim.position.set(0, 0.25, 0);
    headGroup.add(brim);

    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 24), accentMaterial);
    hat.position.set(0, 0.43, 0);
    headGroup.add(hat);
    return;
  }

  if (asset.appearance.accessory === "goggles") {
    const frame = new THREE.MeshStandardMaterial({ color: asset.appearance.accentColor, metalness: 0.55, roughness: 0.35 });
    const leftRing = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 20), frame);
    leftRing.position.set(-0.08, 0.05, 0.215);
    headGroup.add(leftRing);
    const rightRing = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 20), frame);
    rightRing.position.set(0.08, 0.05, 0.215);
    headGroup.add(rightRing);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.01), frame);
    bridge.position.set(0, 0.05, 0.215);
    headGroup.add(bridge);
    return;
  }

  if (asset.appearance.accessory === "leaf") {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 12), accentMaterial);
    leaf.position.set(0.04, 0.31, 0);
    leaf.rotation.z = -0.48;
    headGroup.add(leaf);
    return;
  }

  const peel = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 10, 24, Math.PI), accentMaterial);
  peel.position.set(0, 0.28, -0.02);
  peel.rotation.z = Math.PI;
  headGroup.add(peel);
}

export function createAvatar3DScene(container: HTMLDivElement, config: AvatarConfig, asset: Avatar3DAsset): Avatar3DSceneHandle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(asset.appearance.backgroundColor);

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

  const fillLight = new THREE.DirectionalLight(asset.appearance.accentColor, 0.34);
  fillLight.position.set(-2, 2, -2);
  scene.add(fillLight);

  const avatar = new THREE.Group();
  scene.add(avatar);

  const headGroup = new THREE.Group();
  headGroup.position.y = 1.6;
  avatar.add(headGroup);

  const headGeometry = new THREE.SphereGeometry(0.25, 32, 32);
  const headMaterial = new THREE.MeshStandardMaterial({
    color: asset.appearance.headColor,
    roughness: asset.appearance.roughness,
    metalness: asset.appearance.metalness,
  });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.castShadow = true;
  headGroup.add(head);

  const eyeGeometry = new THREE.SphereGeometry(0.04, 16, 16);
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: asset.appearance.eyeColor });
  const pupilGeometry = new THREE.SphereGeometry(0.02, 16, 16);
  const pupilMaterial = new THREE.MeshStandardMaterial({ color: asset.appearance.pupilColor });

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
  const browMaterial = new THREE.MeshStandardMaterial({ color: asset.appearance.pupilColor });

  const leftBrow = new THREE.Mesh(browGeometry, browMaterial);
  leftBrow.position.set(-0.08, 0.12, 0.23);
  headGroup.add(leftBrow);

  const rightBrow = new THREE.Mesh(browGeometry, browMaterial);
  rightBrow.position.set(0.08, 0.12, 0.23);
  headGroup.add(rightBrow);

  const noseGeometry = new THREE.ConeGeometry(0.03, 0.08, 8);
  const noseMaterial = new THREE.MeshStandardMaterial({ color: asset.appearance.headColor });
  const nose = new THREE.Mesh(noseGeometry, noseMaterial);
  nose.position.set(0, 0, 0.25);
  nose.rotation.x = Math.PI / 2;
  headGroup.add(nose);

  const mouthGeometry = new THREE.SphereGeometry(0.06, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const mouthMaterial = new THREE.MeshStandardMaterial({ color: asset.appearance.mouthColor });
  const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
  mouth.position.set(0, -0.08, 0.22);
  mouth.rotation.x = Math.PI;
  mouth.scale.set(1, 0.3, 1);
  headGroup.add(mouth);
  addAccessory(headGroup, asset);

  const bodyGeometry = new THREE.CapsuleGeometry(0.2, 0.8, 8, 16);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: asset.appearance.bodyColor,
    roughness: asset.appearance.roughness,
    metalness: asset.appearance.metalness,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.5;
  body.castShadow = true;
  avatar.add(body);

  const floorGeometry = new THREE.CircleGeometry(2, 32);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: asset.appearance.floorColor, roughness: 0.9 });
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
