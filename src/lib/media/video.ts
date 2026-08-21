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

export function captureVideoThumbnail(file: File, seekTo = 0.3): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(file);

    const cleanup = () => URL.revokeObjectURL(video.src);

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(seekTo, Math.max(video.duration - 0.1, 0));
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        reject(new Error("Ovaj pregledač ne podržava obradu videa."));
        return;
      }
      ctx.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          cleanup();
          if (blob) resolve(blob);
          else reject(new Error("Ne mogu da napravim thumbnail za video."));
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
