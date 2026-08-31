import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One shared <audio> element per call view. Everything (waveform, conversation
 * axis, energy graph, transcript) reads `time` and calls `seek` so the whole
 * instrument stays in lock-step.
 */
export function useAudio(src) {
  const ref = useRef(null);
  if (!ref.current && typeof Audio !== "undefined") {
    ref.current = new Audio();
    ref.current.preload = "auto";
  }
  const el = ref.current;

  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!el) return;
    el.src = src;
    el.load();
    const onTime = () => setTime(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onPause);
    return () => {
      el.pause();
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onPause);
    };
  }, [el, src]);

  const seek = useCallback(
    (t) => {
      if (!el || t == null || Number.isNaN(t)) return;
      el.currentTime = Math.max(0, t);
      setTime(el.currentTime);
    },
    [el]
  );
  const toggle = useCallback(() => {
    if (!el) return;
    if (el.paused) el.play();
    else el.pause();
  }, [el]);

  return { time, duration, playing, seek, toggle };
}

/** Decode the mp3 once and reduce it to `buckets` peak amplitudes for drawing. */
export function useWaveform(src, buckets = 480) {
  const [peaks, setPeaks] = useState(null);
  useEffect(() => {
    let dead = false;
    setPeaks(null);
    (async () => {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        const buf = await fetch(src).then((r) => r.arrayBuffer());
        const ctx = new AC();
        const audio = await ctx.decodeAudioData(buf);
        ctx.close();
        const ch = audio.numberOfChannels > 1
          ? mix(audio.getChannelData(0), audio.getChannelData(1))
          : audio.getChannelData(0);
        const size = Math.floor(ch.length / buckets);
        const out = new Float32Array(buckets);
        let max = 0.0001;
        for (let i = 0; i < buckets; i++) {
          let peak = 0;
          for (let k = 0; k < size; k++) {
            const v = Math.abs(ch[i * size + k] || 0);
            if (v > peak) peak = v;
          }
          out[i] = peak;
          if (peak > max) max = peak;
        }
        for (let i = 0; i < buckets; i++) out[i] /= max;
        if (!dead) setPeaks(out);
      } catch {
        if (!dead) setPeaks(new Float32Array(buckets).fill(0.15));
      }
    })();
    return () => { dead = true; };
  }, [src, buckets]);
  return peaks;
}

function mix(a, b) {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = (a[i] + (b[i] || 0)) * 0.5;
  return out;
}
