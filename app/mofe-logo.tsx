// 재정경제부 로고 (재정경제부 누리집의 로고 파일을 public/mofe-logo.svg에 두고 쓴다, 가로 167 : 세로 48)
export default function MofeLogo({ height }: { height: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/mofe-logo.svg" alt="재정경제부" height={height} width={Math.round((height * 167) / 48)} style={{ height, width: "auto" }} />
  );
}
