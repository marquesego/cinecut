/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Cut, Clip } from '../types';

export function exportToPremiereXML(cuts: Cut[], clips: Clip[], fps: number = 50) {
  const trackIndices = [0, 1]; // V1 (Primary) and V2 (Overlay)

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence>
    <name>CineCut Sequence Export</name>
    <rate>
      <timebase>${fps}</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <rate>
              <timebase>${fps}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
            <width>1920</width>
            <height>1080</height>
            <anamorphic>FALSE</anamorphic>
            <pixelaspectratio>square</pixelaspectratio>
            <fielddominance>none</fielddominance>
          </samplecharacteristics>
        </format>
`;

  let videoTracksXml = '';
  let audioTracksXml = '';
  let idCounter = 1;

  trackIndices.forEach((trackIdx) => {
    videoTracksXml += `        <track>\n`;
    audioTracksXml += `        <track>\n`;
    
    const trackCuts = cuts.filter(c => c.track === trackIdx);

    trackCuts.forEach((cut) => {
      const clip = clips.find(c => c.id === cut.clipId);
      if (!clip) return;

      const inF = Math.floor(cut.in * fps);
      const outF = Math.floor(cut.out * fps);
      const durationF = outF - inF;
      const startF = Math.floor((cut.startTime || 0) * fps);
      const endF = startF + durationF;

      // Ensure stable duration reporting with extra headroom just in case
      const fileDurationF = Math.max(Math.floor(clip.duration * fps), outF + 100);

      // Video Clipitem
      videoTracksXml += `          <clipitem id="clipitem-v${idCounter}">
            <masterclipid>masterclip-${idCounter}</masterclipid>
            <name>${clip.name}</name>
            <enabled>TRUE</enabled>
            <duration>${fileDurationF}</duration>
            <rate>
              <timebase>${fps}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
            <start>${startF}</start>
            <end>${endF}</end>
            <in>${inF}</in>
            <out>${outF}</out>
            <file id="file-${idCounter}">
              <name>${clip.name}</name>
              <pathurl>file://localhost/${encodeURIComponent(clip.name)}</pathurl>
              <rate>
                <timebase>${fps}</timebase>
                <ntsc>FALSE</ntsc>
              </rate>
              <duration>${fileDurationF}</duration>
              <media>
                <video>
                  <samplecharacteristics>
                    <width>1920</width>
                    <height>1080</height>
                  </samplecharacteristics>
                </video>
                <audio>
                  <samplecharacteristics>
                    <depth>16</depth>
                    <samplerate>48000</samplerate>
                  </samplecharacteristics>
                  <channelcount>2</channelcount>
                </audio>
              </media>
            </file>
          </clipitem>\n`;

      // Audio Clipitem matching identically
      audioTracksXml += `          <clipitem id="clipitem-a${idCounter}">
            <masterclipid>masterclip-${idCounter}</masterclipid>
            <name>${clip.name}</name>
            <enabled>TRUE</enabled>
            <duration>${fileDurationF}</duration>
            <rate>
              <timebase>${fps}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
            <start>${startF}</start>
            <end>${endF}</end>
            <in>${inF}</in>
            <out>${outF}</out>
            <file id="file-${idCounter}"/>
            <sourcetrack>
              <mediatype>audio</mediatype>
              <trackindex>1</trackindex>
            </sourcetrack>
          </clipitem>\n`;

      idCounter++;
    });

    videoTracksXml += `        </track>\n`;
    audioTracksXml += `        </track>\n`;
  });

  xml += videoTracksXml;
  xml += `      </video>\n      <audio>\n`;
  xml += audioTracksXml;
  xml += `      </audio>\n    </media>\n`;

  // Timecode section
  xml += `    <timecode>
      <rate>
        <timebase>${fps}</timebase>
        <ntsc>FALSE</ntsc>
      </rate>
      <string>00:00:00:00</string>
      <frame>0</frame>
      <displayformat>NDF</displayformat>
    </timecode>
  </sequence>
</xmeml>`;

  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cinecut_multitrack_export_${new Date().getTime()}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
