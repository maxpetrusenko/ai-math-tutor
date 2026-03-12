import type { AvatarVisualState } from "../../../lib/avatar_contract";

export type SvgAvatarState = AvatarVisualState;

export type SvgAvatarProps = {
  className?: string;
  mouthOpen?: number;
  size?: number;
  state?: SvgAvatarState;
  title?: string;
};
