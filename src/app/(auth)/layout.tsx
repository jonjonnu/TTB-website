export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-dvh max-w-md bg-canvas">{children}</div>;
}
