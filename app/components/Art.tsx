import Image, { type StaticImageData } from "next/image";

// One painting in both treatments; CSS shows the one that matches the theme.
export function Art({ light, dark, sizes }: { light: StaticImageData; dark: StaticImageData; sizes: string }) {
  return (
    <>
      <Image className="art-l" src={light} alt="" fill sizes={sizes} />
      <Image className="art-d" src={dark} alt="" fill sizes={sizes} />
    </>
  );
}
