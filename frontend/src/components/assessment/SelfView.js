import { useEffect, useRef } from 'react';

/** Small mirrored camera preview shown during a proctored interview. */
export default function SelfView({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream ? new MediaStream(stream.getVideoTracks()) : null;
    video.play().catch(() => {});
  }, [stream]);
  return (
    <div className="fixed bottom-4 right-4 z-40 w-40 sm:w-48 aspect-video rounded-xl overflow-hidden border border-white/15 bg-black/60 shadow-[0_10px_30px_rgba(0,0,0,0.5)] pointer-events-none">
      <video ref={ref} muted playsInline autoPlay className="w-full h-full object-cover -scale-x-100" />
      <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 text-[10px] text-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Camera on
      </span>
    </div>
  );
}
