import { ReactNode, CSSProperties } from 'react';

export interface CardProps {
  children?: ReactNode;
  padding?: string;
  style?: CSSProperties;
}
export declare function Card(props: CardProps): JSX.Element;
