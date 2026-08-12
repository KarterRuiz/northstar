import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function NorthStarAuthShell({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center p-4">
      <p className="text-heading mb-6 text-xs font-semibold tracking-[0.22em] uppercase">
        NorthStar
      </p>
      <Card className={cn("w-full max-w-[28rem] shadow-md", className)}>
        <CardHeader className="space-y-1.5">
          <CardTitle className="text-heading text-xl">Welcome to NorthStar</CardTitle>
          <p className="text-foreground text-base font-medium">{title}</p>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
        {footer ? (
          <CardFooter className="text-muted-foreground justify-center text-xs">
            {footer}
          </CardFooter>
        ) : null}
      </Card>
    </div>
  );
}
