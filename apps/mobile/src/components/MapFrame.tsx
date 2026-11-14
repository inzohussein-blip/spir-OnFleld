import { useImperativeHandle, useRef, type ComponentType, type Ref } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';
import { parseMapMessage, type HostMessage, type MapMessage } from '../lib/mapHtml';

// نوع WebView الافتراضي (P = undefined) يصير never مع TypeScript 7 — نثبّته على object
type WebViewInstance = WebView<object>;
const Web = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewInstance> }>;

export interface MapFrameHandle {
  send(m: HostMessage): void;
}

interface Props {
  html: string;
  onMessage(m: MapMessage): void;
  ref?: Ref<MapFrameHandle>;
}

/** الهاتف: الخريطة داخل WebView (نفس صفحة المتصفح) */
export function MapFrame({ html, onMessage, ref }: Props) {
  const webRef = useRef<WebViewInstance>(null);
  useImperativeHandle(ref, () => ({
    send(m) {
      webRef.current?.injectJavaScript(`window.__onHost && window.__onHost(${JSON.stringify(m)}); true;`);
    },
  }));
  return (
    <Web
      ref={webRef}
      style={StyleSheet.absoluteFill}
      originWhitelist={['*']}
      source={{ html, baseUrl: 'https://balmalaab.app/' }}
      onMessage={(e: { nativeEvent: { data: string } }) => {
        const m = parseMapMessage(e.nativeEvent.data);
        if (m) onMessage(m);
      }}
    />
  );
}
