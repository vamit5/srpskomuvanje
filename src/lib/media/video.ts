// Čitanje trajanja videa i generisanje thumbnail-a iz frejma, sve u browseru
// (bez ffmpeg-a i bez servera — video se uploaduje "kakav jeste", vidi
// napomenu u README-u o kompresiji videa kao budućem koraku).

export function readVideoMeta(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      const { duration, videoWidth, videoHeight } = video;
      URL.revokeObjectURL(video.src);
      if (!isFinite(duration) || duration <= 0) {
        reject(new Error("Ne mogu da pročitam trajanje ovog videa."));
        return;
      }
      resolve({ duration, width: videoWidth, height: videoHeight });
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Ne mogu da učitam ovaj video fajl."));
    };
  });
}

/** Uzima frejmove na nekoliko procenata trajanja videa (0-1), kao blob-ove. */
export function captureVideoFrames(file: File, positions: number[]): Promise<Blob[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(file);

    const cleanup = () => URL.revokeObjectURL(video.src);
    const frames: Blob[] = [];
    let i = 0;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    function captureNext() {
      if (i >= positions.length) {
        cleanup();
        resolve(frames);
        return;
      }
      const target = Math.min(
        Math.max(positions[i] * video.duration, 0),
        Math.max(video.duration - 0.1, 0)
      );
      video.currentTime = target;
    }

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      if (!ctx) {
        cleanup();
        reject(new Error("Ovaj pregledač ne podržava obradu videa."));
        return;
      }
      captureNext();
    };

    video.onseeked = () => {
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (blob) frames.push(blob);
          i += 1;
          captureNext();
        },
        "image/webp",
        0.8
      );
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Ne mogu da učitam ovaj video fajl."));
    };
  });
}

export async function captureVideoThumbnail(file: File, seekTo = 0.3): Promise<Blob> {
  const [frame] = await captureVideoFrames(file, [seekTo]);
  if (!frame) throw new Error("Ne mogu da napravim thumbnail za video.");
  return frame;
}
