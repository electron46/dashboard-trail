import { ReactNode } from 'react';

export interface DataValueProps {
  children?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  emphasis?: boolean;
}
export declare function DataValue(props: DataValueProps): JSX.Element;
