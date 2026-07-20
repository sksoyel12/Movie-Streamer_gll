export interface StreamSource {
  label: string;
  url: string;
}

export const STREAM_SOURCES: StreamSource[] = [
  {
    label: "Primary",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  },
];
