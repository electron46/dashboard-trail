import { ReactNode } from 'react';

export interface BannerProps {
  tone?: 'ok' | 'err' | 'info';
  children?: ReactNode;
}
export declare function Banner(props: BannerProps): JSX.Element;
