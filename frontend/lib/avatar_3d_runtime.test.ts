import * as THREE from "three";

import { applyAvatar3DFrame } from "./avatar_3d_runtime";

test("runtime applies sampled frame values onto the 3d rig", () => {
  const avatar = new THREE.Group();
  const headGroup = new THREE.Group();
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mouth.position.y = -0.08;
  mouth.scale.y = 0.3;

  applyAvatar3DFrame(
    { avatar, headGroup, mouth },
    {
      avatarOffsetY: 0.02,
      headRotationX: 0.1,
      headRotationY: 0.2,
      headRotationZ: 0.03,
      mouthPositionY: -0.03,
      mouthScaleY: 0.8,
    }
  );

  expect(avatar.position.y).toBe(0.02);
  expect(headGroup.rotation.x).toBe(0.1);
  expect(headGroup.rotation.y).toBe(0.2);
  expect(headGroup.rotation.z).toBe(0.03);
  expect(mouth.scale.y).toBeGreaterThan(0.3);
  expect(mouth.scale.y).toBeLessThan(0.8);
  expect(mouth.position.y).toBeGreaterThan(-0.08);
  expect(mouth.position.y).toBeLessThan(-0.03);
});
