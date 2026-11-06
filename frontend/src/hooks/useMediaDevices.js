import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * useMediaDevices: opens the camera and microphone once, before a proctored
 * interview starts, and keeps them open for the whole interview.
 *
 * Holding the stream means the browser never has to show a permission prompt
 * after proctoring is armed: voice answers reuse this microphone track.
 *
 * Device status values:
 *   idle | requesting | granted | denied | unavailable | in_use | disconnected | error | unsupported
 */

const VIDEO = { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: 'user' };
const AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

const LABEL = { camera: 'camera', microphone: 'microphone' };

function describeError(err, device) {
  const name = err && err.name;
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        status: 'denied',
        message: `Access to the ${LABEL[device]} was blocked. Click the camera/lock icon at the left of the address bar, set ${LABEL[device]} to "Allow", then press Retry. If your system blocks it, also allow your browser in your OS privacy settings (Windows: Settings > Privacy & security > ${device === 'camera' ? 'Camera' : 'Microphone'}).`
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return { status: 'unavailable', message: `No ${LABEL[device]} was found. Connect one and press Retry.` };
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return { status: 'in_use', message: `The ${LABEL[device]} could not be started. Close other apps that may be using it (Zoom, Teams, another tab) and press Retry.` };
    case 'NotSupportedError':
      return { status: 'unsupported', message: `This browser window can't use the ${LABEL[device]} (often an in-app or embedded browser). Open DevPrep in Chrome, Edge, Firefox or Safari.` };
    case 'SecurityError':
      return { status: 'unsupported', message: 'Camera and microphone need a secure (https or localhost) connection.' };
    default:
      return { status: 'error', message: `The ${LABEL[device]} could not be started${err?.message ? `: ${err.message}` : '.'}` };
  }
}

export function useMediaDevices() {
  const [stream, setStream] = useState(null);
  const [camera, setCamera] = useState({ status: 'idle', message: '' });
  const [microphone, setMicrophone] = useState({ status: 'idle', message: '' });
  const [requesting, setRequesting] = useState(false);
  const streamRef = useRef(null);
  const mountedRef = useRef(true);

  const stopStream = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (mountedRef.current) setStream(null);
  }, []);

  const watchTrack = (track, device) => {
    // Fires when the device is unplugged or permission is revoked (not on our own stop())
    track.addEventListener('ended', () => {
      if (!mountedRef.current || streamRef.current?.getTracks().indexOf(track) === -1) return;
      const set = device === 'camera' ? setCamera : setMicrophone;
      set({ status: 'disconnected', message: `The ${LABEL[device]} stopped working (unplugged, turned off, or permission removed). Reconnect it, then press Retry (or Reconnect devices).` });
    });
  };

  const request = useCallback(async () => {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      const m = { status: 'unsupported', message: 'Camera and microphone need a secure (https or localhost) connection.' };
      setCamera(m); setMicrophone(m);
      return null;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const m = { status: 'unsupported', message: 'This browser cannot access a camera or microphone. Use a current Chrome, Edge, Firefox or Safari.' };
      setCamera(m); setMicrophone(m);
      return null;
    }

    setRequesting(true);
    setCamera({ status: 'requesting', message: '' });
    setMicrophone({ status: 'requesting', message: '' });
    stopStream();

    let result = null;
    try {
      // One request, so the browser shows a single prompt for both
      result = await navigator.mediaDevices.getUserMedia({ video: VIDEO, audio: AUDIO });
      setCamera({ status: 'granted', message: '' });
      setMicrophone({ status: 'granted', message: '' });
    } catch (combinedErr) {
      // Find out which device failed, keeping whichever one works
      let audioStream = null;
      let videoStream = null;
      let audioErr = null;
      let videoErr = null;
      try { audioStream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO }); } catch (e) { audioErr = e; }
      try { videoStream = await navigator.mediaDevices.getUserMedia({ video: VIDEO }); } catch (e) { videoErr = e; }
      const tracks = [...(audioStream ? audioStream.getTracks() : []), ...(videoStream ? videoStream.getTracks() : [])];
      result = tracks.length ? new MediaStream(tracks) : null;
      setMicrophone(audioStream ? { status: 'granted', message: '' } : describeError(audioErr || combinedErr, 'microphone'));
      setCamera(videoStream ? { status: 'granted', message: '' } : describeError(videoErr || combinedErr, 'camera'));
    }

    if (!mountedRef.current) {
      if (result) result.getTracks().forEach((t) => t.stop());
      return null;
    }
    if (result) {
      result.getVideoTracks().forEach((t) => watchTrack(t, 'camera'));
      result.getAudioTracks().forEach((t) => watchTrack(t, 'microphone'));
    }
    streamRef.current = result;
    setStream(result);
    setRequesting(false);
    return result;
  }, [stopStream]);

  // Notice when the user revokes a permission in the browser UI
  useEffect(() => {
    if (!navigator.permissions || !navigator.permissions.query) return undefined;
    const cleanups = [];
    [['camera', setCamera], ['microphone', setMicrophone]].forEach(([name, set]) => {
      navigator.permissions.query({ name }).then((perm) => {
        const onChange = () => {
          if (perm.state === 'denied') {
            set({ status: 'denied', message: `Access to the ${LABEL[name]} was removed. Allow it again in the address bar, then press Retry (or Reconnect devices).` });
          }
        };
        perm.addEventListener('change', onChange);
        cleanups.push(() => perm.removeEventListener('change', onChange));
      }).catch(() => { /* Firefox doesn't support "camera" here */ });
    });
    return () => cleanups.forEach((fn) => fn());
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Audio-only view of the same tracks, for recording answers
  const audioStream = useMemo(() => {
    if (!stream) return null;
    const tracks = stream.getAudioTracks().filter((t) => t.readyState === 'live');
    return tracks.length ? new MediaStream(tracks) : null;
  }, [stream]);

  return { stream, audioStream, camera, microphone, requesting, request, release: stopStream };
}
