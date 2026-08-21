import { ReactNode, CSSProperties, MouseEventHandler } from 'react';

export interface IconButtonProps {
  children?: ReactNode;
  active?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  'aria-label'?: string;
  style?: CSSProperties;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
