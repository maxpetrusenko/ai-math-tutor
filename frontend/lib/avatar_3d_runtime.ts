import * as THREE from "three";

import type { Avatar3DFrame } from "./avatar_3d_driver";

export type Avatar3DRig = {
  avatar: THREE.Group;
  headGroup: THREE.Group;
  mouth: THREE.Mesh;
};

export function applyAvatar3DFrame(rig: Avatar3DRig, frame: Avatar3DFrame, smoothing = 0.3) {
  rig.avatar.position.y = frame.avatarOffsetY;
  rig.headGroup.rotation.x = frame.headRotationX;
  rig.headGroup.rotation.y = frame.headRotationY;
  rig.headGroup.rotation.z = frame.headRotationZ;
  rig.mouth.scale.y += (frame.mouthScaleY - rig.mouth.scale.y) * smoothing;
  rig.mouth.position.y += (frame.mouthPositionY - rig.mouth.position.y) * smoothing;
}
