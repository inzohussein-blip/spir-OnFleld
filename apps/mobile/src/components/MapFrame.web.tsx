import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { parseMapMessage, type HostMessage, type MapMessage } from '../lib/mapHtml';

export interface MapFrameHandle {
  send(m: HostMessage): void;
}

interface Props {
  html: string;
  onMessage(m: MapMessage): void;
  ref?: Ref<MapFrameHandle>;
}

/** المتصفح: نفس صفحة الخريطة داخل iframe */
export function MapFrame({ html, onMessage, ref }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const handlerRef = useRef(onMessage);
  useEffect(() => {
    handlerRef.current = onMessage;
  });
  useImperativeHandle(ref, () => ({
    send(m) {
      frameRef.current?.contentWindow?.postMessage({ ...m, __host: 1 }, '*');
    },
  }));
  useEffect(() => {
    const listen = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      const m = parseMapMessage(e.data);
      if (m) handlerRef.current(m);
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);
  return (
    <iframe
      ref={frameRef}
      title="خريطة الملاعب"
      srcDoc={html}
      allow="geolocation"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
    />
  );
}
