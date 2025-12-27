import 'react';

declare module 'react' {
  interface IntrinsicElements {
    'l-newtons-cradle': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        size?: string;
        speed?: string;
        color?: string;
      },
      HTMLElement
    >;
  }
}

