import * as React from "react";

import { cn } from "../lib/utils";

const strokeIconProps = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const IconSearch = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement>
>(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    {...strokeIconProps}
    className={cn(className)}
    {...props}
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
));
IconSearch.displayName = "IconSearch";

export const IconCheck = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement>
>(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    {...strokeIconProps}
    className={cn(className)}
    {...props}
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
));
IconCheck.displayName = "IconCheck";

export const IconChevronDown = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement>
>(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    {...strokeIconProps}
    className={cn(className)}
    {...props}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
));
IconChevronDown.displayName = "IconChevronDown";

export const IconChevronUp = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement>
>(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    {...strokeIconProps}
    className={cn(className)}
    {...props}
  >
    <path d="m18 15-6-6-6 6" />
  </svg>
));
IconChevronUp.displayName = "IconChevronUp";

export const IconX = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement>
>(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    {...strokeIconProps}
    className={cn(className)}
    {...props}
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
));
IconX.displayName = "IconX";
