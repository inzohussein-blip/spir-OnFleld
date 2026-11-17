// صور مستوردة مباشرة (Metro يحوّلها لمصدر صورة)
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';
  const source: ImageSourcePropType;
  export default source;
}
