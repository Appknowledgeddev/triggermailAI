type LogoProps = {
  variant: "darkText" | "lightText";
  className?: string;
};

export function Logo({ variant, className = "" }: LogoProps) {
  const src =
    variant === "lightText"
      ? "/logos/triggermail-logo-dark-bg.png"
      : "/logos/triggermail-logo-light-bg.png";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt="Trigger Mail AI"
      className={`h-auto w-full object-contain ${className}`}
      height={52}
      src={src}
      width={260}
    />
  );
}
