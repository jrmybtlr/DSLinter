import "react";

declare module "react" {
  interface HTMLAttributes<T> {
    [key: `className:${string}`]: string | undefined;
    [key: `class:${string}`]: string | undefined;
  }

  interface SVGAttributes<T> {
    [key: `className:${string}`]: string | undefined;
    [key: `class:${string}`]: string | undefined;
  }
}

export {};
