/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Clip {
  id: string;
  name: string;
  url: string;
  file: File;
  duration: number;
}

export interface Cut {
  id: string;
  clipId: string;
  clipName: string;
  in: number;
  out: number;
  track: number; // 0 for V1, 1 for V2, etc.
  color: string;
  startTime: number; // Beginning position on the sequence timeline in seconds
}

export interface ProjectState {
  clips: Clip[];
  cuts: Cut[];
  fps: number;
  currentClipId: string | null;
}
