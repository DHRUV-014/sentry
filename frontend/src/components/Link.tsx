import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { navigate } from "../lib/router";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

/** Same-tab navigation without a reload; modified clicks (new tab etc.) behave as normal links. */
const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ to, children, onClick, ...rest }, ref) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
    window.scrollTo({ top: 0 });
  };
  return (
    <a {...rest} ref={ref} href={to} onClick={handle}>
      {children}
    </a>
  );
});

export default Link;
